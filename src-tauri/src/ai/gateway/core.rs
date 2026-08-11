use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use reqwest::Client;

use crate::ai::credential_store::{CredentialStoreTrait, OsCredentialStore};
use crate::ai::gateway::adapter::AIProviderAdapter;
use crate::ai::gateway::models::{AIError, AIRequest, AIResponse};
use crate::ai::gateway::resolver::ProviderResolver;
use crate::ai::metadata_store::MetadataStore;

// Safety Limit Constants
pub const MAX_MESSAGES_COUNT: usize = 100;
pub const MAX_MESSAGE_LENGTH: usize = 64_000;
pub const MAX_TOTAL_PAYLOAD_BYTES: usize = 262_144; // 256 KB
pub const MAX_MODEL_LENGTH: usize = 128;
pub const TOTAL_GATEWAY_TIMEOUT_SECS: u64 = 15;
pub const MAX_RETRIES: u32 = 2;

pub struct AIGateway {
    metadata_store: Arc<MetadataStore>,
    credential_store: Arc<dyn CredentialStoreTrait>,
    http_client: Arc<Client>,
    custom_adapter_override: Option<Arc<dyn AIProviderAdapter>>,
}

impl AIGateway {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(TOTAL_GATEWAY_TIMEOUT_SECS))
            .pool_max_idle_per_host(10)
            .tcp_keepalive(Duration::from_secs(60))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            metadata_store: Arc::new(MetadataStore::new(app_data_dir)),
            credential_store: Arc::new(OsCredentialStore::new()),
            http_client: Arc::new(client),
            custom_adapter_override: None,
        }
    }

    pub fn with_stores(
        app_data_dir: PathBuf,
        credential_store: Arc<dyn CredentialStoreTrait>,
    ) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(TOTAL_GATEWAY_TIMEOUT_SECS))
            .pool_max_idle_per_host(10)
            .tcp_keepalive(Duration::from_secs(60))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            metadata_store: Arc::new(MetadataStore::new(app_data_dir)),
            credential_store,
            http_client: Arc::new(client),
            custom_adapter_override: None,
        }
    }

    pub fn with_adapter_override(mut self, adapter: Arc<dyn AIProviderAdapter>) -> Self {
        self.custom_adapter_override = Some(adapter);
        self
    }

    /// Pre-execution safety validation for AIRequest
    pub fn validate_request(&self, request: &AIRequest) -> Result<(), AIError> {
        if request.messages.is_empty() {
            return Err(AIError::InvalidRequest("Request messages cannot be empty".into()));
        }

        if request.messages.len() > MAX_MESSAGES_COUNT {
            return Err(AIError::InvalidRequest(format!(
                "Message count ({}) exceeds max safety limit of {}",
                request.messages.len(),
                MAX_MESSAGES_COUNT
            )));
        }

        if let Some(ref m) = request.model {
            if m.len() > MAX_MODEL_LENGTH {
                return Err(AIError::InvalidRequest(format!(
                    "Model string length exceeds safety limit of {} characters",
                    MAX_MODEL_LENGTH
                )));
            }
        }

        let mut total_bytes = 0;
        for msg in &request.messages {
            if msg.content.len() > MAX_MESSAGE_LENGTH {
                return Err(AIError::InvalidRequest(format!(
                    "Single message length ({}) exceeds max limit of {} characters",
                    msg.content.len(),
                    MAX_MESSAGE_LENGTH
                )));
            }
            total_bytes += msg.content.len();
        }

        if total_bytes > MAX_TOTAL_PAYLOAD_BYTES {
            return Err(AIError::InvalidRequest(format!(
                "Total request payload size ({} bytes) exceeds safety limit of {} bytes",
                total_bytes, MAX_TOTAL_PAYLOAD_BYTES
            )));
        }

        Ok(())
    }

    /// Main entry point for dispatching AI requests
    pub async fn send_request(&self, request: AIRequest) -> Result<AIResponse, AIError> {
        // 1. Validate payload size bounds
        self.validate_request(&request)?;

        // 2. Wrap total operation (attempts + retries + backoff) inside 15s TOTAL Gateway Timeout
        let total_timeout = Duration::from_secs(TOTAL_GATEWAY_TIMEOUT_SECS);
        tokio::time::timeout(total_timeout, self.execute_gateway_loop(&request))
            .await
            .map_err(|_| AIError::Timeout(format!("Gateway operation timed out after {}s total", TOTAL_GATEWAY_TIMEOUT_SECS)))?
    }

    async fn execute_gateway_loop(&self, request: &AIRequest) -> Result<AIResponse, AIError> {
        // 3. Resolve Provider Metadata
        let provider_config = self
            .metadata_store
            .get(&request.provider_id)
            .ok_or_else(|| AIError::ProviderNotFound(format!("Provider ID '{}' not found", request.provider_id)))?;

        if !provider_config.enabled {
            return Err(AIError::ProviderUnavailable(format!("Provider '{}' is disabled", provider_config.name)));
        }

        // 4. Resolve Credential securely from Rust CredentialStore
        let secret = self
            .credential_store
            .get_secret(&request.provider_id)
            .map_err(|e| AIError::Internal(e.message))?
            .unwrap_or_default();

        if secret.is_empty() && provider_config.provider_type != crate::ai::models::ProviderType::Custom {
            return Err(AIError::CredentialNotFound(format!(
                "No API Key configured for provider '{}'",
                provider_config.name
            )));
        }

        // 5. Resolve Provider Adapter
        let adapter: Arc<dyn AIProviderAdapter> = match self.custom_adapter_override {
            Some(ref a) => a.clone(),
            None => ProviderResolver::resolve(&provider_config.provider_type),
        };

        let base_url = provider_config.base_url.clone();
        let model = request.model.clone().unwrap_or(provider_config.model.clone());

        // 6. Bounded Retry Loop (Max 2 retries = 3 attempts)
        let mut attempt = 0;
        loop {
            attempt += 1;

            let result = adapter
                .send_request(&self.http_client, &base_url, &model, &secret, request)
                .await;

            match result {
                Ok(response) => return Ok(response),
                Err(err) => {
                    let is_retryable = matches!(
                        err,
                        AIError::RateLimited(_) | AIError::ProviderUnavailable(_) | AIError::Timeout(_) | AIError::NetworkError(_)
                    );

                    if is_retryable && attempt <= MAX_RETRIES {
                        // Exponential backoff with jitter: 100ms * 2^attempt + jitter (0..50ms)
                        let backoff_ms = (100 * (1 << (attempt - 1))) + (attempt * 13 % 50);
                        tokio::time::sleep(Duration::from_millis(backoff_ms as u64)).await;
                        continue;
                    } else {
                        // Non-retryable error (401, 403, 400, CredentialNotFound) or max retries exceeded
                        return Err(err);
                    }
                }
            }
        }
    }
}
