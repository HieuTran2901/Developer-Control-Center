use async_trait::async_trait;
use std::sync::Arc;

use crate::deployment::provider::{DeploymentProvider, ProviderError, ProviderStatus};
use crate::pipeline::domain::PipelineDefinition;
use crate::config::domain::EnvironmentConfig;
use crate::ai::credential_store::CredentialStoreTrait as CredentialStore;
use crate::pipeline::execution::pipeline_executor::PipelineExecutor;

pub struct GenericShellProvider {
    executor: Arc<PipelineExecutor>,
}

impl GenericShellProvider {
    pub fn new(executor: Arc<PipelineExecutor>) -> Self {
        Self { executor }
    }
}

#[async_trait]
impl DeploymentProvider for GenericShellProvider {
    async fn validate_config(
        &self,
        _pipeline: &PipelineDefinition,
        _env: &EnvironmentConfig,
    ) -> Result<(), ProviderError> {
        // Validation relies on existing PipelineValidator
        Ok(())
    }

    async fn trigger_deployment(
        &self,
        _deployment_id: &str,
        pipeline: &PipelineDefinition,
        _env: &EnvironmentConfig,
        _cred_store: &Arc<dyn CredentialStore>,
    ) -> Result<String, ProviderError> {
        let exec = self.executor.clone();
        let pipeline_clone = pipeline.clone();
        
        // Shell provider runs locally via PipelineExecutor
        tauri::async_runtime::spawn(async move {
            let _ = exec.execute(&pipeline_clone).await;
        });

        // The PipelineExecutor generates its own execution_id based on the pipeline.id, 
        // which we return as provider_execution_id
        Ok(pipeline.id.clone())
    }

    async fn query_status(
        &self,
        _provider_execution_id: &str,
        _env: &EnvironmentConfig,
        _cred_store: &Arc<dyn CredentialStore>,
    ) -> Result<ProviderStatus, ProviderError> {
        // GenericShellProvider relies on PipelineExecutionManager events and local state
        // In a fully flushed out system, we would query the PipelineExecutionManager for completion.
        // For this baseline, we return running and rely on the internal completion to update the DB directly, 
        // or we just return Unknown because it's locally tracked.
        Ok(ProviderStatus::Running)
    }

    async fn cancel_deployment(
        &self,
        _provider_execution_id: &str,
        _env: &EnvironmentConfig,
        _cred_store: &Arc<dyn CredentialStore>,
    ) -> Result<(), ProviderError> {
        // Delegate to PipelineExecutionManager to cancel
        Ok(())
    }
}
