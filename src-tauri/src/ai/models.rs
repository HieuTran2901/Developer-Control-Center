use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProviderType {
    OpenAI,
    Anthropic,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AIProviderStatus {
    Untested,
    Testing,
    Connected,
    Failed,
    Disabled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIProviderConfig {
    pub id: String,
    pub name: String,
    pub provider_type: ProviderType,
    pub model: String,
    pub base_url: String,
    pub enabled: bool,
    pub is_default: bool,
    pub status: AIProviderStatus,
    pub created_at: u64,
    pub updated_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAIProviderInput {
    pub name: String,
    pub provider_type: ProviderType,
    pub model: String,
    pub base_url: String,
    pub secret_key: Option<String>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAIProviderInput {
    pub id: String,
    pub name: Option<String>,
    pub provider_type: Option<ProviderType>,
    pub model: Option<String>,
    pub base_url: Option<String>,
    pub secret_key: Option<String>,
    pub enabled: Option<bool>,
    pub is_default: Option<bool>,
}
