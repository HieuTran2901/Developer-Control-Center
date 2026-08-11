use std::future::Future;
use std::pin::Pin;
use reqwest::Client;
use crate::ai::gateway::models::{AIRequest, AIResponse, AIError};
use crate::ai::models::ProviderType;

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

pub trait AIProviderAdapter: Send + Sync {
    fn provider_type(&self) -> ProviderType;

    fn send_request<'a>(
        &'a self,
        client: &'a Client,
        base_url: &'a str,
        model: &'a str,
        secret: &'a str,
        request: &'a AIRequest,
    ) -> BoxFuture<'a, Result<AIResponse, AIError>>;
}
