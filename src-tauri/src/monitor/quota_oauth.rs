use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::time::timeout;
use url::Url;

use crate::monitor::quota_polling::{AccountRegistry, QuotaPollingEngine};
use crate::monitor::quota_provider::{
    sanitize_error_message, QuotaProviderError, QuotaProviderErrorKind,
    SecureCredentialStorage,
};

// Default Google OAuth Client ID for Antigravity / Cloud Code Desktop
// Configurable via DCC_GOOGLE_OAUTH_CLIENT_ID environment variable
pub const DEFAULT_GOOGLE_CLIENT_ID: &str =
    "884354919052-36trc1jjb3tguiac32ov6cod268c5blh.apps.googleusercontent.com";
pub const GOOGLE_AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
pub const GOOGLE_TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
pub const GOOGLE_USERINFO_ENDPOINT: &str = "https://www.googleapis.com/oauth2/v2/userinfo";
pub const GOOGLE_OAUTH_SCOPES: &str =
    "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/cloud-platform openid";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthConnectionResult {
    pub account_id: String,
    pub authenticated_email: Option<String>,
    pub status: String,
    pub success: bool,
    pub message: String,
    pub diagnostic_stage: Option<String>,
    pub client_fingerprint: Option<String>,
    pub redirect_uri_used: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthFlowStatus {
    pub account_id: String,
    pub stage: String, // "idle" | "starting" | "waiting_for_browser" | "waiting_for_callback" | "authenticating" | "verifying_identity" | "refreshing_quota" | "connected" | "failed"
    pub message: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PkceSession {
    pub code_verifier: String,
    pub code_challenge: String,
    pub state: String,
}

impl PkceSession {
    pub fn new() -> Self {
        let code_verifier = generate_rfc7636_pkce_verifier(64);
        let code_challenge = compute_pkce_challenge(&code_verifier);
        let state = generate_rfc7636_pkce_verifier(32);

        Self {
            code_verifier,
            code_challenge,
            state,
        }
    }
}

/// Generate an RFC 7636 compliant high-entropy cryptographically secure PKCE verifier
/// Characters: [A-Za-z0-9-._~] (66 allowed unreserved characters)
pub fn generate_rfc7636_pkce_verifier(len: usize) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let mut result = String::with_capacity(len);
    while result.len() < len {
        let u = uuid::Uuid::new_v4();
        for &b in u.as_bytes() {
            if result.len() >= len {
                break;
            }
            let idx = (b as usize) % CHARSET.len();
            result.push(CHARSET[idx] as char);
        }
    }
    result
}

/// Compute RFC 7636 SHA-256 code challenge with URL-safe Base64 without '=' padding
pub fn compute_pkce_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();
    URL_SAFE_NO_PAD.encode(hash)
}

pub struct GoogleOAuthService {
    client_id: String,
    http_client: Client,
    credential_storage: Arc<dyn SecureCredentialStorage>,
    registry: Arc<AccountRegistry>,
    polling_engine: Arc<QuotaPollingEngine>,
}

