use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use reqwest::Client;
use crate::ai::gateway::adapter::{AIProviderAdapter, BoxFuture};
use crate::ai::gateway::models::{AIError, AIRequest, AIResponse, AIUsage};
use crate::ai::models::ProviderType;

#[derive(Clone, Debug)]
pub enum MockBehavior {
    Success(String),
    Error401,
    Error403,
    Error400,
    Error429,
    Error500,
    Error502,
    Error503,
    Error504,
    Timeout,
    FailNTimesThenSuccess(u32, Box<MockBehavior>, String),
}

pub struct MockAIProviderAdapter {
    pub behavior: Arc<std::sync::Mutex<MockBehavior>>,
    pub call_count: Arc<AtomicU32>,
}

impl MockAIProviderAdapter {
    pub fn new(behavior: MockBehavior) -> Self {
        Self {
            behavior: Arc::new(std::sync::Mutex::new(behavior)),
            call_count: Arc::new(AtomicU32::new(0)),
        }
    }

    pub fn calls(&self) -> u32 {
        self.call_count.load(Ordering::SeqCst)
    }
}

impl AIProviderAdapter for MockAIProviderAdapter {
    fn provider_type(&self) -> ProviderType {
        ProviderType::Custom
    }

    fn send_request<'a>(
        &'a self,
        _client: &'a Client,
        _base_url: &'a str,
        model: &'a str,
        _secret: &'a str,
        request: &'a AIRequest,
    ) -> BoxFuture<'a, Result<AIResponse, AIError>> {
        self.call_count.fetch_add(1, Ordering::SeqCst);
        let behavior = self.behavior.lock().unwrap().clone();
        let target_model = request.model.as_deref().unwrap_or(model).to_string();

        Box::pin(async move {
            match behavior {
                MockBehavior::Success(content) => Ok(AIResponse {
                    content,
                    model: target_model,
                    usage: Some(AIUsage {
                        prompt_tokens: 10,
                        completion_tokens: 20,
                        total_tokens: 30,
                    }),
                    finish_reason: Some("stop".into()),
                }),
                MockBehavior::Error401 => Err(AIError::AuthenticationFailed("Invalid API Key".into())),
                MockBehavior::Error403 => Err(AIError::AccessDenied("Access denied".into())),
                MockBehavior::Error400 => Err(AIError::InvalidRequest("Bad Request".into())),
                MockBehavior::Error429 => Err(AIError::RateLimited("Rate limit exceeded".into())),
                MockBehavior::Error500 => Err(AIError::ProviderUnavailable("Internal Server Error 500".into())),
                MockBehavior::Error502 => Err(AIError::ProviderUnavailable("Bad Gateway 502".into())),
                MockBehavior::Error503 => Err(AIError::ProviderUnavailable("Service Unavailable 503".into())),
                MockBehavior::Error504 => Err(AIError::Timeout("Gateway Timeout 504".into())),
                MockBehavior::Timeout => Err(AIError::Timeout("Request timed out".into())),
                MockBehavior::FailNTimesThenSuccess(_fail_count, fail_type, success_content) => {
                    // Handled inside Gateway Engine test loop or via state mutation
                    match *fail_type {
                        MockBehavior::Error429 => Err(AIError::RateLimited("Rate limit exceeded".into())),
                        MockBehavior::Error500 => Err(AIError::ProviderUnavailable("Internal Server Error 500".into())),
                        _ => Ok(AIResponse {
                            content: success_content,
                            model: target_model,
                            usage: None,
                            finish_reason: Some("stop".into()),
                        }),
                    }
                }
            }
        })
    }
}
