use async_trait::async_trait;
use std::sync::Arc;
use reqwest::{Client, header};
use url::Url;
use std::net::{ToSocketAddrs, SocketAddr, IpAddr};
use crate::deployment::provider::{DeploymentProvider, ProviderError, ProviderStatus};
use crate::pipeline::domain::PipelineDefinition;
use crate::config::domain::EnvironmentConfig;
use crate::ai::credential_store::CredentialStoreTrait as CredentialStore;

pub struct GitLabCiProvider {
    client: Client,
}

impl GitLabCiProvider {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap(),
        }
    }

    async fn resolve_token(&self, secret_ref: &str, env: &EnvironmentConfig, cred_store: &Arc<dyn CredentialStore>) -> Result<String, ProviderError> {
        let key = secret_ref.strip_prefix(&format!("secret://env:{}:", env.id))
            .ok_or_else(|| ProviderError::Authentication("Invalid secret reference format".into()))?;
        
        let secret_val = cred_store.get_secret(key)
            .map_err(|e| ProviderError::Authentication(e.to_string()))?;
            
        secret_val.ok_or_else(|| ProviderError::Authentication("Secret not found".into()))
    }

    fn is_private_or_local(ip: &IpAddr) -> bool {
        match ip {
            IpAddr::V4(ipv4) => {
                let octets = ipv4.octets();
                ipv4.is_loopback() || 
                ipv4.is_unspecified() ||
                ipv4.is_multicast() ||
                octets[0] == 10 ||
                (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31) ||
                (octets[0] == 192 && octets[1] == 168) ||
                (octets[0] == 169 && octets[1] == 254) // Link local (AWS metadata)
            }
            IpAddr::V6(ipv6) => {
                ipv6.is_loopback() || ipv6.is_unspecified() || ipv6.is_multicast()
            }
        }
    }

    fn validate_url_ssrf(url_str: &str) -> Result<SocketAddr, ProviderError> {
        let parsed_url = Url::parse(url_str)
            .map_err(|_| ProviderError::Unsupported("Invalid URL".into()))?;
        
        if parsed_url.scheme() != "https" {
            return Err(ProviderError::Unsupported("Only HTTPS is supported".into()));
        }

        let host = parsed_url.host_str().ok_or_else(|| ProviderError::Unsupported("Missing host".into()))?;
        
        // Deep DNS validation
        if let Ok(mut addrs) = format!("{}:443", host).to_socket_addrs() {
            if let Some(addr) = addrs.next() {
                if Self::is_private_or_local(&addr.ip()) {
                    return Err(ProviderError::Unsupported("Host resolves to forbidden IP".into()));
                }
                return Ok(addr);
            }
        }

        Err(ProviderError::Unsupported("Could not resolve host".into()))
    }
}

