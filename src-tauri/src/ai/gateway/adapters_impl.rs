use reqwest::Client;
use serde_json::json;
use crate::ai::gateway::adapter::{AIProviderAdapter, BoxFuture};
use crate::ai::gateway::models::{AIError, AIRequest, AIResponse, AIUsage};
use crate::ai::models::ProviderType;

pub struct OpenAIAdapter;

impl AIProviderAdapter for OpenAIAdapter {
    fn provider_type(&self) -> ProviderType {
        ProviderType::OpenAI
    }

    fn send_request<'a>(
        &'a self,
        client: &'a Client,
        base_url: &'a str,
        model: &'a str,
        secret: &'a str,
        request: &'a AIRequest,
    ) -> BoxFuture<'a, Result<AIResponse, AIError>> {
        Box::pin(async move {
            let clean_url = base_url.trim_end_matches('/');
            let target_url = if clean_url.ends_with("/v1") {
                format!("{}/chat/completions", clean_url)
            } else {
                format!("{}/v1/chat/completions", clean_url)
            };

            let messages_json: Vec<_> = request
                .messages
                .iter()
                .map(|m| {
                    let role = match m.role {
                        crate::ai::gateway::models::AIRole::System => "system",
                        crate::ai::gateway::models::AIRole::User => "user",
                        crate::ai::gateway::models::AIRole::Assistant => "assistant",
                    };
                    json!({ "role": role, "content": m.content })
                })
                .collect();

            let target_model = request.model.as_deref().unwrap_or(model);

            let mut body = json!({
                "model": target_model,
                "messages": messages_json
            });

            if let Some(ref opts) = request.options {
                if let Some(temp) = opts.temperature {
                    body["temperature"] = json!(temp);
                }
                if let Some(tokens) = opts.max_tokens {
                    body["max_tokens"] = json!(tokens);
                }
                if let Some(top_p) = opts.top_p {
                    body["top_p"] = json!(top_p);
                }
            }

            let mut req_builder = client.post(&target_url).json(&body);
            if !secret.is_empty() {
                req_builder = req_builder.header("Authorization", format!("Bearer {}", secret));
            }

            let response = req_builder.send().await.map_err(|e| {
                if e.is_timeout() {
                    AIError::Timeout("OpenAI request timed out".into())
                } else {
                    AIError::NetworkError("Unable to reach OpenAI endpoint".into())
                }
            })?;

            let status = response.status();
            if status.is_success() {
                let res_json: serde_json::Value = response.json().await.map_err(|e| {
                    AIError::Internal(format!("Failed to parse OpenAI response: {}", e))
                })?;

                let content = res_json["choices"][0]["message"]["content"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();

                let finish_reason = res_json["choices"][0]["finish_reason"]
                    .as_str()
                    .map(|s| s.to_string());

                let usage = if res_json["usage"].is_object() {
                    Some(AIUsage {
                        prompt_tokens: res_json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32,
                        completion_tokens: res_json["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32,
                        total_tokens: res_json["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32,
                    })
                } else {
                    None
                };

                Ok(AIResponse {
                    content,
                    model: target_model.to_string(),
                    usage,
                    finish_reason,
                })
            } else if status.as_u16() == 401 || status.as_u16() == 403 {
                Err(AIError::AuthenticationFailed("Invalid API Key or unauthorized".into()))
            } else if status.as_u16() == 429 {
                Err(AIError::RateLimited("OpenAI rate limit exceeded".into()))
            } else if status.as_u16() >= 500 {
                Err(AIError::ProviderUnavailable(format!("OpenAI server error HTTP {}", status.as_u16())))
            } else {
                Err(AIError::InvalidRequest(format!("OpenAI request failed with HTTP {}", status.as_u16())))
            }
        })
    }
}

pub struct AnthropicAdapter;

impl AIProviderAdapter for AnthropicAdapter {
    fn provider_type(&self) -> ProviderType {
        ProviderType::Anthropic
    }

    fn send_request<'a>(
        &'a self,
        client: &'a Client,
        base_url: &'a str,
        model: &'a str,
        secret: &'a str,
        request: &'a AIRequest,
    ) -> BoxFuture<'a, Result<AIResponse, AIError>> {
        Box::pin(async move {
            let clean_url = base_url.trim_end_matches('/');
            let target_url = if clean_url.ends_with("/v1") {
                format!("{}/messages", clean_url)
            } else {
                format!("{}/v1/messages", clean_url)
            };

            let mut system_prompt: Option<String> = None;
            let mut messages_json = Vec::new();

            for m in &request.messages {
                match m.role {
                    crate::ai::gateway::models::AIRole::System => {
                        system_prompt = Some(m.content.clone());
                    }
                    crate::ai::gateway::models::AIRole::User => {
                        messages_json.push(json!({ "role": "user", "content": m.content }));
                    }
                    crate::ai::gateway::models::AIRole::Assistant => {
                        messages_json.push(json!({ "role": "assistant", "content": m.content }));
                    }
                }
            }

            let target_model = request.model.as_deref().unwrap_or(model);
            let max_tokens = request.options.as_ref().and_then(|o| o.max_tokens).unwrap_or(4096);

            let mut body = json!({
                "model": target_model,
                "max_tokens": max_tokens,
                "messages": messages_json
            });

            if let Some(sys) = system_prompt {
                body["system"] = json!(sys);
            }

            let mut req_builder = client
                .post(&target_url)
                .header("anthropic-version", "2023-06-01")
                .json(&body);

            if !secret.is_empty() {
                req_builder = req_builder.header("x-api-key", secret);
            }

            let response = req_builder.send().await.map_err(|e| {
                if e.is_timeout() {
                    AIError::Timeout("Anthropic request timed out".into())
                } else {
                    AIError::NetworkError("Unable to reach Anthropic endpoint".into())
                }
            })?;

            let status = response.status();
            if status.is_success() {
                let res_json: serde_json::Value = response.json().await.map_err(|e| {
                    AIError::Internal(format!("Failed to parse Anthropic response: {}", e))
                })?;

                let content = res_json["content"][0]["text"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();

                let stop_reason = res_json["stop_reason"].as_str().map(|s| s.to_string());

                let usage = if res_json["usage"].is_object() {
                    let input_tokens = res_json["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32;
                    let output_tokens = res_json["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32;
                    Some(AIUsage {
                        prompt_tokens: input_tokens,
                        completion_tokens: output_tokens,
                        total_tokens: input_tokens + output_tokens,
                    })
                } else {
                    None
                };

                Ok(AIResponse {
                    content,
                    model: target_model.to_string(),
                    usage,
                    finish_reason: stop_reason,
                })
            } else if status.as_u16() == 401 || status.as_u16() == 403 {
                Err(AIError::AuthenticationFailed("Invalid Anthropic API Key".into()))
            } else if status.as_u16() == 429 {
                Err(AIError::RateLimited("Anthropic rate limit exceeded".into()))
            } else if status.as_u16() >= 500 {
                Err(AIError::ProviderUnavailable(format!("Anthropic server error HTTP {}", status.as_u16())))
            } else {
                Err(AIError::InvalidRequest(format!("Anthropic request failed with HTTP {}", status.as_u16())))
            }
        })
    }
}

pub struct CustomAdapter;

impl AIProviderAdapter for CustomAdapter {
    fn provider_type(&self) -> ProviderType {
        ProviderType::Custom
    }

    fn send_request<'a>(
        &'a self,
        client: &'a Client,
        base_url: &'a str,
        model: &'a str,
        secret: &'a str,
        request: &'a AIRequest,
    ) -> BoxFuture<'a, Result<AIResponse, AIError>> {
        // Custom provider uses OpenAI-compatible protocol
        OpenAIAdapter.send_request(client, base_url, model, secret, request)
    }
}
