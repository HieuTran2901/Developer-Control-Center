use async_trait::async_trait;
use std::sync::Arc;
use reqwest::{Client, header};

use crate::deployment::provider::{DeploymentProvider, ProviderError, ProviderStatus};
use crate::pipeline::domain::PipelineDefinition;
use crate::config::domain::EnvironmentConfig;
use crate::ai::credential_store::CredentialStoreTrait as CredentialStore;

pub struct GitHubActionsProvider {
    client: Client,
}

impl GitHubActionsProvider {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    async fn resolve_token(&self, secret_ref: &str, env: &EnvironmentConfig, cred_store: &Arc<dyn CredentialStore>) -> Result<String, ProviderError> {
        let key = secret_ref.strip_prefix(&format!("secret://env:{}:", env.id))
            .ok_or_else(|| ProviderError::Authentication("Invalid secret reference format or environment mismatch".into()))?;
        
        let secret_val = cred_store.get_secret(key)
            .map_err(|e| ProviderError::Authentication(e.to_string()))?;
            
        secret_val.ok_or_else(|| ProviderError::Authentication("Secret not found".into()))
    }
}

#[async_trait]
impl DeploymentProvider for GitHubActionsProvider {
    async fn validate_config(
        &self,
        _pipeline: &PipelineDefinition,
        env: &EnvironmentConfig,
    ) -> Result<(), ProviderError> {
        // Just verify there is a deployment target configured for GitHub
        let target = env.deployment_targets.iter()
            .find(|t| t.provider.to_lowercase() == "github")
            .ok_or_else(|| ProviderError::NotFound(format!("No GitHub deployment target found for environment {}", env.id)))?;

        let url = target.url.as_ref().ok_or_else(|| ProviderError::Unsupported("GitHub target missing URL".into()))?;
        if !url.starts_with("https://api.github.com") {
            return Err(ProviderError::Unsupported("Only api.github.com is supported to prevent SSRF".into()));
        }

        Ok(())
    }

    async fn trigger_deployment(
        &self,
        deployment_id: &str,
        _pipeline: &PipelineDefinition,
        env: &EnvironmentConfig,
        cred_store: &Arc<dyn CredentialStore>,
    ) -> Result<String, ProviderError> {
        let target = env.deployment_targets.iter()
            .find(|t| t.provider.to_lowercase() == "github")
            .ok_or_else(|| ProviderError::NotFound(format!("No GitHub deployment target found for environment {}", env.id)))?;

        let cred_ref = env.variables.iter().find_map(|v| match v {
            crate::config::domain::EnvironmentVariable::SecretRef { key, reference } if key == "GITHUB_TOKEN" => Some(reference),
            _ => None,
        }).ok_or_else(|| ProviderError::Authentication("Missing GITHUB_TOKEN SecretRef in environment".into()))?;

        let token = self.resolve_token(cred_ref, env, cred_store).await?;

        // Extract owner and repo from URL or config. 
        // Assuming URL is formatted as https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches
        let url = target.url.as_ref().ok_or_else(|| ProviderError::Unsupported("GitHub target missing URL".into()))?;
        
        let mut headers = header::HeaderMap::new();
        headers.insert(header::AUTHORIZATION, header::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap());
        headers.insert(header::ACCEPT, header::HeaderValue::from_static("application/vnd.github.v3+json"));
        headers.insert(header::USER_AGENT, header::HeaderValue::from_static("Developer-Control-Center"));

        let payload = serde_json::json!({
            "ref": "main",
            "inputs": {
                "deployment_id": deployment_id
            }
        });

        let response = self.client.post(url)
            .headers(headers)
            .json(&payload)
            .send()
            .await
            .map_err(|e| ProviderError::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            if status == 401 || status == 403 {
                return Err(ProviderError::Authentication(format!("GitHub Auth Error: {}", text)));
            }
            return Err(ProviderError::Internal(format!("GitHub API Error {}: {}", status, text)));
        }

        // workflow_dispatch doesn't return the run ID directly. 
        // We return the deployment_id as the correlation/execution ID for polling later
        Ok(deployment_id.to_string())
    }

    async fn query_status(
        &self,
        _provider_execution_id: &str,
        _env: &EnvironmentConfig,
        _cred_store: &Arc<dyn CredentialStore>,
    ) -> Result<ProviderStatus, ProviderError> {
        // Requires listing workflow runs and filtering by deployment_id input.
        // For baseline, we mock the transition.
        Ok(ProviderStatus::Running)
    }

    async fn cancel_deployment(
        &self,
        provider_execution_id: &str,
        env: &EnvironmentConfig,
        cred_store: &Arc<dyn CredentialStore>,
    ) -> Result<(), ProviderError> {
        let target = env.deployment_targets.iter()
            .find(|t| t.provider.to_lowercase() == "github")
            .ok_or_else(|| ProviderError::NotFound(format!("No GitHub deployment target found for environment {}", env.id)))?;

        let cred_ref = env.variables.iter().find_map(|v| match v {
            crate::config::domain::EnvironmentVariable::SecretRef { key, reference } if key == "GITHUB_TOKEN" => Some(reference),
            _ => None,
        }).ok_or_else(|| ProviderError::Authentication("Missing GITHUB_TOKEN SecretRef in environment".into()))?;

        let token = self.resolve_token(cred_ref, env, cred_store).await?;

        let url = target.url.as_ref().ok_or_else(|| ProviderError::Unsupported("GitHub target missing URL".into()))?;
        let base_repo_url = if let Some(idx) = url.find("/actions/") {
            &url[..idx]
        } else {
            return Err(ProviderError::Unsupported("Invalid GitHub Actions URL format".into()));
        };

        let cancel_url = format!("{}/actions/runs/{}/cancel", base_repo_url, provider_execution_id);
        
        let mut headers = header::HeaderMap::new();
        headers.insert(header::AUTHORIZATION, header::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap());
        headers.insert(header::ACCEPT, header::HeaderValue::from_static("application/vnd.github.v3+json"));
        headers.insert(header::USER_AGENT, header::HeaderValue::from_static("Developer-Control-Center"));

        let response = self.client.post(&cancel_url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| ProviderError::Network(e.to_string()))?;

        if !response.status().is_success() {
             return Err(ProviderError::Internal(format!("Failed to cancel GitHub pipeline {}", provider_execution_id)));
        }

        Ok(())
    }
}
