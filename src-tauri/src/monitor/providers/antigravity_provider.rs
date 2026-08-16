use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;

use crate::monitor::antigravity_quota::{
    AntigravityQuotaClient, AntigravityRuntimeState,
};
use crate::monitor::quota_provider::{
    current_unix_timestamp, ModelQuota, ModelQuotaStatus, QuotaDataSource, QuotaDataQuality,
    QuotaProvider, QuotaProviderError, QuotaProviderId, QuotaStatus,
    QuotaVerificationDiagnostic,
};


pub struct AntigravityQuotaProvider {
    client: Arc<AntigravityQuotaClient>,
}

impl AntigravityQuotaProvider {
    pub fn new() -> Self {
        Self {
            client: Arc::new(AntigravityQuotaClient::new()),
        }
    }

    pub fn with_client(client: Arc<AntigravityQuotaClient>) -> Self {
        Self { client }
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

        match self.client.fetch_quota().await {
            Ok(snap) => {
                let runtime_email_raw = snap
                    .account_identity
                    .clone()
                    .unwrap_or_else(|| "unknown@antigravity.local".to_string());
                let runtime_email_norm = runtime_email_raw.trim().to_ascii_lowercase();

                // Strict identity matching
                let is_match = if is_placeholder && account_id == "default" {
                    true
                } else if let Some(ref exp) = normalized_expected {
                    &runtime_email_norm == exp
                } else {
                    true
                };

                if !is_match {
                    let exp_display = expected_email.unwrap_or("configured account");
                    let status = QuotaStatus {
                        account_id: account_id.to_string(),
                        email: exp_display.to_string(),
                        tier: None,
                        provider: "Antigravity Local Runtime".to_string(),
                        models: vec![],
                        fetched_at: current_unix_timestamp().to_string(),
                        status: ModelQuotaStatus::AuthRequired,
                        data_source: QuotaDataSource::Unavailable,
                        data_quality: QuotaDataQuality::Unavailable,
                        safe_diagnostic_message: Some(format!(
                            "Account mismatch: Antigravity is currently authenticated as {}, but this account is {}.",
                            runtime_email_raw, exp_display
                        )),
                    };
                    return Ok(status);
                }

                let mut models = Vec::new();
                for m in snap.models {
                    let fraction = m.remaining_fraction;
                    let percentage = m
                        .remaining_percent
                        .or_else(|| fraction.map(|f| (f * 100.0).round()));

                    models.push(ModelQuota {
                        model_id: m.model_id.clone(),
                        display_name: m.display_name.unwrap_or(m.model_id),
                        remaining_fraction: fraction,
                        remaining_percentage: percentage,
                        reset_at: m.reset_time,
                        status: ModelQuotaStatus::Available,
                    });
                }

                let status = QuotaStatus {
                    account_id: account_id.to_string(),
                    email: runtime_email_raw,
                    tier: snap.plan_name.or(snap.tier),
                    provider: "Antigravity Local Runtime".to_string(),
                    models,
                    fetched_at: snap.fetched_at,
                    status: ModelQuotaStatus::Available,
                    data_source: QuotaDataSource::RealProvider,
                    data_quality: QuotaDataQuality::Live,
                    safe_diagnostic_message: Some(
                        "Synchronized live quota from running Antigravity Language Server.".to_string(),
                    ),
                };

                Ok(status)
            }
            Err(e) => {
                let status = QuotaStatus {
                    account_id: account_id.to_string(),
                    email: expected_email.unwrap_or("Antigravity Local").to_string(),
                    tier: None,
                    provider: "Antigravity Local Runtime".to_string(),
                    models: vec![],
                    fetched_at: current_unix_timestamp().to_string(),
                    status: if e.state == AntigravityRuntimeState::AntigravityNotRunning {
                        ModelQuotaStatus::Unavailable
                    } else {
                        ModelQuotaStatus::AuthRequired
                    },
                    data_source: QuotaDataSource::Unavailable,
                    data_quality: QuotaDataQuality::Unavailable,
                    safe_diagnostic_message: Some(e.message),
                };
                Ok(status)
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
