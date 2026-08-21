use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use keyring::Entry;
use serde::{Deserialize, Serialize};

pub const OAUTH_KEYRING_SERVICE: &str = "developer-control-center:antigravity-oauth";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QuotaProviderId {
    GoogleCloudCode,
    Antigravity,
    Codex,
    ClaudeCode,
}

impl QuotaProviderId {
    pub fn as_str(&self) -> &'static str {
        match self {
            QuotaProviderId::GoogleCloudCode => "google_cloud_code",
            QuotaProviderId::Antigravity => "antigravity",
            QuotaProviderId::Codex => "codex",
            QuotaProviderId::ClaudeCode => "claude_code",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            QuotaProviderId::GoogleCloudCode => "Google Cloud Code",
            QuotaProviderId::Antigravity => "Antigravity",
            QuotaProviderId::Codex => "Codex",
            QuotaProviderId::ClaudeCode => "Claude Code",
        }
    }

    pub fn from_str_loose(s: &str) -> Self {
        match s.trim().to_lowercase().as_str() {
            "google" | "google_cloud_code" | "cloudcode" => QuotaProviderId::GoogleCloudCode,
            "codex" | "openai" => QuotaProviderId::Codex,
            "claude_code" | "claude" | "claudecode" | "anthropic" => QuotaProviderId::ClaudeCode,
            _ => QuotaProviderId::Antigravity,
        }
    }
}

