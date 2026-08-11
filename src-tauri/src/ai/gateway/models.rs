use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AIRole {
    System,
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AIMessage {
    pub role: AIRole,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AIRequestOptions {
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub top_p: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIRequest {
    pub provider_id: String,
    pub model: Option<String>,
    pub messages: Vec<AIMessage>,
    pub options: Option<AIRequestOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct AIUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AIResponse {
    pub content: String,
    pub model: String,
    pub usage: Option<AIUsage>,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", content = "message", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AIError {
    InvalidRequest(String),
    AuthenticationFailed(String),
    AccessDenied(String),
    RateLimited(String),
    ProviderUnavailable(String),
    Timeout(String),
    NetworkError(String),
    ProviderNotFound(String),
    CredentialNotFound(String),
    Internal(String),
}

impl std::fmt::Display for AIError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AIError::InvalidRequest(msg) => write!(f, "Invalid Request: {}", msg),
            AIError::AuthenticationFailed(msg) => write!(f, "Authentication Failed: {}", msg),
            AIError::AccessDenied(msg) => write!(f, "Access Denied: {}", msg),
            AIError::RateLimited(msg) => write!(f, "Rate Limited: {}", msg),
            AIError::ProviderUnavailable(msg) => write!(f, "Provider Unavailable: {}", msg),
            AIError::Timeout(msg) => write!(f, "Timeout: {}", msg),
            AIError::NetworkError(msg) => write!(f, "Network Error: {}", msg),
            AIError::ProviderNotFound(msg) => write!(f, "Provider Not Found: {}", msg),
            AIError::CredentialNotFound(msg) => write!(f, "Credential Not Found: {}", msg),
            AIError::Internal(msg) => write!(f, "Internal Error: {}", msg),
        }
    }
}

impl std::error::Error for AIError {}

impl From<crate::error::DesktopError> for AIError {
    fn from(err: crate::error::DesktopError) -> Self {
        match err.kind.as_str() {
            "INVALID_CREDENTIALS" => AIError::AuthenticationFailed(err.message),
            "INVALID_BASE_URL" => AIError::InvalidRequest(err.message),
            "RATE_LIMITED" => AIError::RateLimited(err.message),
            "TIMEOUT" => AIError::Timeout(err.message),
            "NotFound" => AIError::ProviderNotFound(err.message),
            "CredentialNotFound" => AIError::CredentialNotFound(err.message),
            _ => AIError::Internal(err.message),
        }
    }
}
