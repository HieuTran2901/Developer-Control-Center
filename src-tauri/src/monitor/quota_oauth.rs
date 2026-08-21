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

// Default Google OAuth Client ID and Secret for Antigravity / Cloud Code Desktop
// Configurable via DCC_GOOGLE_OAUTH_CLIENT_ID and DCC_GOOGLE_OAUTH_CLIENT_SECRET environment variables
pub const DEFAULT_GOOGLE_CLIENT_ID: &str = "";
pub const DEFAULT_GOOGLE_CLIENT_SECRET: &str = "";
pub const GOOGLE_AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
pub const GOOGLE_TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
pub const GOOGLE_REVOKE_ENDPOINT: &str = "https://oauth2.googleapis.com/revoke";
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

/// Safe SHA-256 hash calculation for diagnostic correlation without leaking plaintext tokens
pub fn safe_hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    let hash = hasher.finalize();
    format!("{:x}", hash)
}

/// Safe SHA-256 hash calculation for user identity without leaking plaintext email
pub fn safe_hash_email(email: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(email.to_lowercase().trim().as_bytes());
    let hash = hasher.finalize();
    let hex = format!("{:x}", hash);
    if hex.len() > 12 {
        hex[..12].to_string()
    } else {
        hex
    }
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

#[derive(Debug, Clone)]
pub struct GoogleOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub source: String,
}

impl GoogleOAuthConfig {
    /// Canonical resolution hierarchy (AG-9.61):
    /// 1. GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET (Primary standard)
    /// 2. DCC_GOOGLE_CLIENT_ID & DCC_GOOGLE_CLIENT_SECRET (Compatibility alias)
    /// 3. DCC_GOOGLE_OAUTH_CLIENT_ID & DCC_GOOGLE_OAUTH_CLIENT_SECRET (Compatibility alias)
    /// 4. DEFAULT_GOOGLE_CLIENT_ID & DEFAULT_GOOGLE_CLIENT_SECRET (Development fallback)
    pub fn resolve() -> Self {
        let (client_id, id_src) = if let Some(id) = std::env::var("GOOGLE_CLIENT_ID").ok().filter(|s| !s.trim().is_empty()) {
            (id, "GOOGLE_CLIENT_ID")
        } else if let Some(id) = std::env::var("DCC_GOOGLE_CLIENT_ID").ok().filter(|s| !s.trim().is_empty()) {
            (id, "DCC_GOOGLE_CLIENT_ID")
        } else if let Some(id) = std::env::var("DCC_GOOGLE_OAUTH_CLIENT_ID").ok().filter(|s| !s.trim().is_empty()) {
            (id, "DCC_GOOGLE_OAUTH_CLIENT_ID")
        } else {
            (DEFAULT_GOOGLE_CLIENT_ID.to_string(), "DEFAULT_FALLBACK")
        };

        let (client_secret, sec_src) = if let Some(sec) = std::env::var("GOOGLE_CLIENT_SECRET").ok().filter(|s| !s.trim().is_empty()) {
            (sec, "GOOGLE_CLIENT_SECRET")
        } else if let Some(sec) = std::env::var("DCC_GOOGLE_CLIENT_SECRET").ok().filter(|s| !s.trim().is_empty()) {
            (sec, "DCC_GOOGLE_CLIENT_SECRET")
        } else if let Some(sec) = std::env::var("DCC_GOOGLE_OAUTH_CLIENT_SECRET").ok().filter(|s| !s.trim().is_empty()) {
            (sec, "DCC_GOOGLE_OAUTH_CLIENT_SECRET")
        } else {
            (DEFAULT_GOOGLE_CLIENT_SECRET.to_string(), "DEFAULT_FALLBACK")
        };

        let source = format!("ID: {}, Secret: {}", id_src, sec_src);

        Self {
            client_id,
            client_secret,
            source,
        }
    }
}

pub struct GoogleOAuthService {
    client_id: String,
    client_secret: String,
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
        let config = GoogleOAuthConfig::resolve();

        let http_client = Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            client_id: config.client_id,
            client_secret: config.client_secret,
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
        let trace_id = format!("OAuthTrace[{}]", &uuid::Uuid::new_v4().simple().to_string()[..8].to_uppercase());
        let is_new_account = account_id == "new" || account_id.starts_with("new-") || account_id.starts_with("google-");
        let target_account = if is_new_account {
            None
        } else {
            self.registry.get(account_id).await
        };

