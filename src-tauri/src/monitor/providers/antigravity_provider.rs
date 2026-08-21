use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;

use crate::monitor::antigravity_discovery::AntigravityDiscovery;
use crate::monitor::antigravity_quota::AntigravityQuotaClient;
use crate::monitor::antigravity_headless_worker::HeadlessAntigravityManager;
use crate::monitor::providers::google_cloud_code_provider::GoogleCloudCodeQuotaProvider;
use crate::monitor::quota_provider::{
    current_unix_timestamp, ModelQuota, ModelQuotaStatus, QuotaDataSource, QuotaDataQuality,
    QuotaProvider, QuotaProviderError, QuotaProviderId, QuotaStatus,
    QuotaVerificationDiagnostic, SecureCredentialStorage,
};

pub struct AntigravityQuotaProvider {
    client: Arc<AntigravityQuotaClient>,
    headless_manager: Arc<HeadlessAntigravityManager>,
    cloud_provider: Option<Arc<GoogleCloudCodeQuotaProvider>>,
}

impl AntigravityQuotaProvider {
    pub fn new() -> Self {
        Self {
            client: Arc::new(AntigravityQuotaClient::new()),
            headless_manager: Arc::new(HeadlessAntigravityManager::new()),
            cloud_provider: None,
        }
    }

    pub fn with_credential_storage(credential_storage: Arc<dyn SecureCredentialStorage>) -> Self {
        Self {
            client: Arc::new(AntigravityQuotaClient::new()),
            headless_manager: Arc::new(HeadlessAntigravityManager::new()),
            cloud_provider: Some(Arc::new(GoogleCloudCodeQuotaProvider::new(credential_storage))),
        }
    }

    pub fn with_client(client: Arc<AntigravityQuotaClient>) -> Self {
        Self {
            client,
            headless_manager: Arc::new(HeadlessAntigravityManager::new()),
            cloud_provider: None,
        }
    }

    pub fn map_snapshot_to_quota_status(
        account_id: &str,
        expected_email: Option<&str>,
        snap: crate::monitor::antigravity_quota::AntigravityQuotaSnapshot,
        success_msg: &str,
    ) -> QuotaStatus {
        let runtime_email_raw = snap
            .account_identity
            .clone()
            .unwrap_or_else(|| expected_email.unwrap_or("unknown@antigravity.local").to_string());

        let mut models = Vec::new();
        for m in snap.models {
            let fraction = m.remaining_fraction;
            let percentage = m
                .remaining_percent
                .or_else(|| fraction.map(|f| (f * 100.0).round()));

            let weekly_fraction = m.weekly_remaining_fraction;
            let weekly_percentage = m
                .weekly_remaining_percent
                .or_else(|| weekly_fraction.map(|f| (f * 100.0).round()));

            models.push(ModelQuota {
                model_id: m.model_id.clone(),
                display_name: m.display_name.unwrap_or(m.model_id),
                remaining_fraction: fraction,
                remaining_percentage: percentage,
                reset_at: m.reset_time,
                status: ModelQuotaStatus::Available,
                weekly_remaining_fraction: weekly_fraction,
                weekly_remaining_percentage: weekly_percentage,
                weekly_reset_at: m.weekly_reset_time,
                windows: m.windows,
            });
        }

        QuotaStatus {
            account_id: account_id.to_string(),
            email: runtime_email_raw,
            tier: snap.plan_name.or(snap.tier),
            provider: "Antigravity Local Runtime".to_string(),
            models,
            fetched_at: snap.fetched_at,
            status: ModelQuotaStatus::Available,
            data_source: QuotaDataSource::RealProvider,
            data_quality: QuotaDataQuality::Live,
            safe_diagnostic_message: Some(success_msg.to_string()),
        }
    }
}

#[async_trait]
impl QuotaProvider for AntigravityQuotaProvider {
    fn provider_id(&self) -> QuotaProviderId {
        QuotaProviderId::Antigravity
    }

