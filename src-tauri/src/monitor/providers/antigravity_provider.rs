use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;

use crate::monitor::antigravity_discovery::{AntigravityDiscovery, DiscoveryErrorKind};
use crate::monitor::antigravity_quota::{
    AntigravityQuotaClient, AntigravityRuntimeState,
};
use crate::monitor::quota_provider::{
    current_unix_timestamp, ModelQuota, ModelQuotaStatus, QuotaDataSource, QuotaDataQuality,
    QuotaProvider, QuotaProviderError, QuotaProviderId, QuotaStatus,
    QuotaVerificationDiagnostic,
};


use crate::monitor::antigravity_headless_worker::HeadlessAntigravityManager;

pub struct AntigravityQuotaProvider {
    client: Arc<AntigravityQuotaClient>,
    headless_manager: Arc<HeadlessAntigravityManager>,
}

impl AntigravityQuotaProvider {
    pub fn new() -> Self {
        Self {
            client: Arc::new(AntigravityQuotaClient::new()),
            headless_manager: Arc::new(HeadlessAntigravityManager::new()),
        }
    }

    pub fn with_client(client: Arc<AntigravityQuotaClient>) -> Self {
        Self {
            client,
            headless_manager: Arc::new(HeadlessAntigravityManager::new()),
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
        _project_id: Option<&str>,
    ) -> Result<QuotaStatus, QuotaProviderError> {
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
        // Note: discover_all_runtimes may return a cached result; find_matching_runtime_for_email
        // will invalidate the cache if all cached runtimes are unresponsive (e.g. after account switch).
        let mut runtimes = AntigravityDiscovery::discover_all_runtimes().unwrap_or_default();

        let mut target_runtime = if is_placeholder && account_id == "default" {
            runtimes.first().cloned()
        } else if let Some(ref exp) = normalized_expected {
            self.client.find_matching_runtime_for_email(exp, &runtimes).await
        } else {
            runtimes.first().cloned()
        };

        // If cache was invalidated (all runtimes were stale), do an immediate fresh rediscovery
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

        // 2. If an active runtime is available, query it directly
        if let Some(runtime) = target_runtime {
            if let Ok(snap) = self.client.fetch_quota_from_runtime(&runtime).await {
                // Snapshot the active IDE session for this account immediately (async, fire-and-forget)
                // This ensures subsequent headless worker calls use the correct token.
                HeadlessAntigravityManager::snapshot_active_session_to_account(account_id);
                return Ok(Self::map_snapshot_to_quota_status(
                    account_id,
                    expected_email,
                    snap,
                    "Synchronized live quota from running Antigravity Language Server.",
                ));
            }
        }


        // 3. If no active IDE runtime matches, query via Headless Worker for this account
        match self.headless_manager.fetch_quota_for_account(account_id).await {
            Ok(snap) => {
                let snap_email_norm = snap.account_identity.as_deref().map(|e| e.trim().to_ascii_lowercase());
                if let (Some(expected), Some(actual)) = (normalized_expected.as_deref(), snap_email_norm.as_deref()) {
                    if !is_placeholder && expected != actual {
                        let exp_display = expected_email.unwrap_or(account_id);
                        let diagnostic_msg = format!(
                            "Antigravity is currently authenticated as {} on this PC. Switch to {} in Antigravity to sync its live quota.",
                            actual, exp_display
                        );
                        return Ok(QuotaStatus {
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
                        });
                    }
                }

                return Ok(Self::map_snapshot_to_quota_status(
                    account_id,
                    expected_email,
                    snap,
                    "Synchronized quota via background Headless Antigravity Worker.",
                ));
            }
            Err(e) => {
                let exp_display = expected_email.unwrap_or("configured account");
                let running_email = if let Some(first_rt) = runtimes.first() {
                    self.client.get_runtime_email(first_rt).await.ok()
                } else {
                    None
                };

                let (diagnostic_msg, model_status) = if let Some(other_email) = running_email {
                    (
                        format!(
                            "Account mismatch: Antigravity is currently authenticated as {}, but this account is {}.",
                            other_email, exp_display
                        ),
                        ModelQuotaStatus::AuthRequired,
                    )
                } else if e.state == AntigravityRuntimeState::LanguageServerNotFound {
                    (
                        "Antigravity is not installed or language_server.exe was not found.".to_string(),
                        ModelQuotaStatus::Unavailable,
                    )
                } else {
                    (
                        "Antigravity is not currently running. Please launch Antigravity to monitor live quota.".to_string(),
                        ModelQuotaStatus::Unavailable,
                    )
                };

                let status = QuotaStatus {
                    account_id: account_id.to_string(),
                    email: exp_display.to_string(),
                    tier: None,
                    provider: "Antigravity Local Runtime".to_string(),
                    models: vec![],
                    fetched_at: current_unix_timestamp().to_string(),
                    status: model_status,
                    data_source: QuotaDataSource::Unavailable,
                    data_quality: QuotaDataQuality::Unavailable,
                    safe_diagnostic_message: Some(diagnostic_msg),
                };
                return Ok(status);
            }
        }
    }

    async fn verify_path(
        &self,
        account_id: &str,
    ) -> Result<QuotaVerificationDiagnostic, QuotaProviderError> {
        let start_time = Instant::now();
        let diag = self.client.run_diagnostic().await;
        let latency = start_time.elapsed().as_millis() as u64;
        let provider_name = "Antigravity Local Runtime".to_string();

        if diag.state == AntigravityRuntimeState::Connected {
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
