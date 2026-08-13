pub mod github;
pub mod gitlab;
pub mod shell;
pub mod factory;

use async_trait::async_trait;
use std::sync::Arc;
use crate::pipeline::domain::PipelineDefinition;
use crate::config::domain::EnvironmentConfig;
use crate::ai::credential_store::CredentialStoreTrait as CredentialStore;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProviderStatus {
    Queued,
    Running,
    Success,
    Failed,
    Cancelled,
    Timeout,
    Unavailable,
}

#[derive(Debug, Clone)]
pub enum ProviderError {
    Authentication(String),
    Network(String),
    NotFound(String),
    Unsupported(String),
    Internal(String),
}

impl std::fmt::Display for ProviderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProviderError::Authentication(m) => write!(f, "Provider Authentication Error: {}", m),
            ProviderError::Network(m) => write!(f, "Provider Network Error: {}", m),
            ProviderError::NotFound(m) => write!(f, "Provider Not Found: {}", m),
            ProviderError::Unsupported(m) => write!(f, "Provider Unsupported: {}", m),
            ProviderError::Internal(m) => write!(f, "Provider Internal Error: {}", m),
        }
    }
}

#[async_trait]
pub trait DeploymentProvider: Send + Sync {
    async fn validate_config(
        &self,
        pipeline: &PipelineDefinition,
        env: &EnvironmentConfig,
    ) -> Result<(), ProviderError>;

    async fn trigger_deployment(
        &self,
        deployment_id: &str,
        pipeline: &PipelineDefinition,
        env: &EnvironmentConfig,
        cred_store: &Arc<dyn CredentialStore>,
    ) -> Result<String, ProviderError>;

    async fn query_status(
        &self,
        provider_execution_id: &str,
        env: &EnvironmentConfig,
        cred_store: &Arc<dyn CredentialStore>,
    ) -> Result<ProviderStatus, ProviderError>;

    async fn cancel_deployment(
        &self,
        provider_execution_id: &str,
        env: &EnvironmentConfig,
        cred_store: &Arc<dyn CredentialStore>,
    ) -> Result<(), ProviderError>;
}