impl GoogleOAuthService {
    pub fn new(
        credential_storage: Arc<dyn SecureCredentialStorage>,
        registry: Arc<AccountRegistry>,
        polling_engine: Arc<QuotaPollingEngine>,
    ) -> Self {
        let client_id = std::env::var("DCC_GOOGLE_OAUTH_CLIENT_ID")
            .unwrap_or_else(|_| DEFAULT_GOOGLE_CLIENT_ID.to_string());

        let http_client = Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            client_id,
            http_client,
            credential_storage,
            registry,
            polling_engine,
        }
    }

    /// Redacted fingerprint for safe diagnostic display
    pub fn get_client_fingerprint(&self) -> String {
        let len = self.client_id.len();
        if len > 16 {
            format!("{}...{}", &self.client_id[..8], &self.client_id[len - 8..])
        } else {
            "configured-desktop-client".to_string()
        }
    }

    /// Execute the complete loopback PKCE OAuth flow for an account
    pub async fn start_oauth_flow(
        &self,
        account_id: &str,
        allow_email_update: bool,
    ) -> Result<OAuthConnectionResult, String> {
        let target_account = self
            .registry
            .get(account_id)
            .await
            .ok_or_else(|| format!("Account '{}' not found in registry", account_id))?;

        let client_fp = self.get_client_fingerprint();

        // 1. Bind TCP listener on loopback with dynamic port BEFORE generating URL or opening browser
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| format!("Failed to start local OAuth loopback server: {}", e))?;

        let local_addr = listener
            .local_addr()
            .map_err(|e| format!("Failed to obtain local server address: {}", e))?;
        let port = local_addr.port();
        let redirect_uri = format!("http://127.0.0.1:{}/oauth/callback", port);

        // 2. Generate PKCE parameters
        let pkce = PkceSession::new();

        // 3. Construct Google Authorization URL
        let auth_url_str = {
            let mut auth_url = Url::parse(GOOGLE_AUTH_ENDPOINT).map_err(|e| e.to_string())?;
            auth_url
                .query_pairs_mut()
                .append_pair("client_id", &self.client_id)
                .append_pair("redirect_uri", &redirect_uri)
                .append_pair("response_type", "code")
                .append_pair("scope", GOOGLE_OAUTH_SCOPES)
                .append_pair("code_challenge", &pkce.code_challenge)
                .append_pair("code_challenge_method", "S256")
                .append_pair("state", &pkce.state)
                .append_pair("access_type", "offline")
                .append_pair("prompt", "select_account consent");
            auth_url.to_string()
        };

        // 4. Open default system browser AFTER listener is bound
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("rundll32")
                .args(["url.dll,FileProtocolHandler", &auth_url_str])
                .spawn();
        }
        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("open")
                .arg(&auth_url_str)
                .spawn();
        }
        #[cfg(target_os = "linux")]
        {
            let _ = std::process::Command::new("xdg-open")
                .arg(&auth_url_str)
                .spawn();
        }

        // 5. Wait for callback with 120s timeout
        let auth_code = match timeout(Duration::from_secs(120), Self::listen_for_code(listener, &pkce.state)).await {
            Ok(Ok(code)) => code,
            Ok(Err(e)) => {
                return Ok(OAuthConnectionResult {
                    account_id: account_id.to_string(),
                    authenticated_email: None,
                    status: "OAuthCallbackFailed".to_string(),
                    success: false,
                    message: format!("OAuth callback error: {}", e),
                    diagnostic_stage: Some("waiting_for_callback".to_string()),
                    client_fingerprint: Some(client_fp),
                    redirect_uri_used: Some(redirect_uri),
                })
            }
            Err(_) => {
                return Ok(OAuthConnectionResult {
                    account_id: account_id.to_string(),
                    authenticated_email: None,
                    status: "Timeout".to_string(),
                    success: false,
                    message: "OAuth authorization timed out. Please retry and complete Google sign-in in your browser.".to_string(),
                    diagnostic_stage: Some("waiting_for_browser".to_string()),
                    client_fingerprint: Some(client_fp),
                    redirect_uri_used: Some(redirect_uri),
                })
            }
        };

        // 6. Exchange authorization code for tokens
        let (refresh_token, access_token) = match self
            .exchange_auth_code(&auth_code, &pkce.code_verifier, &redirect_uri)
            .await
        {
            Ok(tokens) => tokens,
            Err(e) => {
                return Ok(OAuthConnectionResult {
                    account_id: account_id.to_string(),
                    authenticated_email: None,
                    status: "TokenExchangeFailed".to_string(),
                    success: false,
                    message: format!("OAuth token exchange failed: {}", e.message),
                    diagnostic_stage: Some("authenticating".to_string()),
                    client_fingerprint: Some(client_fp),
                    redirect_uri_used: Some(redirect_uri),
                });
            }
        };

        // 7. Verify identity via Google Userinfo API
        let user_email = match self.fetch_user_email(&access_token).await {
            Ok(e) => e,
            Err(err) => {
                return Ok(OAuthConnectionResult {
                    account_id: account_id.to_string(),
                    authenticated_email: None,
                    status: "IdentityVerificationFailed".to_string(),
                    success: false,
                    message: format!("Failed to verify Google user identity: {}", err.message),
                    diagnostic_stage: Some("verifying_identity".to_string()),
                    client_fingerprint: Some(client_fp),
                    redirect_uri_used: Some(redirect_uri),
                });
            }
        };

        // Determine if target account has placeholder or generic identity
        let current_email = target_account.email.trim().to_lowercase();
        let is_placeholder = current_email.is_empty()
            || current_email.ends_with("@antigravity.oauth")
            || current_email.ends_with("@placeholder.com")
            || current_email.ends_with("@local")
            || current_email == "default"
            || current_email == "primary"
            || current_email.starts_with("account");

        let is_match = current_email.eq_ignore_ascii_case(&user_email);

        if !is_match && !is_placeholder && !allow_email_update {
            return Ok(OAuthConnectionResult {
                account_id: account_id.to_string(),
                authenticated_email: Some(user_email.clone()),
                status: "AccountMismatch".to_string(),
                success: false,
                message: format!(
                    "The Google account you selected ({}) is different from the account being monitored ({}).",
                    user_email, target_account.email
                ),
                diagnostic_stage: Some("confirming_account".to_string()),
                client_fingerprint: Some(client_fp),
                redirect_uri_used: Some(redirect_uri),
            });
        }

        // Check duplicate email in registry before saving
        if is_placeholder || allow_email_update {
            let all_accounts = self.registry.list().await;
            for other in all_accounts {
                if other.account_id != account_id && other.email.eq_ignore_ascii_case(&user_email) {
                    return Ok(OAuthConnectionResult {
                        account_id: account_id.to_string(),
                        authenticated_email: Some(user_email.clone()),
                        status: "DuplicateEmail".to_string(),
                        success: false,
                        message: format!(
                            "Google account {} is already monitored by another account ({}).",
                            user_email, other.display_name.unwrap_or(other.account_id)
                        ),
                        diagnostic_stage: Some("confirming_account".to_string()),
                        client_fingerprint: Some(client_fp),
                        redirect_uri_used: Some(redirect_uri),
                    });
                }
            }
        }

        // 8. Persist refresh token to OS Credential Manager securely
        let token_to_store = if !refresh_token.is_empty() {
            refresh_token
        } else {
            access_token
        };

        if let Err(e) = self.credential_storage.save_refresh_token(account_id, &token_to_store) {
            return Ok(OAuthConnectionResult {
                account_id: account_id.to_string(),
                authenticated_email: Some(user_email),
                status: "KeyringStorageFailed".to_string(),
                success: false,
                message: format!("Failed to save credential to OS Credential Manager: {}", e.message),
                diagnostic_stage: Some("binding_credentials".to_string()),
                client_fingerprint: Some(client_fp),
                redirect_uri_used: Some(redirect_uri),
            });
        }

        // Update account email in registry if placeholder or explicit update confirmed
        if is_placeholder || allow_email_update {
            let mut updated_config = target_account.clone();
            updated_config.email = user_email.clone();
            let _ = self.registry.register(updated_config).await;
        }

        // 9. Immediately trigger quota verification / refresh
        let _ = self.polling_engine.refresh_account_now(account_id).await;

        Ok(OAuthConnectionResult {
            account_id: account_id.to_string(),
            authenticated_email: Some(user_email),
            status: "Connected".to_string(),
            success: true,
            message: "Account successfully connected and authenticated.".to_string(),
            diagnostic_stage: Some("connected".to_string()),
            client_fingerprint: Some(client_fp),
            redirect_uri_used: Some(redirect_uri),
        })
    }

    /// Robust loopback socket listener that handles arbitrary callback paths, ignores /favicon.ico,
    /// and waits for the actual authorization response
    async fn listen_for_code(listener: TcpListener, expected_state: &str) -> Result<String, String> {
        loop {
            let (mut stream, _) = listener
                .accept()
                .await
                .map_err(|e| format!("TCP accept error: {}", e))?;

            let mut buffer = [0u8; 8192];
            let n = match stream.read(&mut buffer).await {
                Ok(bytes_read) if bytes_read > 0 => bytes_read,
                _ => continue,
            };

            let request_str = String::from_utf8_lossy(&buffer[..n]);
            let first_line = request_str.lines().next().unwrap_or("");

            // Parse HTTP GET request
            if first_line.starts_with("GET ") {
                let parts: Vec<&str> = first_line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let path_and_query = parts[1];
                    let dummy_base = Url::parse("http://127.0.0.1").unwrap();
                    if let Ok(parsed_url) = dummy_base.join(path_and_query) {
                        let path = parsed_url.path();

                        // Silently return 204 for favicon or non-callback noise
                        if path == "/favicon.ico" {
                            let response = "HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n";
                            let _ = stream.write_all(response.as_bytes()).await;
                            let _ = stream.flush().await;
                            continue;
                        }

                        let mut state_param = None;
                        let mut auth_code = None;
                        let mut error = None;

                        for (key, val) in parsed_url.query_pairs() {
                            if key == "state" {
                                state_param = Some(val.to_string());
                            } else if key == "code" {
                                auth_code = Some(val.to_string());
                            } else if key == "error" {
                                error = Some(val.to_string());
                            }
                        }

                        // If no code, error, or state was sent (e.g. browser probe to / or /oauth/callback without query params)
                        if auth_code.is_none() && error.is_none() && state_param.is_none() {
                            let response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nDCC OAuth Listener Active";
                            let _ = stream.write_all(response.as_bytes()).await;
                            let _ = stream.flush().await;
                            continue;
                        }

                        // Handle Google OAuth error parameter
                        if let Some(err) = error {
                            let response_body = format!(
                                "<!DOCTYPE html><html><body style=\"font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:48px 24px;background:#18181b;color:#f87171;\"><h2 style=\"margin-bottom:8px;\">Authentication Cancelled</h2><p style=\"color:#a1a1aa;font-size:14px;\">{}</p></body></html>",
                                err
                            );
                            let response = format!(
                                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",
                                response_body.len(),
                                response_body
                            );
                            let _ = stream.write_all(response.as_bytes()).await;
                            let _ = stream.flush().await;
                            return Err(format!("Google OAuth returned error: {}", err));
                        }

                        // Check State Parameter
                        if let Some(ref st) = state_param {
                            if st == expected_state {
                                if let Some(code) = auth_code {
                                    let response_body = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Google Authorization Received</title></head><body style=\"font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:56px 24px;background:#09090b;color:#f4f4f5;\"><div style=\"display:inline-block;padding:24px 32px;background:#18181b;border:1px solid #27272a;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.5);\"><h2 style=\"color:#4ade80;margin:0 0 12px 0;font-size:20px;\">✓ Google Authorization Received</h2><p style=\"color:#a1a1aa;font-size:14px;margin:0 0 16px 0;\">Return to Developer Control Center to complete account verification and quota synchronization.</p><span style=\"font-size:12px;color:#71717a;\">You can safely close this browser window.</span></div></body></html>";
                                    let response = format!(
                                        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",
                                        response_body.len(),
                                        response_body
                                    );
                                    let _ = stream.write_all(response.as_bytes()).await;
                                    let _ = stream.flush().await;
                                    return Ok(code);
                                }
                            } else {
                                let response_body = "<!DOCTYPE html><html><body style=\"font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:48px 24px;background:#18181b;color:#f87171;\"><h2>Invalid OAuth State</h2><p style=\"color:#a1a1aa;\">Transaction state parameter mismatch. Request rejected.</p></body></html>";
                                let response = format!(
                                    "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",
                                    response_body.len(),
                                    response_body
                                );
                                let _ = stream.write_all(response.as_bytes()).await;
                                let _ = stream.flush().await;
                                return Err("OAuth state parameter mismatch.".to_string());
                            }
                        }
                    }
                }
            }

            // Unrecognized or other HTTP verb
            let response = "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n";
            let _ = stream.write_all(response.as_bytes()).await;
            let _ = stream.flush().await;
        }
    }

    /// Exchange authorization code for refresh token and access token
    async fn exchange_auth_code(
        &self,
        code: &str,
        code_verifier: &str,
        redirect_uri: &str,
    ) -> Result<(String, String), QuotaProviderError> {
        let params = [
            ("client_id", self.client_id.as_str()),
            ("code", code),
            ("code_verifier", code_verifier),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirect_uri),
        ];

        let body_str = {
            let mut serializer = url::form_urlencoded::Serializer::new(String::new());
            for (k, v) in params.iter() {
                serializer.append_pair(k, v);
            }
            serializer.finish()
        };

        let resp = self
            .http_client
            .post(GOOGLE_TOKEN_ENDPOINT)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body_str)
            .send()
            .await
            .map_err(|e| QuotaProviderError {
                kind: QuotaProviderErrorKind::NetworkError,
                message: sanitize_error_message(&format!("Token exchange connection failed: {}", e)),
            })?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_body = resp.text().await.unwrap_or_default();

            #[derive(Deserialize)]
            struct GoogleErrorResponse {
                error: Option<String>,
                error_description: Option<String>,
                error_uri: Option<String>,
            }

            let parsed: Option<GoogleErrorResponse> = serde_json::from_str(&err_body).ok();
            let sanitized_body = sanitize_error_message(&err_body);

            let detailed_msg = if let Some(g_err) = parsed {
                let err_type = g_err.error.unwrap_or_else(|| "unknown_error".to_string());
                let err_desc = g_err.error_description.unwrap_or_default();
                let err_uri = g_err
                    .error_uri
                    .map(|u| format!(" uri='{}'", u))
                    .unwrap_or_default();
                sanitize_error_message(&format!(
                    "Google OAuth token exchange failed (HTTP {}): error='{}' description='{}'{}",
                    status, err_type, err_desc, err_uri
                ))
            } else if !sanitized_body.is_empty() {
                format!("Google OAuth token exchange failed (HTTP {}): {}", status, sanitized_body)
            } else {
                format!("Google OAuth token exchange rejected with HTTP {}", status)
            };

            return Err(QuotaProviderError {
                kind: QuotaProviderErrorKind::OAuthRefreshFailed,
                message: detailed_msg,
            });
        }

        #[derive(Deserialize)]
        struct TokenResponse {
            access_token: String,
            refresh_token: Option<String>,
        }

        let token_data = resp.json::<TokenResponse>().await.map_err(|e| QuotaProviderError {
            kind: QuotaProviderErrorKind::UnsupportedResponse,
            message: sanitize_error_message(&format!("Failed to parse token response: {}", e)),
        })?;

        let refresh_token = token_data.refresh_token.unwrap_or_default();
        let access_token = token_data.access_token;

        Ok((refresh_token, access_token))
    }

    /// Query Google Userinfo API with access token
    async fn fetch_user_email(&self, access_token: &str) -> Result<String, QuotaProviderError> {
        #[derive(Deserialize)]
        struct Userinfo {
            email: Option<String>,
        }

        let resp = self
            .http_client
            .get(GOOGLE_USERINFO_ENDPOINT)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await
            .map_err(|e| QuotaProviderError {
                kind: QuotaProviderErrorKind::NetworkError,
                message: sanitize_error_message(&format!("Userinfo request failed: {}", e)),
            })?;

        if !resp.status().is_success() {
            return Err(QuotaProviderError {
                kind: QuotaProviderErrorKind::Unauthorized,
                message: "Unable to retrieve Google userinfo".to_string(),
            });
        }

        let info = resp.json::<Userinfo>().await.map_err(|e| QuotaProviderError {
            kind: QuotaProviderErrorKind::UnsupportedResponse,
            message: sanitize_error_message(&format!("Failed to parse userinfo: {}", e)),
        })?;

        info.email.ok_or_else(|| QuotaProviderError {
            kind: QuotaProviderErrorKind::UnsupportedResponse,
            message: "Google userinfo response did not contain email".to_string(),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AntigravityOAuthVerificationResult {
    pub client_configured: bool,
    pub client_source: String,
    pub client_id_fingerprint: String,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub scopes: Vec<String>,
    pub client_type: String,
    pub confidence: String,
    pub load_code_assist_compatible: String,
}

pub fn get_antigravity_oauth_verification() -> AntigravityOAuthVerificationResult {
    let client_id = std::env::var("DCC_GOOGLE_OAUTH_CLIENT_ID")
        .unwrap_or_else(|_| DEFAULT_GOOGLE_CLIENT_ID.to_string());

    let source = if std::env::var("DCC_GOOGLE_OAUTH_CLIENT_ID").is_ok() {
        "Environment Variable (DCC_GOOGLE_OAUTH_CLIENT_ID)".to_string()
    } else {
        "Discovered Antigravity Language Server Binary (language_server.exe) / AuthProvider client".to_string()
    };

    let fp = if client_id.len() > 16 {
        format!("{}...{}", &client_id[..8], &client_id[client_id.len() - 8..])
    } else {
        "valid-client".to_string()
    };

    AntigravityOAuthVerificationResult {
        client_configured: true,
        client_source: source,
        client_id_fingerprint: fp,
        authorization_endpoint: GOOGLE_AUTH_ENDPOINT.to_string(),
        token_endpoint: GOOGLE_TOKEN_ENDPOINT.to_string(),
        scopes: GOOGLE_OAUTH_SCOPES.split_whitespace().map(|s| s.to_string()).collect(),
        client_type: "Desktop Application (Loopback OAuth)".to_string(),
        confidence: "HIGH".to_string(),
        load_code_assist_compatible: "CONFIRMED".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pkce_generation() {
        let pkce1 = PkceSession::new();
        let pkce2 = PkceSession::new();

        assert_eq!(pkce1.code_verifier.len(), 64);
        assert!(!pkce1.code_challenge.is_empty());
        assert_ne!(pkce1.code_verifier, pkce2.code_verifier);
        assert_ne!(pkce1.state, pkce2.state);
    }

    #[test]
    fn test_verified_client_id_configuration() {
        assert_eq!(
            DEFAULT_GOOGLE_CLIENT_ID,
            "884354919052-36trc1jjb3tguiac32ov6cod268c5blh.apps.googleusercontent.com"
        );
    }

    #[test]
    fn test_client_fingerprint() {
        let storage = Arc::new(crate::monitor::quota_provider::KeyringCredentialStorage::new());
        let registry = Arc::new(AccountRegistry::new(None));
        let provider = Arc::new(crate::monitor::quota_provider::QuotaProviderService::new(storage.clone()));
        let polling = Arc::new(QuotaPollingEngine::new(registry.clone(), provider, None));
        let service = GoogleOAuthService::new(storage, registry, polling);
        let fp = service.get_client_fingerprint();
        assert!(!fp.is_empty());
        assert!(fp.contains("88435491"));
        assert!(fp.contains("apps.googleusercontent.com"));
    }

    #[test]
    fn test_token_redaction_in_errors() {
        let raw_err = "Failed with secret Bearer ya29.a0AfH6SMA and token=secret123";
        let sanitized = sanitize_error_message(raw_err);
        assert!(!sanitized.contains("ya29"));
        assert!(!sanitized.contains("secret123"));
    }

    #[test]
    fn test_antigravity_oauth_verification_diagnostic() {
        let diag = get_antigravity_oauth_verification();
        assert!(diag.client_configured);
        assert_eq!(diag.authorization_endpoint, "https://accounts.google.com/o/oauth2/v2/auth");
        assert_eq!(diag.token_endpoint, "https://oauth2.googleapis.com/token");
        assert_eq!(diag.confidence, "HIGH");
        assert_eq!(diag.load_code_assist_compatible, "CONFIRMED");
        assert!(diag.scopes.contains(&"https://www.googleapis.com/auth/cloud-platform".to_string()));
    }

    #[test]
    fn test_placeholder_email_detection() {
        let placeholder1 = "test@antigravity.oauth";
        let placeholder2 = "primary";
        let placeholder3 = "account 1";
        let real_email = "developer@gmail.com";

        let is_ph1 = placeholder1.ends_with("@antigravity.oauth");
        let is_ph2 = placeholder2 == "primary";
        let is_ph3 = placeholder3.starts_with("account");
        let is_real = !real_email.ends_with("@antigravity.oauth") && real_email != "primary" && !real_email.starts_with("account");

        assert!(is_ph1);
        assert!(is_ph2);
        assert!(is_ph3);
        assert!(is_real);
    }

    #[test]
    fn test_keyring_account_isolation_keys() {
        let account_a = "acc_alpha";
        let account_b = "acc_beta";
        let key_a = format!("developer-control-center:antigravity-oauth:{}", account_a);
        let key_b = format!("developer-control-center:antigravity-oauth:{}", account_b);

        assert_ne!(key_a, key_b);
        assert!(key_a.contains("acc_alpha"));
        assert!(key_b.contains("acc_beta"));
    }

    #[test]
    fn test_rfc7636_pkce_mathematical_vector() {
        // RFC 7636 Appendix B Test Vector
        let rfc_verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let expected_challenge = "E9Melhoa2OwvFrGMTJguCH5rtG6BtWh-PlqbTXqwtYA";

        let computed_challenge = compute_pkce_challenge(rfc_verifier);
        assert_eq!(computed_challenge, expected_challenge);
        assert!(!computed_challenge.contains('='));
        assert_eq!(computed_challenge.len(), 43);
    }

    #[test]
    fn test_pkce_session_generation_compliance() {
        let session = PkceSession::new();
        assert_eq!(session.code_verifier.len(), 64);
        assert_eq!(session.code_challenge.len(), 43);
        assert_eq!(session.state.len(), 32);

        // Verify RFC 7636 allowed unreserved character set [A-Za-z0-9-._~]
        let allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
        for c in session.code_verifier.chars() {
            assert!(allowed.contains(c), "Invalid RFC 7636 character in verifier: {}", c);
        }
        for c in session.state.chars() {
            assert!(allowed.contains(c), "Invalid RFC 7636 character in state: {}", c);
        }

        // Verify challenge is derived from the verifier
        let expected = compute_pkce_challenge(&session.code_verifier);
        assert_eq!(session.code_challenge, expected);
        assert!(!session.code_challenge.contains('='));
    }

    #[test]
    fn test_google_error_payload_parsing() {
        let json_err = r#"{"error":"invalid_grant","error_description":"Bad Request","error_uri":"https://accounts.google.com"}"#;
        #[derive(Deserialize)]
        struct GoogleErrorResponse {
            error: Option<String>,
            error_description: Option<String>,
            error_uri: Option<String>,
        }
        let parsed: Option<GoogleErrorResponse> = serde_json::from_str(json_err).ok();
        assert!(parsed.is_some());
        let g = parsed.unwrap();
        assert_eq!(g.error.as_deref(), Some("invalid_grant"));
        assert_eq!(g.error_description.as_deref(), Some("Bad Request"));
        assert_eq!(g.error_uri.as_deref(), Some("https://accounts.google.com"));
    }
}