    async fn fetch_quota(
        &self,
        account_id: &str,
        expected_email: Option<&str>,
        project_id: Option<&str>,
    ) -> Result<QuotaStatus, QuotaProviderError> {
        let start_time = Instant::now();
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

        // 1. Try to find an existing running Antigravity IDE instance
        let mut runtimes = AntigravityDiscovery::discover_all_runtimes().unwrap_or_default();

        let mut target_runtime = if is_placeholder && account_id == "default" {
            runtimes.first().cloned()
        } else if let Some(ref exp) = normalized_expected {
            self.client.find_matching_runtime_for_email(exp, &runtimes).await
        } else {
            runtimes.first().cloned()
        };

        if target_runtime.is_none() && !runtimes.is_empty() {
            runtimes = AntigravityDiscovery::discover_all_runtimes().unwrap_or_default();
            target_runtime = if is_placeholder && account_id == "default" {
                runtimes.first().cloned()
            } else if let Some(ref exp) = normalized_expected {
                self.client.find_matching_runtime_for_email(exp, &runtimes).await
            } else {
                runtimes.first().cloned()
            };
        }

        // 2. If an active runtime matches this account, query it directly
        if let Some(runtime) = target_runtime {
            if let Ok(snap) = self.client.fetch_quota_from_runtime(&runtime).await {
                HeadlessAntigravityManager::snapshot_active_session_to_account(account_id);
                let duration_ms = start_time.elapsed().as_millis();
                eprintln!(
                    "[AG_QUOTA] account_id={}, expected_email={:?}, source=active_runtime, runtime_pid={}, returned_email={:?}, identity_match=true, duration_ms={}",
                    account_id, expected_email, runtime.process_id, snap.account_identity, duration_ms
                );
                return Ok(Self::map_snapshot_to_quota_status(
                    account_id,
                    expected_email,
                    snap,
                    "Synchronized live quota from running Antigravity Language Server.",
                ));
            }
        }

        // 3. Try isolated Headless Worker for this account profile
        if let Ok(snap) = self.headless_manager.fetch_quota_for_account(account_id).await {
            let snap_email_norm = snap.account_identity.as_deref().map(|e| e.trim().to_ascii_lowercase());
            let is_match = match (normalized_expected.as_deref(), snap_email_norm.as_deref()) {
                (Some(exp), Some(act)) => is_placeholder || exp == act,
                _ => true,
            };

            if is_match {
                let duration_ms = start_time.elapsed().as_millis();
                eprintln!(
                    "[AG_QUOTA] account_id={}, expected_email={:?}, source=headless_worker, returned_email={:?}, identity_match=true, duration_ms={}",
                    account_id, expected_email, snap.account_identity, duration_ms
                );
                return Ok(Self::map_snapshot_to_quota_status(
                    account_id,
                    expected_email,
                    snap,
                    "Synchronized quota via background Headless Antigravity Worker.",
                ));
            }
        }

        // 4. Cloud Direct API Fallback: If local runtime & headless worker are unauthenticated or on a different account,
        // use stored Google OAuth refresh token for this account from Keyring to retrieve account quota directly.
        if let Some(ref cloud_provider) = self.cloud_provider {
            if let Ok(g_status) = cloud_provider.fetch_quota(account_id, expected_email, project_id).await {
                if g_status.status == ModelQuotaStatus::Available {
                    let duration_ms = start_time.elapsed().as_millis();
                    eprintln!(
                        "[AG_QUOTA] account_id={}, expected_email={:?}, source=cloud_direct, returned_email={:?}, identity_match=true, duration_ms={}",
                        account_id, expected_email, g_status.email, duration_ms
                    );
                    let mut status = g_status;
                    status.provider = "Antigravity Cloud Direct".to_string();
                    status.safe_diagnostic_message = Some(
                        "Synchronized live quota via Antigravity Cloud Direct API (Account isolated).".to_string()
                    );
                    return Ok(status);
                }
            }
        }

        // 5. If no quota source authenticated as expected_email, return diagnostic identity mismatch warning
        let duration_ms = start_time.elapsed().as_millis();
        let exp_display = expected_email.unwrap_or(account_id);
        let running_email = if let Some(first_rt) = runtimes.first() {
            self.client.get_runtime_email(first_rt).await.ok()
        } else {
            None
        };

        let diagnostic_msg = if let Some(other_email) = running_email {
            format!(
                "Antigravity is currently authenticated as {} on this PC. Switch to {} in Antigravity or connect it via Google OAuth in DCC to sync its live quota.",
                other_email, exp_display
            )
        } else {
            "Antigravity is not currently running and no stored credential was found for this account. Please log in or connect via Google OAuth to monitor live quota.".to_string()
        };

        eprintln!(
            "[AG_QUOTA] account_id={}, expected_email={:?}, source=none, returned_email={:?}, identity_match=false, status=AuthRequired, duration_ms={}",
            account_id, expected_email, running_email, duration_ms
        );

        Ok(QuotaStatus {
            account_id: account_id.to_string(),
            email: exp_display.to_string(),
            tier: None,
            provider: "Antigravity Local Runtime".to_string(),
            models: vec![],
            fetched_at: current_unix_timestamp().to_string(),
            status: ModelQuotaStatus::AuthRequired,
            data_source: QuotaDataSource::Unavailable,
            data_quality: QuotaDataQuality::Unavailable,
            safe_diagnostic_message: Some(diagnostic_msg),
        })
    }

    async fn verify_path(
        &self,
        account_id: &str,
    ) -> Result<QuotaVerificationDiagnostic, QuotaProviderError> {
        let start_time = Instant::now();
        let diag = self.client.run_diagnostic().await;
        let latency = start_time.elapsed().as_millis() as u64;
        let provider_name = "Antigravity Local Runtime".to_string();

        if diag.state == crate::monitor::antigravity_quota::AntigravityRuntimeState::Connected {
            Ok(QuotaVerificationDiagnostic {
                account_id: account_id.to_string(),
                provider: provider_name,
                authentication_state: "Connected".to_string(),
                request_status: "Success".to_string(),
                quota_data_available: diag.model_count > 0,
                model_count: diag.model_count,
                last_successful_sync_at: Some(current_unix_timestamp().to_string()),
                data_source: QuotaDataSource::RealProvider,
                data_quality: QuotaDataQuality::Live,
                latency_ms: Some(latency),
                sanitized_error: None,
            })
        } else {
            Ok(QuotaVerificationDiagnostic {
                account_id: account_id.to_string(),
                provider: provider_name,
                authentication_state: format!("{:?}", diag.state),
                request_status: "Failed".to_string(),
                quota_data_available: false,
                model_count: 0,
                last_successful_sync_at: None,
                data_source: QuotaDataSource::Unavailable,
                data_quality: QuotaDataQuality::Unavailable,
                latency_ms: Some(latency),
                sanitized_error: Some(diag.safe_message),
            })
        }
    }
}