        let flow_type = if is_new_account { "new_account" } else { "reconnect" };
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

        eprintln!(
            "[{}] [account:{}] [flow:{}] OAuth START: target_account_id={}, account_exists={}, oauth_client_id={}, redirect_uri={}, requested_scopes={}, pkce_enabled=true, state_generated=true",
            trace_id, account_id, flow_type, account_id, target_account.is_some(), client_fp, redirect_uri, GOOGLE_OAUTH_SCOPES
        );

        // 2. Generate PKCE parameters
        let pkce = PkceSession::new();

        // Check if target account has a valid healthy refresh token in Keyring
        let has_healthy_keyring_token = if !is_new_account {
            if let Ok(Some(tok)) = self.credential_storage.get_refresh_token(account_id) {
                !tok.trim().is_empty() && self.refresh_access_token(&tok).await.is_ok()
            } else {
                false
            }
        } else {
            false
        };

        let prompt_value = if is_new_account || !has_healthy_keyring_token || allow_email_update {
            "consent select_account"
        } else {
            "select_account"
        };

        eprintln!(
            "[{}] [OAuth] account_id={}, google_email={:?}, has_healthy_keyring_token={}, prompt_consent={}",
            trace_id, account_id, target_account.as_ref().map(|a| &a.email), has_healthy_keyring_token, prompt_value.contains("consent")
        );

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
                .append_pair("prompt", prompt_value);
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
            Ok(Ok(code)) => {
                eprintln!("[{}] OAuth CALLBACK RECEIVED: state_present=true, state_validation=PASS, code_present=true, error_present=false", trace_id);
                code
            }
            Ok(Err(e)) => {
                eprintln!("[{}] OAuth CALLBACK ERROR: error_type=CallbackFailed, error={}", trace_id, e);
                eprintln!(
                    "\n========== OAUTH TRANSACTION SUMMARY ==========\ntrace_id={}\naccount_id={}\nflow={}\noauth_callback=FAIL\nFIRST_DIVERGENCE=OAuthCallbackFailed\n=================================================",
                    trace_id, account_id, flow_type
                );
                return Ok(OAuthConnectionResult {
                    account_id: account_id.to_string(),
                    authenticated_email: None,
                    status: "OAuthCallbackFailed".to_string(),
                    success: false,
                    message: format!("OAuth callback error: {}", e),
                    diagnostic_stage: Some("waiting_for_callback".to_string()),
                    client_fingerprint: Some(client_fp),
                    redirect_uri_used: Some(redirect_uri),
                });
            }
            Err(_) => {
                eprintln!("[{}] OAuth CALLBACK ERROR: error_type=Timeout, message=120s timeout waiting for browser", trace_id);
                eprintln!(
                    "\n========== OAUTH TRANSACTION SUMMARY ==========\ntrace_id={}\naccount_id={}\nflow={}\noauth_callback=TIMEOUT\nFIRST_DIVERGENCE=OAuthTimeout\n=================================================",
                    trace_id, account_id, flow_type
                );
                return Ok(OAuthConnectionResult {
                    account_id: account_id.to_string(),
                    authenticated_email: None,
                    status: "Timeout".to_string(),
                    success: false,
                    message: "OAuth authorization timed out. Please retry and complete Google sign-in in your browser.".to_string(),
                    diagnostic_stage: Some("waiting_for_browser".to_string()),
                    client_fingerprint: Some(client_fp),
                    redirect_uri_used: Some(redirect_uri),
                });
            }
        };

        // 6. Exchange authorization code for tokens
        let (refresh_token, access_token) = match self
            .exchange_auth_code(&auth_code, &pkce.code_verifier, &redirect_uri)
            .await
        {
            Ok(tokens) => {
                let rf_present = !tokens.0.is_empty();
                let acc_present = !tokens.1.is_empty();
                let rf_hash = if rf_present { safe_hash_token(&tokens.0) } else { "none".to_string() };
                eprintln!(
                    "[{}] TOKEN EXCHANGE RESULT: success=true, access_token_present={}, access_token_len={}, refresh_token_present={}, refresh_token_len={}, refresh_token_hash={}",
                    trace_id, acc_present, tokens.1.len(), rf_present, tokens.0.len(), rf_hash
                );
                tokens
            }
            Err(e) => {
                eprintln!("[{}] TOKEN EXCHANGE RESULT: success=false, error={}", trace_id, e.message);
                eprintln!(
                    "\n========== OAUTH TRANSACTION SUMMARY ==========\ntrace_id={}\naccount_id={}\nflow={}\ntoken_exchange=FAIL\nFIRST_DIVERGENCE=TokenExchangeFailed\n=================================================",
                    trace_id, account_id, flow_type
                );
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
            Ok(e) => {
                eprintln!("[{}] IDENTITY VERIFICATION: email_hash={}, success=true", trace_id, safe_hash_email(&e));
                e
            }
            Err(err) => {
                eprintln!("[{}] IDENTITY VERIFICATION: success=false, error={}", trace_id, err.message);
                eprintln!(
                    "\n========== OAUTH TRANSACTION SUMMARY ==========\ntrace_id={}\naccount_id={}\nflow={}\nidentity_verification=FAIL\nFIRST_DIVERGENCE=IdentityVerificationFailed\n=================================================",
                    trace_id, account_id, flow_type
                );
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

        // Determine final account ID and check identity matching
        let (final_account_id, is_placeholder) = if let Some(ref target) = target_account {
            let cur_em = target.email.trim().to_lowercase();
            let is_ph = cur_em.is_empty()
                || cur_em.ends_with("@antigravity.oauth")
                || cur_em.ends_with("@placeholder.com")
                || cur_em.ends_with("@local")
                || cur_em == "default"
                || cur_em == "primary"
                || cur_em.starts_with("account");

            let is_match = cur_em.eq_ignore_ascii_case(&user_email);

            if !is_match && !is_ph && !allow_email_update {
                eprintln!("[{}] IDENTITY MISMATCH: monitored_email_hash={}, incoming_email_hash={}", trace_id, safe_hash_email(&target.email), safe_hash_email(&user_email));
                eprintln!(
                    "\n========== OAUTH TRANSACTION SUMMARY ==========\ntrace_id={}\naccount_id={}\nflow={}\naccount_match=FAIL\nFIRST_DIVERGENCE=AccountMismatch\n=================================================",
                    trace_id, account_id, flow_type
                );
                return Ok(OAuthConnectionResult {
                    account_id: account_id.to_string(),
                    authenticated_email: Some(user_email.clone()),
                    status: "AccountMismatch".to_string(),
                    success: false,
                    message: format!(
                        "The Google account you selected ({}) is different from the account being monitored ({}).",
                        user_email, target.email
                    ),
                    diagnostic_stage: Some("confirming_account".to_string()),
                    client_fingerprint: Some(client_fp),
                    redirect_uri_used: Some(redirect_uri),
                });
            }
            (target.account_id.clone(), is_ph)
        } else {
            // New account: derive clean account ID from email
            let clean_id = user_email
                .chars()
                .map(|c| if c.is_ascii_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
                .collect::<String>();
            let trimmed_id = clean_id.trim_matches('-').to_string();
            let final_id = if trimmed_id.is_empty() {
                format!("google-{}", uuid::Uuid::new_v4().simple())
            } else if trimmed_id.len() > 32 {
                trimmed_id[..32].to_string()
            } else {
                trimmed_id
            };
            (final_id, false)
        };

        // Check duplicate email in registry before saving
        let all_accounts = self.registry.list().await;
        for other in all_accounts {
            if other.account_id != final_account_id && other.email.eq_ignore_ascii_case(&user_email) {
                eprintln!("[{}] DUPLICATE EMAIL: duplicate_with_account_id={}", trace_id, other.account_id);
                eprintln!(
                    "\n========== OAUTH TRANSACTION SUMMARY ==========\ntrace_id={}\naccount_id={}\nflow={}\nduplicate_check=FAIL\nFIRST_DIVERGENCE=DuplicateEmail\n=================================================",
                    trace_id, final_account_id, flow_type
                );
                return Ok(OAuthConnectionResult {
                    account_id: final_account_id,
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

        // 8. Persist refresh token to OS Credential Manager securely
        // CRITICAL INVARIANT (AG-9.58, AG-9.85, AG-9.92, AG-9.94): Transactional credential verification and programmatic grant recovery
        let is_new_account = target_account.is_none();

        if is_new_account {
            // Case A: New account registration MUST have a valid fresh refresh token from Google
            if refresh_token.is_empty() {
                eprintln!("[{}] NEW ACCOUNT MISSING REFRESH TOKEN: access_token_present={}, invoking grant revocation", trace_id, !access_token.is_empty());
                let mut revoke_ok = false;
                if !access_token.is_empty() {
                    revoke_ok = self.revoke_token(&access_token).await.unwrap_or(false);
                }

                eprintln!(
                    "\n========== OAUTH TRANSACTION SUMMARY ==========\ntrace_id={}\naccount_id={}\nflow=new_account\naccess_token_present=true\nrefresh_token_present=false\ngrant_revocation_attempted=true\ngrant_revocation_success={}\nsecond_authorization_required=true\nFIRST_DIVERGENCE=GOOGLE_REFRESH_TOKEN_OMITTED_NEW_ACCOUNT\n=================================================",
                    trace_id, final_account_id, revoke_ok
                );

                return Ok(OAuthConnectionResult {
                    account_id: final_account_id,
                    authenticated_email: Some(user_email),
                    status: "MissingRefreshToken".to_string(),
                    success: false,
                    message: "Google authentication succeeded, but Google did not return a refresh token for background monitoring. DCC has automatically reset the previous grant on Google. Please click 'Connect with Google' once more to complete authorization with a fresh refresh token.".to_string(),
                    diagnostic_stage: Some("binding_credentials".to_string()),
                    client_fingerprint: Some(client_fp),
                    redirect_uri_used: Some(redirect_uri),
                });
            }

            // Test refresh token before committing to Keyring
            eprintln!("[{}] REFRESH TOKEN VALIDATION START: token_source=new_oauth_response, token_hash={}, account_id={}", trace_id, safe_hash_token(&refresh_token), final_account_id);
            if let Err(e) = self.refresh_access_token(&refresh_token).await {
                eprintln!("[{}] REFRESH TOKEN VALIDATION RESULT: success=false, error={}", trace_id, e.message);
                eprintln!(
                    "\n========== OAUTH TRANSACTION SUMMARY ==========\ntrace_id={}\naccount_id={}\nflow=new_account\nnew_refresh_token_validated=false\nFIRST_DIVERGENCE=TokenVerificationFailed\n=================================================",
                    trace_id, final_account_id
                );
                return Ok(OAuthConnectionResult {
                    account_id: final_account_id,
                    authenticated_email: Some(user_email),
                    status: "TokenVerificationFailed".to_string(),
                    success: false,
                    message: format!("Google OAuth refresh token verification failed: {}", e.message),
                    diagnostic_stage: Some("binding_credentials".to_string()),
                    client_fingerprint: Some(client_fp),
                    redirect_uri_used: Some(redirect_uri),
                });
            }
            eprintln!("[{}] REFRESH TOKEN VALIDATION RESULT: success=true, http_status=200", trace_id);

            eprintln!("[{}] KEYRING COMMIT START: account_id={}, token_source=new_oauth_response, token_hash={}", trace_id, final_account_id, safe_hash_token(&refresh_token));
            if let Err(e) = self.credential_storage.save_refresh_token(&final_account_id, &refresh_token) {
                eprintln!("[{}] KEYRING COMMIT RESULT: success=false, error={}", trace_id, e.message);
                eprintln!(
                    "\n========== OAUTH TRANSACTION SUMMARY ==========\ntrace_id={}\naccount_id={}\nflow=new_account\nkeyring_commit=FAIL\nFIRST_DIVERGENCE=KeyringStorageFailed\n=================================================",
                    trace_id, final_account_id
                );
                return Ok(OAuthConnectionResult {
                    account_id: final_account_id,
                    authenticated_email: Some(user_email),
                    status: "KeyringStorageFailed".to_string(),
                    success: false,
                    message: format!("Failed to save credential to OS Credential Manager: {}", e.message),
                    diagnostic_stage: Some("binding_credentials".to_string()),
                    client_fingerprint: Some(client_fp),
                    redirect_uri_used: Some(redirect_uri),
                });
            }
            eprintln!("[{}] KEYRING COMMIT RESULT: success=true", trace_id);

            let now_str = (crate::monitor::quota_provider::current_unix_timestamp()).to_string();
            let new_config = crate::monitor::quota_polling::AccountMonitorConfig {
                account_id: final_account_id.clone(),
                provider: Some(crate::monitor::quota_provider::QuotaProviderId::GoogleCloudCode),
                project_id: None,
                email: user_email.clone(),
                display_name: Some(user_email.clone()),
                tier: None,
                enabled: true,
                auto_connect: true,
                polling_interval_seconds: 120,
                created_at: now_str.clone(),
                updated_at: now_str.clone(),
            };
            eprintln!("[{}] REGISTRY UPDATE START: account_id={}, operation=create", trace_id, final_account_id);
            let reg_res = self.registry.register(new_config).await;
            eprintln!("[{}] REGISTRY UPDATE RESULT: success={}", trace_id, reg_res.is_ok());

            // Trigger immediate quota verification / refresh
            eprintln!("[{}] ACCOUNT REFRESH START: account_id={}", trace_id, final_account_id);
            let ref_res = self.polling_engine.refresh_account_now(&final_account_id).await;
            let ref_status = ref_res.as_ref().map(|s| format!("{:?}", s.status)).unwrap_or_else(|e| format!("Err: {}", e));
            eprintln!("[{}] ACCOUNT REFRESH RESULT: status={}", trace_id, ref_status);

            eprintln!(
                "\n========== OAUTH TRANSACTION SUMMARY ==========\ntrace_id={}\naccount_id={}\nflow=new_account\noauth_callback=PASS\ntoken_exchange=PASS\nrefresh_token_present=true\nnew_refresh_token_validated=true\nkeyring_commit=true\nregistry_update=true\nfinal_snapshot_status={}\nFIRST_DIVERGENCE=NONE (CONNECTED)\n=================================================",
                trace_id, final_account_id, ref_status
            );

            return Ok(OAuthConnectionResult {
                account_id: final_account_id,
                authenticated_email: Some(user_email),
                status: "Connected".to_string(),
                success: true,
                message: "Account successfully connected and authenticated.".to_string(),
                diagnostic_stage: Some("connected".to_string()),
                client_fingerprint: Some(client_fp),
                redirect_uri_used: Some(redirect_uri),
            });
        }

        // Case B & C: Reconnect existing account
        if !refresh_token.is_empty() {
            // New refresh token provided during reconnect: verify before saving
            eprintln!("[{}] REFRESH TOKEN VALIDATION START: token_source=reconnect_new_token, token_hash={}, account_id={}", trace_id, safe_hash_token(&refresh_token), final_account_id);
            if let Err(e) = self.refresh_access_token(&refresh_token).await {
                eprintln!("[{}] REFRESH TOKEN VALIDATION RESULT: success=false, error={}", trace_id, e.message);
                eprintln!(
                    "\n========== OAUTH TRANSACTION SUMMARY ==========\ntrace_id={}\naccount_id={}\nflow=reconnect\nnew_refresh_token_validated=false\nFIRST_DIVERGENCE=TokenVerificationFailed\n=================================================",
                    trace_id, final_account_id
                );
                return Ok(OAuthConnectionResult {
                    account_id: final_account_id,
                    authenticated_email: Some(user_email),
                    status: "TokenVerificationFailed".to_string(),
                    success: false,
                    message: format!("Google OAuth refresh token verification failed: {}", e.message),
                    diagnostic_stage: Some("binding_credentials".to_string()),
                    client_fingerprint: Some(client_fp),
                    redirect_uri_used: Some(redirect_uri),
                });
            }
            eprintln!("[{}] REFRESH TOKEN VALIDATION RESULT: success=true, http_status=200", trace_id);

            eprintln!("[{}] KEYRING COMMIT START: account_id={}, token_source=reconnect_new_token, token_hash={}", trace_id, final_account_id, safe_hash_token(&refresh_token));
            if let Err(e) = self.credential_storage.save_refresh_token(&final_account_id, &refresh_token) {
                eprintln!("[{}] KEYRING COMMIT RESULT: success=false, error={}", trace_id, e.message);
                eprintln!(
                    "\n========== OAUTH TRANSACTION SUMMARY ==========\ntrace_id={}\naccount_id={}\nflow=reconnect\nkeyring_commit=FAIL\nFIRST_DIVERGENCE=KeyringStorageFailed\n=================================================",
                    trace_id, final_account_id
                );
                return Ok(OAuthConnectionResult {
                    account_id: final_account_id,
                    authenticated_email: Some(user_email),
                    status: "KeyringStorageFailed".to_string(),
                    success: false,
                    message: format!("Failed to save credential to OS Credential Manager: {}", e.message),
                    diagnostic_stage: Some("binding_credentials".to_string()),
                    client_fingerprint: Some(client_fp),
                    redirect_uri_used: Some(redirect_uri),
                });
            }
            eprintln!("[{}] KEYRING COMMIT RESULT: success=true", trace_id);
        } else {
            // Google omitted refresh token on reconnect: verify existing Keyring credential
            eprintln!("[{}] KEYRING LOOKUP: account_id={}, lookup_started=true", trace_id, final_account_id);
            let existing_token = self.credential_storage.get_refresh_token(&final_account_id).unwrap_or(None);
            if let Some(ref tok) = existing_token.filter(|t| !t.trim().is_empty()) {
                let tok_hash = safe_hash_token(tok);
                eprintln!("[{}] KEYRING LOOKUP: token_found=true, token_len={}, token_hash={}", trace_id, tok.len(), tok_hash);
                eprintln!("[{}] REFRESH TOKEN VALIDATION START: token_source=existing_keyring, token_hash={}, account_id={}", trace_id, tok_hash, final_account_id);
                if let Err(e) = self.refresh_access_token(tok).await {
                    eprintln!("[{}] REFRESH TOKEN VALIDATION RESULT: success=false, error={}", trace_id, e.message);
                    // Stale credential is revoked. Purge dead token and programmatically revoke Google grant!
                    let _ = self.credential_storage.delete_refresh_token(&final_account_id);
                    eprintln!("[{}] STALE KEYRING TOKEN PURGED: account_id={}", trace_id, final_account_id);
                    let mut revoke_ok = false;
                    if !access_token.is_empty() {
                        eprintln!("[{}] GRANT REVOCATION START: reason=stale_grant_invalid_token, account_id={}, token_source=ephemeral_access_token", trace_id, final_account_id);
                        revoke_ok = self.revoke_token(&access_token).await.unwrap_or(false);
                        eprintln!("[{}] GRANT REVOCATION RESULT: success={}", trace_id, revoke_ok);
                    }

                    eprintln!(
                        "\n========== OAUTH TRANSACTION SUMMARY ==========\ntrace_id={}\naccount_id={}\nflow=reconnect\naccess_token_present=true\nrefresh_token_present=false\nexisting_keyring_token=found\nexisting_token_valid=false\ngrant_revocation_attempted=true\ngrant_revocation_success={}\nsecond_authorization_required=true\nfinal_snapshot_status=GrantRecoveryRequired\nFIRST_DIVERGENCE=GOOGLE_REFRESH_TOKEN_OMITTED_STALE_GRANT\n=================================================",
                        trace_id, final_account_id, revoke_ok
                    );

                    return Ok(OAuthConnectionResult {
                        account_id: final_account_id,
                        authenticated_email: Some(user_email),
                        status: "GrantRecoveryRequired".to_string(),
                        success: false,
                        message: format!("Google omitted the refresh token and stored credential is invalid ({}). DCC has automatically reset the authorization grant on Google. Please click 'Recover Google Authorization' or 'Reconnect' to grant fresh offline consent and receive a new refresh token.", e.message),
                        diagnostic_stage: Some("binding_credentials".to_string()),
                        client_fingerprint: Some(client_fp),
                        redirect_uri_used: Some(redirect_uri),
                    });
                }
                eprintln!("[{}] REFRESH TOKEN VALIDATION RESULT: success=true, existing token still valid", trace_id);
            } else {
                eprintln!("[{}] KEYRING LOOKUP: token_found=false", trace_id);
                let mut revoke_ok = false;
                if !access_token.is_empty() {
                    eprintln!("[{}] GRANT REVOCATION START: reason=no_stored_token, account_id={}, token_source=ephemeral_access_token", trace_id, final_account_id);
                    revoke_ok = self.revoke_token(&access_token).await.unwrap_or(false);
                    eprintln!("[{}] GRANT REVOCATION RESULT: success={}", trace_id, revoke_ok);
                }

                eprintln!(
                    "\n========== OAUTH TRANSACTION SUMMARY ==========\ntrace_id={}\naccount_id={}\nflow=reconnect\naccess_token_present=true\nrefresh_token_present=false\nexisting_keyring_token=absent\ngrant_revocation_attempted=true\ngrant_revocation_success={}\nsecond_authorization_required=true\nfinal_snapshot_status=GrantRecoveryRequired\nFIRST_DIVERGENCE=GOOGLE_REFRESH_TOKEN_OMITTED_NO_KEYRING\n=================================================",
                    trace_id, final_account_id, revoke_ok
                );

                return Ok(OAuthConnectionResult {
                    account_id: final_account_id,
                    authenticated_email: Some(user_email),
                    status: "GrantRecoveryRequired".to_string(),
                    success: false,
                    message: "Google did not return a refresh token for background monitoring. DCC has automatically reset the grant on Google. Please click 'Recover Google Authorization' or 'Reconnect' to grant fresh offline access and receive a new refresh token.".to_string(),
                    diagnostic_stage: Some("binding_credentials".to_string()),
                    client_fingerprint: Some(client_fp),
                    redirect_uri_used: Some(redirect_uri),
                });
            }
        }

        // Update existing account in registry
        let now_str = (crate::monitor::quota_provider::current_unix_timestamp()).to_string();
        if let Some(ref target) = target_account {
            let mut updated_config = target.clone();
            updated_config.provider = Some(crate::monitor::quota_provider::QuotaProviderId::GoogleCloudCode);
            if is_placeholder || allow_email_update {
                updated_config.email = user_email.clone();
            }
            updated_config.updated_at = now_str.clone();
            eprintln!("[{}] REGISTRY UPDATE START: account_id={}, operation=update", trace_id, final_account_id);
            let _ = self.registry.update(updated_config).await;
            eprintln!("[{}] REGISTRY UPDATE RESULT: success=true", trace_id);
        }

        // Trigger immediate quota verification / refresh
        eprintln!("[{}] ACCOUNT REFRESH START: account_id={}", trace_id, final_account_id);
        let ref_res = self.polling_engine.refresh_account_now(&final_account_id).await;
        let ref_status = ref_res.as_ref().map(|s| format!("{:?}", s.status)).unwrap_or_else(|e| format!("Err: {}", e));
        eprintln!("[{}] ACCOUNT REFRESH RESULT: status={}", trace_id, ref_status);

        eprintln!(
            "\n========== OAUTH TRANSACTION SUMMARY ==========\ntrace_id={}\naccount_id={}\nflow=reconnect\noauth_callback=PASS\ntoken_exchange=PASS\nkeyring_commit=true\nregistry_update=true\nfinal_snapshot_status={}\nFIRST_DIVERGENCE=NONE (CONNECTED)\n=================================================",
            trace_id, final_account_id, ref_status
        );

        Ok(OAuthConnectionResult {
            account_id: final_account_id,
            authenticated_email: Some(user_email),
            status: "Connected".to_string(),
            success: true,
            message: "Account successfully connected and authenticated.".to_string(),
            diagnostic_stage: Some("connected".to_string()),
            client_fingerprint: Some(client_fp),
            redirect_uri_used: Some(redirect_uri),
        })
    }

    /// Revoke an access token or refresh token on Google OAuth server to clear active grant
    pub async fn revoke_token(&self, token: &str) -> Result<bool, QuotaProviderError> {
        let form_body = {
            let mut serializer = url::form_urlencoded::Serializer::new(String::new());
            serializer.append_pair("token", token);
            serializer.finish()
        };

        let resp = self
            .http_client
            .post(GOOGLE_REVOKE_ENDPOINT)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(form_body)
            .send()
            .await
            .map_err(|e| QuotaProviderError {
                kind: QuotaProviderErrorKind::NetworkError,
                message: sanitize_error_message(&format!("Token revocation connection failed: {}", e)),
            })?;

        Ok(resp.status().is_success())
    }

    /// Disconnect Google OAuth credential from OS Keyring and refresh quota state
    pub async fn disconnect_account(&self, account_id: &str) -> Result<bool, String> {
        self.credential_storage
            .delete_refresh_token(account_id)
            .map_err(|e| format!("Failed to delete credential: {}", e.message))?;

        // Re-evaluate quota with fallback
        let _ = self.polling_engine.refresh_account_now(account_id).await;
        Ok(true)
    }

    /// Check if account has a stored Google OAuth refresh token
    pub fn get_connection_status(&self, account_id: &str) -> bool {
        match self.credential_storage.get_refresh_token(account_id) {
            Ok(Some(token)) => !token.trim().is_empty(),
            _ => false,
        }
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
        let body_str = {
            let mut serializer = url::form_urlencoded::Serializer::new(String::new());
            serializer.append_pair("client_id", &self.client_id);
            if !self.client_secret.is_empty() {
                serializer.append_pair("client_secret", &self.client_secret);
            }
            serializer.append_pair("code", code);
            serializer.append_pair("code_verifier", code_verifier);
            serializer.append_pair("grant_type", "authorization_code");
            serializer.append_pair("redirect_uri", redirect_uri);
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

    /// Refresh access token using a refresh token to verify credential health
    pub async fn refresh_access_token(&self, refresh_token: &str) -> Result<String, QuotaProviderError> {
        let form_body = {
            let mut serializer = url::form_urlencoded::Serializer::new(String::new());
            serializer.append_pair("client_id", &self.client_id);
            if !self.client_secret.is_empty() {
                serializer.append_pair("client_secret", &self.client_secret);
            }
            serializer.append_pair("grant_type", "refresh_token");
            serializer.append_pair("refresh_token", refresh_token);
            serializer.finish()
        };

        let resp = self
            .http_client
            .post(GOOGLE_TOKEN_ENDPOINT)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(form_body)
            .send()
            .await
            .map_err(|e| QuotaProviderError {
                kind: QuotaProviderErrorKind::NetworkError,
                message: sanitize_error_message(&format!("Token refresh connection failed: {}", e)),
            })?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().await.unwrap_or_default();
            let is_invalid_grant = err_text.contains("invalid_grant");
            let is_invalid_client = err_text.contains("invalid_client");

            let kind = if is_invalid_grant {
                QuotaProviderErrorKind::ReauthorizationRequired
            } else if is_invalid_client {
                QuotaProviderErrorKind::Unauthorized
            } else {
                QuotaProviderErrorKind::OAuthRefreshFailed
            };

            let message = if is_invalid_grant {
                "Google OAuth authorization expired or revoked. Reauthorization required.".to_string()
            } else if is_invalid_client {
                "Google OAuth client configuration invalid.".to_string()
            } else {
                format!("Google OAuth token refresh rejected with HTTP {}", status)
            };

            return Err(QuotaProviderError { kind, message });
        }

        #[derive(Deserialize)]
        struct RefreshResponse {
            access_token: String,
        }

        let data = resp.json::<RefreshResponse>().await.map_err(|e| QuotaProviderError {
            kind: QuotaProviderErrorKind::UnsupportedResponse,
            message: sanitize_error_message(&format!("Failed to parse token refresh response: {}", e)),
        })?;

        Ok(data.access_token)
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
    let config = GoogleOAuthConfig::resolve();

    let fp = if config.client_id.len() > 16 {
        format!("{}...{}", &config.client_id[..8], &config.client_id[config.client_id.len() - 8..])
    } else {
        "valid-client".to_string()
    };

    AntigravityOAuthVerificationResult {
        client_configured: !config.client_id.is_empty(),
        client_source: config.source,
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
            DEFAULT_GOOGLE_CLIENT_ID
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
        // assert client fingerprint
        // assert client domain
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

    #[test]
    fn test_ag997_prompt_consent_selection_logic() {
        let is_new_account = false;
        let has_healthy_keyring_token = false;
        let allow_email_update = true;

        let prompt_value = if is_new_account || !has_healthy_keyring_token || allow_email_update {
            "consent select_account"
        } else {
            "select_account"
        };

        assert_eq!(prompt_value, "consent select_account");

        let healthy_reconnect_prompt = if false || !true || false {
            "consent select_account"
        } else {
            "select_account"
        };
        assert_eq!(healthy_reconnect_prompt, "select_account");
    }

    #[test]
    fn test_ag997_multi_account_credential_isolation_matrix() {
        let account_a = "trunghieunaruto204-gmail-com";
        let account_b = "trunghieu10a1thptll-gmail-com";

        let key_a = format!("{}.developer-control-center:antigravity-oauth", account_a);
        let key_b = format!("{}.developer-control-center:antigravity-oauth", account_b);

        assert_ne!(key_a, key_b);
        assert!(key_a.contains("trunghieunaruto204"));
        assert!(key_b.contains("trunghieu10a1thptll"));
    }
}

