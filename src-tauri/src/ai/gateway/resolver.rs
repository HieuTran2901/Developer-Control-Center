use std::sync::Arc;
use crate::ai::gateway::adapter::AIProviderAdapter;
use crate::ai::gateway::adapters_impl::{AnthropicAdapter, CustomAdapter, OpenAIAdapter};
use crate::ai::models::ProviderType;

pub struct ProviderResolver;

impl ProviderResolver {
    pub fn resolve(provider_type: &ProviderType) -> Arc<dyn AIProviderAdapter> {
        match provider_type {
            ProviderType::OpenAI => Arc::new(OpenAIAdapter),
            ProviderType::Anthropic => Arc::new(AnthropicAdapter),
            ProviderType::Custom => Arc::new(CustomAdapter),
        }
    }
}