#[async_trait]
impl DeploymentProvider for GitLabCiProvider {
    async fn validate_config(
        &self,
        _pipeline: &PipelineDefinition,
        env: &EnvironmentConfig,
    ) -> Result<(), ProviderError> {
        let target = env.deployment_targets.iter()
            .find(|t| t.provider.to_lowercase() == "gitlab")
            .ok_or_else(|| ProviderError::NotFound(format!("No GitLab deployment target found for environment {}", env.id)))?;

        let url = target.url.as_ref().ok_or_else(|| ProviderError::Unsupported("GitLab target missing URL".into()))?;
        Self::validate_url_ssrf(url)?;
        
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
            .find(|t| t.provider.to_lowercase() == "gitlab")
            .ok_or_else(|| ProviderError::NotFound(format!("No GitLab deployment target found for environment {}", env.id)))?;

        let url_str = target.url.as_ref().ok_or_else(|| ProviderError::Unsupported("GitLab target missing URL".into()))?;
        let resolved_addr = Self::validate_url_ssrf(url_str)?;
        let parsed_url = Url::parse(url_str).unwrap();
        let host = parsed_url.host_str().unwrap().to_string();
        
        let cred_ref = env.variables.iter().find_map(|v| match v {
            crate::config::domain::EnvironmentVariable::SecretRef { key, reference } if key == "GITLAB_TOKEN" => Some(reference),
            _ => None,
        }).ok_or_else(|| ProviderError::Authentication("Missing GITLAB_TOKEN SecretRef in environment".into()))?;

        let token = self.resolve_token(cred_ref, env, cred_store).await?;

        // Rebuild client with pinned IP to prevent DNS rebinding (TOCTOU)
        let pinned_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .resolve(&host, resolved_addr)
            .build()
            .map_err(|e| ProviderError::Internal(format!("Failed to build safe client: {}", e)))?;
        
        let mut headers = header::HeaderMap::new();
        headers.insert("PRIVATE-TOKEN", header::HeaderValue::from_str(&token).unwrap());
        headers.insert(header::USER_AGENT, header::HeaderValue::from_static("Developer-Control-Center"));

        // POST /api/v4/projects/:id/pipeline
        let payload = serde_json::json!({
            "ref": "main",
            "variables": [
                { "key": "DEPLOYMENT_ID", "value": deployment_id }
            ]
        });

        let response = pinned_client.post(url_str)
            .headers(headers)
            .json(&payload)
            .send()
            .await
            .map_err(|e| ProviderError::Network(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            if status == 401 || status == 403 {
                return Err(ProviderError::Authentication(format!("GitLab Auth Error: {}", text)));
            }
            return Err(ProviderError::Internal(format!("GitLab API Error {}: {}", status, text)));
        }

        // For GitLab, it returns the pipeline ID in the JSON response
        let json: serde_json::Value = response.json().await.unwrap_or_default();
        let pipeline_id = json["id"].as_i64().unwrap_or(0);

        Ok(pipeline_id.to_string())
    }

    async fn query_status(
        &self,
        _provider_execution_id: &str,
        _env: &EnvironmentConfig,
        _cred_store: &Arc<dyn CredentialStore>,
    ) -> Result<ProviderStatus, ProviderError> {
        // Mocking status query for now.
        Ok(ProviderStatus::Running)
    }

    async fn cancel_deployment(
        &self,
        provider_execution_id: &str,
        env: &EnvironmentConfig,
        cred_store: &Arc<dyn CredentialStore>,
    ) -> Result<(), ProviderError> {
        let target = env.deployment_targets.iter()
            .find(|t| t.provider.to_lowercase() == "gitlab")
            .ok_or_else(|| ProviderError::NotFound(format!("No GitLab deployment target found for environment {}", env.id)))?;

        let base_url = target.url.as_ref().ok_or_else(|| ProviderError::Unsupported("GitLab target missing URL".into()))?;
        let resolved_addr = Self::validate_url_ssrf(base_url)?;
        let parsed_url = Url::parse(base_url).unwrap();
        let host = parsed_url.host_str().unwrap().to_string();

        let cred_ref = env.variables.iter().find_map(|v| match v {
            crate::config::domain::EnvironmentVariable::SecretRef { key, reference } if key == "GITLAB_TOKEN" => Some(reference),
            _ => None,
        }).ok_or_else(|| ProviderError::Authentication("Missing GITLAB_TOKEN SecretRef in environment".into()))?;

        let token = self.resolve_token(cred_ref, env, cred_store).await?;

        let pinned_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .resolve(&host, resolved_addr)
            .build()
            .map_err(|e| ProviderError::Internal(format!("Failed to build safe client: {}", e)))?;

        let mut headers = header::HeaderMap::new();
        headers.insert("PRIVATE-TOKEN", header::HeaderValue::from_str(&token).unwrap());

        let cancel_url = format!("{}/{}/cancel", base_url, provider_execution_id);

        let response = pinned_client.post(&cancel_url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| ProviderError::Network(e.to_string()))?;

        if !response.status().is_success() {
             return Err(ProviderError::Internal(format!("Failed to cancel GitLab pipeline {}", provider_execution_id)));
        }

        Ok(())
    }
}
