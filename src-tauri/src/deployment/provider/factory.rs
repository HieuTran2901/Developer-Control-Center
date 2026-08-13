use std::sync::Arc;
use crate::deployment::provider::DeploymentProvider;
use crate::deployment::provider::github::GitHubActionsProvider;
use crate::deployment::provider::gitlab::GitLabCiProvider;
use crate::deployment::provider::shell::GenericShellProvider;
use crate::pipeline::execution::pipeline_executor::PipelineExecutor;

pub struct ProviderFactory;

impl ProviderFactory {
    pub fn create_provider(
        platform: &str,
        executor: Arc<PipelineExecutor>,
    ) -> Result<Box<dyn DeploymentProvider>, String> {
        match platform.to_lowercase().as_str() {
            "github actions" | "github" => Ok(Box::new(GitHubActionsProvider::new())),
            "gitlab ci" | "gitlab" => Ok(Box::new(GitLabCiProvider::new())),
            "generic shell" | "shell" => Ok(Box::new(GenericShellProvider::new(executor))),
            _ => Err(format!("Unsupported platform: {}", platform)),
        }
    }
}