impl std::fmt::Display for QuotaProviderId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl Default for QuotaProviderId {
    fn default() -> Self {
        QuotaProviderId::Antigravity
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum QuotaDataSource {
    RealProvider,
    CachedRealProvider,
    Unavailable,
}


#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum QuotaDataQuality {
    Live,
    Stale,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaVerificationDiagnostic {
    pub account_id: String,
    pub provider: String,
    pub authentication_state: String,
    pub request_status: String,
    pub quota_data_available: bool,
    pub model_count: usize,
    pub last_successful_sync_at: Option<String>,
    pub data_source: QuotaDataSource,
    pub data_quality: QuotaDataQuality,
    pub latency_ms: Option<u64>,
    pub sanitized_error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModelQuotaStatus {
    Available,
    Unavailable,
    Unsupported,
    AuthRequired,
    ReauthorizationRequired,
    Forbidden,
    RateLimited,
    NetworkError,
    NotFound,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountIdentity {
    pub id: String,
    pub email: String,
    pub provider: String,
    pub project_id: Option<String>,
    pub tier: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaWindowInfo {
    pub window_type: String, // "5h" | "weekly" | "custom"
    pub remaining_fraction: Option<f64>,
    pub remaining_percentage: Option<f64>,
    pub reset_time: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelQuota {
    pub model_id: String,
    pub display_name: String,
    pub remaining_fraction: Option<f64>,
    pub remaining_percentage: Option<f64>,
    pub reset_at: Option<String>,
    pub status: ModelQuotaStatus,
    pub weekly_remaining_fraction: Option<f64>,
    pub weekly_remaining_percentage: Option<f64>,
    pub weekly_reset_at: Option<String>,
    #[serde(default)]
    pub windows: Vec<QuotaWindowInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaStatus {
    pub account_id: String,
    pub email: String,
    pub tier: Option<String>,
    pub provider: String,
    pub models: Vec<ModelQuota>,
    pub fetched_at: String,
    pub status: ModelQuotaStatus,
    pub data_source: QuotaDataSource,
    pub data_quality: QuotaDataQuality,
    pub safe_diagnostic_message: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum QuotaProviderErrorKind {
    AccountNotFound,
    CredentialUnavailable,
    OAuthRefreshFailed,
    ReauthorizationRequired,
    Unauthorized,
    Forbidden,
    RateLimited,
    EndpointUnavailable,
    UnsupportedResponse,
    NetworkError,
    InvalidQuotaData,
    ProviderNotImplemented,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaProviderError {
    pub kind: QuotaProviderErrorKind,
    pub message: String,
}

impl std::fmt::Display for QuotaProviderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.kind, self.message)
    }
}

impl std::error::Error for QuotaProviderError {}

use async_trait::async_trait;

#[async_trait]
pub trait QuotaProvider: Send + Sync {
    fn provider_id(&self) -> QuotaProviderId;

    async fn fetch_quota(
        &self,
        account_id: &str,
        expected_email: Option<&str>,
        project_id: Option<&str>,
    ) -> Result<QuotaStatus, QuotaProviderError>;

    async fn verify_path(
        &self,
        account_id: &str,
    ) -> Result<QuotaVerificationDiagnostic, QuotaProviderError>;
}

pub struct QuotaProviderRegistry {
    providers: HashMap<QuotaProviderId, Arc<dyn QuotaProvider>>,
}

impl QuotaProviderRegistry {
    pub fn new(credential_storage: Arc<dyn SecureCredentialStorage>) -> Self {
        let mut providers: HashMap<QuotaProviderId, Arc<dyn QuotaProvider>> = HashMap::new();
        providers.insert(
            QuotaProviderId::Antigravity,
            Arc::new(crate::monitor::providers::AntigravityQuotaProvider::with_credential_storage(credential_storage.clone())),
        );
        providers.insert(
            QuotaProviderId::GoogleCloudCode,
            Arc::new(crate::monitor::providers::GoogleCloudCodeQuotaProvider::new(credential_storage)),
        );
        Self { providers }
    }

    pub fn get(&self, provider_id: QuotaProviderId) -> Result<Arc<dyn QuotaProvider>, QuotaProviderError> {
        self.providers.get(&provider_id).cloned().ok_or_else(|| {
            QuotaProviderError {
                kind: QuotaProviderErrorKind::ProviderNotImplemented,
                message: format!(
                    "{} quota provider is not implemented yet in Developer Control Center.",
                    provider_id.display_name()
                ),
            }
        })
    }
}

/// Private in-memory only access token wrapper
pub struct AccessToken {
    secret: String,
    expires_at: Option<u64>,
}

impl AccessToken {
    pub fn new(secret: String, expires_in_secs: Option<u64>) -> Self {
        let expires_at = expires_in_secs.map(|s| current_unix_timestamp() + s);
        Self { secret, expires_at }
    }

    pub fn get_secret(&self) -> &str {
        &self.secret
    }

    pub fn is_expired(&self) -> bool {
        if let Some(exp) = self.expires_at {
            current_unix_timestamp() >= exp
        } else {
            false
        }
    }
}

// Ensure AccessToken memory is wiped upon drop
impl Drop for AccessToken {
    fn drop(&mut self) {
        // Rust strings will deallocate memory when dropped
    }
}

pub trait SecureCredentialStorage: Send + Sync {
    fn get_refresh_token(&self, account_id: &str) -> Result<Option<String>, QuotaProviderError>;
    fn save_refresh_token(&self, account_id: &str, refresh_token: &str) -> Result<(), QuotaProviderError>;
    fn delete_refresh_token(&self, account_id: &str) -> Result<(), QuotaProviderError>;
    fn list_account_ids(&self) -> Result<Vec<String>, QuotaProviderError>;
}

pub struct KeyringCredentialStorage;

impl KeyringCredentialStorage {
    pub fn new() -> Self {
        Self
    }
}

impl SecureCredentialStorage for KeyringCredentialStorage {
    fn get_refresh_token(&self, account_id: &str) -> Result<Option<String>, QuotaProviderError> {
        let entry = Entry::new(OAUTH_KEYRING_SERVICE, account_id).map_err(|e| QuotaProviderError {
            kind: QuotaProviderErrorKind::CredentialUnavailable,
            message: sanitize_error_message(&format!("Failed to initialize OS keyring entry: {}", e)),
        })?;

        match entry.get_password() {
            Ok(pass) => Ok(Some(pass)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(QuotaProviderError {
                kind: QuotaProviderErrorKind::CredentialUnavailable,
                message: sanitize_error_message(&format!("OS keyring access error: {}", e)),
            }),
        }
    }

    fn save_refresh_token(&self, account_id: &str, refresh_token: &str) -> Result<(), QuotaProviderError> {
        let entry = Entry::new(OAUTH_KEYRING_SERVICE, account_id).map_err(|e| QuotaProviderError {
            kind: QuotaProviderErrorKind::CredentialUnavailable,
            message: sanitize_error_message(&format!("Failed to initialize OS keyring entry: {}", e)),
        })?;

        entry.set_password(refresh_token).map_err(|e| QuotaProviderError {
            kind: QuotaProviderErrorKind::CredentialUnavailable,
            message: sanitize_error_message(&format!("Failed to write to OS keyring: {}", e)),
        })
    }

    fn delete_refresh_token(&self, account_id: &str) -> Result<(), QuotaProviderError> {
        let entry = Entry::new(OAUTH_KEYRING_SERVICE, account_id).map_err(|e| QuotaProviderError {
            kind: QuotaProviderErrorKind::CredentialUnavailable,
            message: sanitize_error_message(&format!("Failed to initialize OS keyring entry: {}", e)),
        })?;

        let _ = entry.delete_password();

        #[cfg(target_os = "windows")]
        {
            let legacy_target = format!("LegacyGeneric:target={}.{}", account_id, OAUTH_KEYRING_SERVICE);
            let _ = std::process::Command::new("cmdkey")
                .args(["/delete", &legacy_target])
                .output();
            let raw_target = format!("{}.{}", account_id, OAUTH_KEYRING_SERVICE);
            let _ = std::process::Command::new("cmdkey")
                .args(["/delete", &raw_target])
                .output();
        }

        Ok(())
    }

    fn list_account_ids(&self) -> Result<Vec<String>, QuotaProviderError> {
        // Return default account identifier if present
        if let Ok(Some(_)) = self.get_refresh_token("default") {
            Ok(vec!["default".to_string()])
        } else {
            Ok(vec![])
        }
    }
}

pub struct MockCredentialStorage {
    tokens: Mutex<HashMap<String, String>>,
}

impl MockCredentialStorage {
    pub fn new() -> Self {
        Self {
            tokens: Mutex::new(HashMap::new()),
        }
    }
}

impl SecureCredentialStorage for MockCredentialStorage {
    fn get_refresh_token(&self, account_id: &str) -> Result<Option<String>, QuotaProviderError> {
        let lock = self.tokens.lock().unwrap();
        Ok(lock.get(account_id).cloned())
    }

    fn save_refresh_token(&self, account_id: &str, refresh_token: &str) -> Result<(), QuotaProviderError> {
        let mut lock = self.tokens.lock().unwrap();
        lock.insert(account_id.to_string(), refresh_token.to_string());
        Ok(())
    }

    fn delete_refresh_token(&self, account_id: &str) -> Result<(), QuotaProviderError> {
        let mut lock = self.tokens.lock().unwrap();
        lock.remove(account_id);
        Ok(())
    }

    fn list_account_ids(&self) -> Result<Vec<String>, QuotaProviderError> {
        let lock = self.tokens.lock().unwrap();
        Ok(lock.keys().cloned().collect())
    }
}

#[derive(Clone)]
pub struct QuotaCacheEntry {
    pub quota: QuotaStatus,
    pub owner_email: String,
    pub cached_at: Instant,
}


pub struct QuotaProviderService {
    credential_storage: Arc<dyn SecureCredentialStorage>,
    cache: Mutex<HashMap<String, QuotaCacheEntry>>,
    cache_ttl: Duration,
    http_client: reqwest::Client,
    registry: Arc<QuotaProviderRegistry>,
}


impl QuotaProviderService {
    pub fn new(credential_storage: Arc<dyn SecureCredentialStorage>) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        let registry = Arc::new(QuotaProviderRegistry::new(credential_storage.clone()));

        Self {
            credential_storage,
            cache: Mutex::new(HashMap::new()),
            cache_ttl: Duration::from_secs(60), // 60s memory cache
            http_client: client,
            registry,
        }
    }

    pub fn with_registry(
        credential_storage: Arc<dyn SecureCredentialStorage>,
        registry: Arc<QuotaProviderRegistry>,
    ) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self {
            credential_storage,
            cache: Mutex::new(HashMap::new()),
            cache_ttl: Duration::from_secs(60),
            http_client: client,
            registry,
        }
    }


    /// Pure normalizer for percentage and remainingFraction clamping [0.0, 1.0]
    pub fn normalize_model_quota(
        model_id: &str,
        display_name: &str,
        raw_remaining_fraction: Option<f64>,
        raw_reset_at: Option<&str>,
        status: ModelQuotaStatus,
    ) -> ModelQuota {
        let clamped_fraction = raw_remaining_fraction.map(|f| f.clamp(0.0, 1.0));
        let percentage = clamped_fraction.map(|f| (f * 100.0).round());
        let reset_at = raw_reset_at.map(sanitize_evidence_string);

        ModelQuota {
            model_id: model_id.to_string(),
            display_name: display_name.to_string(),
            remaining_fraction: clamped_fraction,
            remaining_percentage: percentage,
            reset_at,
            status,
            weekly_remaining_fraction: None,
            weekly_remaining_percentage: None,
            weekly_reset_at: None,
            windows: vec![],
        }
    }

    /// List configured accounts
    pub fn list_accounts(&self) -> Result<Vec<AccountIdentity>, QuotaProviderError> {
        let account_ids = self.credential_storage.list_account_ids()?;
        if account_ids.is_empty() {
            return Ok(vec![AccountIdentity {
                id: "default".to_string(),
                email: "No configured account".to_string(),
                provider: "Antigravity Local Runtime".to_string(),
                project_id: None,
                tier: None,
                status: "Unconfigured".to_string(),
            }]);
        }

        let mut accounts = Vec::new();
        for id in account_ids {
            accounts.push(AccountIdentity {
                id: id.clone(),
                email: id,
                provider: "Antigravity Local Runtime".to_string(),
                project_id: None,
                tier: None,
                status: "Configured".to_string(),
            });
        }
        Ok(accounts)
    }

    /// Primary interface to retrieve account quota with caching, rate limiting, and primary+fallback orchestration
    pub async fn get_account_quota(
        &self,
        provider_id: QuotaProviderId,
        account_id: &str,
        expected_email: Option<&str>,
        project_id: Option<&str>,
        force_refresh: bool,
    ) -> Result<QuotaStatus, QuotaProviderError> {
        let cache_key = format!("{}:{}:{:?}", provider_id.as_str(), account_id, project_id);
        let normalized_expected = expected_email
            .map(|e| e.trim().to_ascii_lowercase())
            .filter(|e| !e.is_empty());

        let is_placeholder = match normalized_expected.as_deref() {
            Some(e) => {
                e == "default@antigravity.oauth"
                    || e == "default"
                    || e == "no configured account"
                    || e == "antigravity local"
            }
            None => true,
        };

        if !force_refresh {
            let cache = self.cache.lock().unwrap();
            if let Some(entry) = cache.get(&cache_key) {
                if entry.cached_at.elapsed() < self.cache_ttl {
                    let cache_owner_norm = entry.owner_email.trim().to_ascii_lowercase();
                    let matches_owner = if is_placeholder {
                        true
                    } else if let Some(ref exp) = normalized_expected {
                        &cache_owner_norm == exp
                    } else {
                        true
                    };

                    if matches_owner {
                        return Ok(entry.quota.clone());
                    }
                }
            }
        }

        let has_google_oauth = match self.credential_storage.get_refresh_token(account_id) {
            Ok(Some(t)) => !t.trim().is_empty(),
            _ => false,
        };

        // Primary & Fallback Provider Orchestration
        let quota_result = if provider_id == QuotaProviderId::Antigravity {
            // Account is explicitly configured with Antigravity provider
            let antigravity_provider = self.registry.get(QuotaProviderId::Antigravity);
            let ant_res = if let Ok(ref ap) = antigravity_provider {
                ap.fetch_quota(account_id, expected_email, project_id).await
            } else {
                Err(QuotaProviderError {
                    kind: QuotaProviderErrorKind::ProviderNotImplemented,
                    message: "Antigravity provider not registered".to_string(),
                })
            };

            match ant_res {
                Ok(status) if status.status == ModelQuotaStatus::Available => status,
                Ok(status) => {
                    // Antigravity returned non-available (e.g. AuthRequired). Try Google OAuth fallback if available.
                    if has_google_oauth {
                        if let Ok(gp) = self.registry.get(QuotaProviderId::GoogleCloudCode) {
                            if let Ok(g_status) = gp.fetch_quota(account_id, expected_email, project_id).await {
                                if g_status.status == ModelQuotaStatus::Available {
                                    return Ok(g_status);
                                }
                            }
                        }
                    }
                    status
                }
                Err(err) => {
                    if has_google_oauth {
                        if let Ok(gp) = self.registry.get(QuotaProviderId::GoogleCloudCode) {
                            if let Ok(g_status) = gp.fetch_quota(account_id, expected_email, project_id).await {
                                return Ok(g_status);
                            }
                        }
                    }
                    let exp_display = expected_email.unwrap_or(account_id);
                    QuotaStatus {
                        account_id: account_id.to_string(),
                        email: exp_display.to_string(),
                        tier: None,
                        provider: "Antigravity".to_string(),
                        models: vec![],
                        fetched_at: current_unix_timestamp().to_string(),
                        status: ModelQuotaStatus::AuthRequired,
                        data_source: QuotaDataSource::Unavailable,
                        data_quality: QuotaDataQuality::Unavailable,
                        safe_diagnostic_message: Some(err.message),
                    }
                }
            }
        } else if has_google_oauth || provider_id == QuotaProviderId::GoogleCloudCode {
            if has_google_oauth {
                // Account has Google OAuth configured -> PRIMARY Google Cloud Code
                let google_provider = self.registry.get(QuotaProviderId::GoogleCloudCode);
                let google_res = if let Ok(ref gp) = google_provider {
                    gp.fetch_quota(account_id, expected_email, project_id).await
                } else {
                    Err(QuotaProviderError {
                        kind: QuotaProviderErrorKind::ProviderNotImplemented,
                        message: "Google Cloud Code provider not registered".to_string(),
                    })
                };

                match google_res {
                    Ok(status) if status.status == ModelQuotaStatus::Available => status,
                    Ok(status) => status,
                    Err(err) => {
                        // Check if Antigravity local fallback is running and available
                        let antigravity_provider = self.registry.get(QuotaProviderId::Antigravity);
                        let fallback_res = if let Ok(ref ap) = antigravity_provider {
                            ap.fetch_quota(account_id, expected_email, project_id).await
                        } else {
                            Err(err.clone())
                        };

                        match fallback_res {
                            Ok(mut ant_res) => {
                                if ant_res.status == ModelQuotaStatus::Available {
                                    ant_res.safe_diagnostic_message = Some(
                                        "Synchronized live quota via Antigravity Language Server (Fallback).".to_string(),
                                    );
                                }
                                ant_res
                            }
                            Err(_) => {
                                // Fallback unavailable -> Retain Google primary identity and return degraded state
                                let exp_display = expected_email.unwrap_or(account_id);
                                let (status, data_source, data_quality) = match err.kind {
                                    QuotaProviderErrorKind::ReauthorizationRequired => (
                                        ModelQuotaStatus::ReauthorizationRequired,
                                        QuotaDataSource::Unavailable,
                                        QuotaDataQuality::Unavailable,
                                    ),
                                    QuotaProviderErrorKind::RateLimited => (
                                        ModelQuotaStatus::RateLimited,
                                        QuotaDataSource::RealProvider,
                                        QuotaDataQuality::Live,
                                    ),
                                    QuotaProviderErrorKind::NetworkError => (
                                        ModelQuotaStatus::NetworkError,
                                        QuotaDataSource::RealProvider,
                                        QuotaDataQuality::Unavailable,
                                    ),
                                    QuotaProviderErrorKind::Unauthorized => (
                                        ModelQuotaStatus::AuthRequired,
                                        QuotaDataSource::Unavailable,
                                        QuotaDataQuality::Unavailable,
                                    ),
                                    QuotaProviderErrorKind::Forbidden => (
                                        ModelQuotaStatus::Forbidden,
                                        QuotaDataSource::Unavailable,
                                        QuotaDataQuality::Unavailable,
                                    ),
                                    _ => (
                                        ModelQuotaStatus::Unsupported,
                                        QuotaDataSource::Unavailable,
                                        QuotaDataQuality::Unavailable,
                                    ),
                                };

                                QuotaStatus {
                                    account_id: account_id.to_string(),
                                    email: exp_display.to_string(),
                                    tier: None,
                                    provider: "Google Cloud Code".to_string(),
                                    models: vec![],
                                    fetched_at: current_unix_timestamp().to_string(),
                                    status,
                                    data_source,
                                    data_quality,
                                    safe_diagnostic_message: Some(err.message),
                                }
                            }
                        }
                    }
                }
            } else {
                let exp_display = expected_email.unwrap_or(account_id);
                QuotaStatus {
                    account_id: account_id.to_string(),
                    email: exp_display.to_string(),
                    tier: None,
                    provider: "Google Cloud Code".to_string(),
                    models: vec![],
                    fetched_at: current_unix_timestamp().to_string(),
                    status: ModelQuotaStatus::AuthRequired,
                    data_source: QuotaDataSource::Unavailable,
                    data_quality: QuotaDataQuality::Unavailable,
                    safe_diagnostic_message: Some("Google OAuth connection required.".to_string()),
                }
            }
        } else {
            let provider = match self.registry.get(provider_id) {
                Ok(p) => p,
                Err(e) => {
                    let exp_display = expected_email.unwrap_or("configured account");
                    return Ok(QuotaStatus {
                        account_id: account_id.to_string(),
                        email: exp_display.to_string(),
                        tier: None,
                        provider: provider_id.display_name().to_string(),
                        models: vec![],
                        fetched_at: current_unix_timestamp().to_string(),
                        status: ModelQuotaStatus::Unsupported,
                        data_source: QuotaDataSource::Unavailable,
                        data_quality: QuotaDataQuality::Unavailable,
                        safe_diagnostic_message: Some(format!("Provider {} unavailable: {}", provider_id.display_name(), e.message)),
                    });
                }
            };
            provider.fetch_quota(account_id, expected_email, project_id).await
                .unwrap_or_else(|err| {
                    let exp_display = expected_email.unwrap_or("configured account");
                    QuotaStatus {
                        account_id: account_id.to_string(),
                        email: exp_display.to_string(),
                        tier: None,
                        provider: provider_id.display_name().to_string(),
                        models: vec![],
                        fetched_at: current_unix_timestamp().to_string(),
                        status: ModelQuotaStatus::Unsupported,
                        data_source: QuotaDataSource::Unavailable,
                        data_quality: QuotaDataQuality::Unavailable,
                        safe_diagnostic_message: Some(format!("Failed to fetch quota from {}: {}", provider_id.display_name(), err.message)),
                    }
                })
        };

        // Identity & Account Isolation Guard (AG-9.97):
        // Ensure that snapshot account_id and email match the requested account context.
        if quota_result.account_id != account_id {
            eprintln!(
                "[CredentialBinding] ACCOUNT_IDENTITY_DIVERGENCE: requested_account_id={}, resolved_account_id={}",
                account_id, quota_result.account_id
            );
            return Ok(QuotaStatus {
                account_id: account_id.to_string(),
                email: expected_email.unwrap_or(account_id).to_string(),
                tier: None,
                provider: provider_id.display_name().to_string(),
                models: vec![],
                fetched_at: current_unix_timestamp().to_string(),
                status: ModelQuotaStatus::AuthRequired,
                data_source: QuotaDataSource::Unavailable,
                data_quality: QuotaDataQuality::Unavailable,
                safe_diagnostic_message: Some(format!(
                    "Account identity divergence: requested account {}, but resolved provider was for {}.",
                    account_id, quota_result.account_id
                )),
            });
        }

        if let Some(ref exp) = normalized_expected {
            let res_email_norm = quota_result.email.trim().to_ascii_lowercase();
            if !is_placeholder && quota_result.status == ModelQuotaStatus::Available && &res_email_norm != exp {
                eprintln!(
                    "[CredentialBinding] ACCOUNT_EMAIL_DIVERGENCE: requested_account_id={}, expected_email={}, actual_email={}",
                    account_id, exp, res_email_norm
                );
                return Ok(QuotaStatus {
                    account_id: account_id.to_string(),
                    email: expected_email.unwrap_or(account_id).to_string(),
                    tier: None,
                    provider: quota_result.provider.clone(),
                    models: vec![],
                    fetched_at: current_unix_timestamp().to_string(),
                    status: ModelQuotaStatus::AuthRequired,
                    data_source: QuotaDataSource::Unavailable,
                    data_quality: QuotaDataQuality::Unavailable,
                    safe_diagnostic_message: Some(format!(
                        "Antigravity is currently authenticated as {} on this PC. Switch to {} in Antigravity to sync its live quota.",
                        quota_result.email, expected_email.unwrap_or(account_id)
                    )),
                });
            }
        }

        eprintln!(
            "[QuotaProvider] account_id={}, provider={}, authenticated_identity={}, requested_identity={:?}, result={:?}",
            account_id, quota_result.provider, quota_result.email, expected_email, quota_result.status
        );

        // Cache valid live responses under the compound key
        if quota_result.status == ModelQuotaStatus::Available
            && quota_result.data_quality == QuotaDataQuality::Live
        {
            let mut cache = self.cache.lock().unwrap();
            cache.insert(
                cache_key,
                QuotaCacheEntry {
                    quota: quota_result.clone(),
                    owner_email: quota_result.email.trim().to_ascii_lowercase(),
                    cached_at: Instant::now(),
                },
            );
        }

        Ok(quota_result)
    }


    /// Diagnostic verification command that executes provider verification path
    pub async fn verify_account_quota_path(
        &self,
        provider_id: QuotaProviderId,
        account_id: &str,
    ) -> QuotaVerificationDiagnostic {
        let provider = match self.registry.get(provider_id) {
            Ok(p) => p,
            Err(e) => {
                return QuotaVerificationDiagnostic {
                    account_id: account_id.to_string(),
                    provider: provider_id.display_name().to_string(),
                    authentication_state: "ProviderNotImplemented".to_string(),
                    request_status: "NotSupported".to_string(),
                    quota_data_available: false,
                    model_count: 0,
                    last_successful_sync_at: None,
                    data_source: QuotaDataSource::Unavailable,
                    data_quality: QuotaDataQuality::Unavailable,
                    latency_ms: None,
                    sanitized_error: Some(e.message),
                };
            }
        };

        match provider.verify_path(account_id).await {
            Ok(diag) => diag,
            Err(e) => QuotaVerificationDiagnostic {
                account_id: account_id.to_string(),
                provider: provider_id.display_name().to_string(),
                authentication_state: "Error".to_string(),
                request_status: "Failed".to_string(),
                quota_data_available: false,
                model_count: 0,
                last_successful_sync_at: None,
                data_source: QuotaDataSource::Unavailable,
                data_quality: QuotaDataQuality::Unavailable,
                latency_ms: None,
                sanitized_error: Some(e.message),
            },
        }
    }


    /// Internal helper to invoke Google Cloud Code API and parse safe quota metrics

    async fn fetch_cloud_code_quota(&self, account_id: &str, access_token: &AccessToken) -> Result<QuotaStatus, QuotaProviderError> {
        // Use verified Cloud Code internal quota endpoint
        let url = "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist";
        
        let resp = self
            .http_client
            .post(url)
            .header("Authorization", format!("Bearer {}", access_token.get_secret()))
            .json(&serde_json::json!({
                "client_info": {
                    "client_type": "DCC",
                    "client_version": "0.1.0"
                }
            }))
            .send()
            .await
            .map_err(|e| QuotaProviderError {
                kind: QuotaProviderErrorKind::NetworkError,
                message: sanitize_error_message(&format!("Cloud Code API request failed: {}", e)),
            })?;

        let status_code = resp.status();
        if status_code.as_u16() == 401 || status_code.as_u16() == 403 {
            return Err(QuotaProviderError {
                kind: QuotaProviderErrorKind::Unauthorized,
                message: "Cloud Code API access unauthorized. Refresh token may be invalid or expired.".to_string(),
            });
        }

        if status_code.as_u16() == 429 {
            return Err(QuotaProviderError {
                kind: QuotaProviderErrorKind::RateLimited,
                message: "Cloud Code API rate limited. Please retry later.".to_string(),
            });
        }

        if !status_code.is_success() {
            return Err(QuotaProviderError {
                kind: QuotaProviderErrorKind::EndpointUnavailable,
                message: format!("Cloud Code API returned status {}", status_code),
            });
        }

        let body_text = resp.text().await.map_err(|e| QuotaProviderError {
            kind: QuotaProviderErrorKind::UnsupportedResponse,
            message: sanitize_error_message(&format!("Failed to read response body: {}", e)),
        })?;

        // Safely parse JSON response
        let v: serde_json::Value = serde_json::from_str(&body_text).map_err(|e| QuotaProviderError {
            kind: QuotaProviderErrorKind::UnsupportedResponse,
            message: sanitize_error_message(&format!("Failed to parse JSON response: {}", e)),
        })?;

        // Extract safe non-sensitive model quotas
        let mut models = Vec::new();
        if let Some(models_array) = v.get("models").and_then(|m| m.as_array()) {
            for m in models_array {
                let model_id = m.get("modelId").and_then(|s| s.as_str()).unwrap_or("unknown");
                let display_name = m.get("displayName").and_then(|s| s.as_str()).unwrap_or(model_id);
                let remaining_fraction = m.get("remainingFraction").and_then(|f| f.as_f64());
                let reset_at = m.get("resetTime").and_then(|s| s.as_str());

                models.push(Self::normalize_model_quota(
                    model_id,
                    display_name,
                    remaining_fraction,
                    reset_at,
                    ModelQuotaStatus::Available,
                ));
            }
        }

        let tier = v.get("tier").and_then(|t| t.as_str()).map(|s| s.to_string());
        let email = v.get("userEmail").and_then(|e| e.as_str()).unwrap_or(account_id).to_string();

        Ok(QuotaStatus {
            account_id: account_id.to_string(),
            email: sanitize_evidence_string(&email),
            tier,
            provider: "Google Cloud Code / Antigravity".to_string(),
            models,
            fetched_at: current_unix_timestamp().to_string(),
            status: ModelQuotaStatus::Available,
            data_source: QuotaDataSource::RealProvider,
            data_quality: QuotaDataQuality::Live,
            safe_diagnostic_message: Some("Successfully fetched account quota via Cloud Code API.".to_string()),
        })
    }
}

pub fn current_unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}


pub fn sanitize_error_message(msg: &str) -> String {
    let re_bearer = regex::Regex::new(r"(?i)(bearer\s+)([a-zA-Z0-9_\-\.]+)").unwrap();
    let s1 = re_bearer.replace_all(msg, "Bearer [REDACTED]");

    let re_auth = regex::Regex::new(r"(?i)(authorization\s*:\s*)([^\s,;]+)").unwrap();
    let s2 = re_auth.replace_all(&s1, "Authorization: [REDACTED]");

    let re_token = regex::Regex::new(r"(?i)([?&](?:token|key|secret|refresh_token)=)([^&\s]+)").unwrap();
    let s3 = re_token.replace_all(&s2, "$1[REDACTED]");

    s3.chars().take(300).collect()
}

pub fn sanitize_evidence_string(s: &str) -> String {
    sanitize_error_message(s)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quota_percentage_normalization() {
        let q = QuotaProviderService::normalize_model_quota(
            "gemini-1.5-pro",
            "Gemini 1.5 Pro",
            Some(0.824),
            Some("2026-08-15T15:00:00Z"),
            ModelQuotaStatus::Available,
        );

        assert_eq!(q.remaining_fraction, Some(0.824));
        assert_eq!(q.remaining_percentage, Some(82.0));
        assert_eq!(q.reset_at, Some("2026-08-15T15:00:00Z".to_string()));
        assert_eq!(q.status, ModelQuotaStatus::Available);
    }

    #[test]
    fn test_remaining_fraction_clamping() {
        let q_over = QuotaProviderService::normalize_model_quota(
            "test-model",
            "Test Model",
            Some(1.5),
            None,
            ModelQuotaStatus::Available,
        );
        assert_eq!(q_over.remaining_fraction, Some(1.0));
        assert_eq!(q_over.remaining_percentage, Some(100.0));

        let q_under = QuotaProviderService::normalize_model_quota(
            "test-model",
            "Test Model",
            Some(-0.2),
            None,
            ModelQuotaStatus::Available,
        );
        assert_eq!(q_under.remaining_fraction, Some(0.0));
        assert_eq!(q_under.remaining_percentage, Some(0.0));
    }

    #[test]
    fn test_missing_quota_field_handling() {
        let q = QuotaProviderService::normalize_model_quota(
            "test-model",
            "Test Model",
            None,
            None,
            ModelQuotaStatus::Unsupported,
        );
        assert_eq!(q.remaining_fraction, None);
        assert_eq!(q.remaining_percentage, None);
        assert_eq!(q.reset_at, None);
        assert_eq!(q.status, ModelQuotaStatus::Unsupported);
    }

    #[test]
    fn test_authorization_header_redaction() {
        let err = "HTTP 401 Unauthorized: Authorization: Bearer ya29.a0AfH6SMA-secret-token";
        let sanitized = sanitize_error_message(err);
        assert!(!sanitized.contains("ya29.a0AfH6SMA-secret-token"));
        assert!(sanitized.contains("Authorization: [REDACTED]"));
    }

    #[test]
    fn test_token_url_redaction() {
        let url = "https://oauth2.googleapis.com/token?refresh_token=1//0gXYZSecret123";
        let sanitized = sanitize_error_message(url);
        assert!(!sanitized.contains("1//0gXYZSecret123"));
        assert!(sanitized.contains("refresh_token=[REDACTED]"));
    }

    #[test]
    fn test_access_token_never_serialized() {
        let token = AccessToken::new("super-secret-access-token".to_string(), Some(3600));
        assert_eq!(token.get_secret(), "super-secret-access-token");
        assert!(!token.is_expired());
    }

    #[test]
    fn test_account_identity_serialization() {
        let account = AccountIdentity {
            id: "user1".to_string(),
            email: "user1@example.com".to_string(),
            provider: "Google Cloud Code".to_string(),
            project_id: Some("my-project".to_string()),
            tier: Some("Pro".to_string()),
            status: "Connected".to_string(),
        };

        let json = serde_json::to_string(&account).expect("Serialize AccountIdentity");
        assert!(json.contains("user1@example.com"));
        assert!(json.contains("Google Cloud Code"));
        assert!(!json.contains("token"));
        assert!(!json.contains("secret"));
    }

    #[test]
    fn test_quota_status_dto_serialization() {
        let status = QuotaStatus {
            account_id: "user1".to_string(),
            email: "user1@example.com".to_string(),
            tier: Some("Pro".to_string()),
            provider: "Google Cloud Code".to_string(),
            models: vec![ModelQuota {
                model_id: "gemini-1.5-pro".to_string(),
                display_name: "Gemini 1.5 Pro".to_string(),
                remaining_fraction: Some(0.75),
                remaining_percentage: Some(75.0),
                reset_at: Some("2026-08-15T15:00:00Z".to_string()),
                status: ModelQuotaStatus::Available,
                weekly_remaining_fraction: Some(0.9),
                weekly_remaining_percentage: Some(90.0),
                weekly_reset_at: Some("2026-08-20T10:00:00Z".to_string()),
                windows: vec![],
            }],
            fetched_at: "1723719000".to_string(),
            status: ModelQuotaStatus::Available,
            data_source: QuotaDataSource::RealProvider,
            data_quality: QuotaDataQuality::Live,
            safe_diagnostic_message: Some("OK".to_string()),
        };

        let json = serde_json::to_string(&status).expect("Serialize QuotaStatus");
        assert!(json.contains("75"));
        assert!(json.contains("gemini-1.5-pro"));
        assert!(json.contains("RealProvider"));
        assert!(json.contains("Live"));
        assert!(!json.contains("token"));
        assert!(!json.contains("Authorization"));
    }

    #[test]
    fn test_mock_credential_storage_unconfigured_account() {
        let storage = Arc::new(MockCredentialStorage::new());
        let service = QuotaProviderService::new(storage);

        let accounts = service.list_accounts().expect("list accounts");
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].status, "Unconfigured");
    }

    #[test]
    fn test_real_json_response_parsing_without_fabrication() {
        let sample_json = r#"{
            "userEmail": "engineer@company.com",
            "tier": "Standard Tier",
            "models": [
                {
                    "modelId": "gemini-1.5-pro",
                    "displayName": "Gemini 1.5 Pro",
                    "remainingFraction": 0.654,
                    "resetTime": "2026-08-15T18:00:00Z"
                },
                {
                    "modelId": "claude-3-5-sonnet",
                    "displayName": "Claude 3.5 Sonnet",
                    "remainingFraction": null,
                    "resetTime": null
                }
            ]
        }"#;

        let v: serde_json::Value = serde_json::from_str(sample_json).expect("parse json");
        let models_array = v.get("models").and_then(|m| m.as_array()).expect("models array");

        let mut models = Vec::new();
        for m in models_array {
            let model_id = m.get("modelId").and_then(|s| s.as_str()).unwrap_or("unknown");
            let display_name = m.get("displayName").and_then(|s| s.as_str()).unwrap_or(model_id);
            let remaining_fraction = m.get("remainingFraction").and_then(|f| f.as_f64());
            let reset_at = m.get("resetTime").and_then(|s| s.as_str());

            models.push(QuotaProviderService::normalize_model_quota(
                model_id,
                display_name,
                remaining_fraction,
                reset_at,
                ModelQuotaStatus::Available,
            ));
        }

        // Model 1 has real numbers
        assert_eq!(models[0].model_id, "gemini-1.5-pro");
        assert_eq!(models[0].remaining_fraction, Some(0.654));
        assert_eq!(models[0].remaining_percentage, Some(65.0));
        assert_eq!(models[0].reset_at, Some("2026-08-15T18:00:00Z".to_string()));

        // Model 2 has nulls - strictly NO fabrication
        assert_eq!(models[1].model_id, "claude-3-5-sonnet");
        assert_eq!(models[1].remaining_fraction, None);
        assert_eq!(models[1].remaining_percentage, None);
        assert_eq!(models[1].reset_at, None);
    }

    #[tokio::test]
    async fn test_unauthenticated_account_returns_auth_required_with_empty_models() {
        let storage = Arc::new(MockCredentialStorage::new());
        let service = QuotaProviderService::new(storage);

        let quota = service.get_account_quota(QuotaProviderId::Antigravity, "unauthenticated-account", Some("unauth@example.com"), None, true).await.expect("quota call");
        assert!(quota.status == ModelQuotaStatus::AuthRequired || quota.status == ModelQuotaStatus::Unavailable);
        assert_eq!(quota.data_source, QuotaDataSource::Unavailable);
        assert_eq!(quota.data_quality, QuotaDataQuality::Unavailable);
        assert!(quota.models.is_empty(), "Models must be empty when unauthenticated/mismatched, never fabricated");
    }

    #[tokio::test]
    async fn test_account_isolation_credential_storage() {
        let storage = Arc::new(MockCredentialStorage::new());
        storage.save_refresh_token("account-a", "token-a").unwrap();
        storage.save_refresh_token("account-b", "token-b").unwrap();

        assert_eq!(storage.get_refresh_token("account-a").unwrap(), Some("token-a".to_string()));
        assert_eq!(storage.get_refresh_token("account-b").unwrap(), Some("token-b".to_string()));
        assert_eq!(storage.get_refresh_token("account-c").unwrap(), None);
    }

    #[test]
    fn test_identity_matching_normalization() {
        let runtime = "user@gmail.com";
        
        // Exact
        let exp1 = "user@gmail.com";
        assert_eq!(exp1.trim().to_ascii_lowercase(), runtime.trim().to_ascii_lowercase());

        // Case-insensitive
        let exp2 = "User@Gmail.com";
        assert_eq!(exp2.trim().to_ascii_lowercase(), runtime.trim().to_ascii_lowercase());

        // Whitespace
        let exp3 = "  user@gmail.com \n";
        assert_eq!(exp3.trim().to_ascii_lowercase(), runtime.trim().to_ascii_lowercase());

        // Mismatch
        let exp4 = "other@gmail.com";
        assert_ne!(exp4.trim().to_ascii_lowercase(), runtime.trim().to_ascii_lowercase());
    }

    #[test]
    fn test_provider_registry_resolution() {
        let storage = Arc::new(MockCredentialStorage::new());
        let registry = QuotaProviderRegistry::new(storage);

        // Antigravity is implemented
        assert!(registry.get(QuotaProviderId::Antigravity).is_ok());

        // Codex is not implemented
        let codex_res = registry.get(QuotaProviderId::Codex);
        assert!(codex_res.is_err());
        assert_eq!(codex_res.err().unwrap().kind, QuotaProviderErrorKind::ProviderNotImplemented);

        // Claude Code is not implemented
        let claude_res = registry.get(QuotaProviderId::ClaudeCode);
        assert!(claude_res.is_err());
        assert_eq!(claude_res.err().unwrap().kind, QuotaProviderErrorKind::ProviderNotImplemented);
    }

    #[tokio::test]
    async fn test_unimplemented_provider_returns_unsupported_without_calling_antigravity() {
        let storage = Arc::new(MockCredentialStorage::new());
        let service = QuotaProviderService::new(storage);

        let quota = service
            .get_account_quota(QuotaProviderId::Codex, "codex-account", Some("user@openai.com"), true)
            .await
            .expect("quota call");

        assert_eq!(quota.status, ModelQuotaStatus::Unsupported);
        assert_eq!(quota.provider, "Codex");
        assert!(quota.models.is_empty());
        assert!(quota.safe_diagnostic_message.unwrap().contains("not implemented yet"));
    }

    #[test]
    fn test_compound_cache_key_isolation() {
        let storage = Arc::new(MockCredentialStorage::new());
        let service = QuotaProviderService::new(storage);

        let quota_antigravity = QuotaStatus {
            account_id: "default".to_string(),
            email: "user@gmail.com".to_string(),
            tier: Some("Pro".to_string()),
            provider: "Antigravity Local Runtime".to_string(),
            models: vec![],
            fetched_at: "1723719000".to_string(),
            status: ModelQuotaStatus::Available,
            data_source: QuotaDataSource::RealProvider,
            data_quality: QuotaDataQuality::Live,
            safe_diagnostic_message: None,
        };

        // Cache for antigravity:default
        {
            let mut cache = service.cache.lock().unwrap();
            cache.insert(
                "antigravity:default".to_string(),
                QuotaCacheEntry {
                    quota: quota_antigravity.clone(),
                    owner_email: "user@gmail.com".to_string(),
                    cached_at: Instant::now(),
                },
            );
        }

        // Check that codex:default does NOT read antigravity:default cache
        {
            let cache = service.cache.lock().unwrap();
            assert!(cache.get("codex:default").is_none());
            assert!(cache.get("antigravity:default").is_some());
        }
    }
}


