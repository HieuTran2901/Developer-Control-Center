use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;
use crate::ai::AIGateway;
use crate::ai::gateway::{AIRequest, AIMessage, AIRole};
use crate::pipeline::domain::{PipelineStep, PipelineError, PipelineStatus, StepConfig};
use crate::pipeline::executor::step_executor::StepExecutor;
use crate::pipeline::executor::result::StepResult;

pub struct AiStepExecutor;

impl StepExecutor for AiStepExecutor {
    async fn execute(
        &self,
        step: &PipelineStep,
        ai_gateway: Option<&Arc<AIGateway>>,
        cancel_flag: Arc<AtomicBool>,
    ) -> Result<StepResult, PipelineError> {
        let start = Instant::now();

        // 1. Ensure AIGateway is provided
        let gateway = match ai_gateway {
            Some(g) => g,
            None => return Err(PipelineError::ValidationError("AI Gateway is required for AI steps".to_string())),
        };

        // 2. Cooperative cancellation check before dispatching
        if cancel_flag.load(Ordering::Relaxed) {
            return Ok(StepResult {
                step_id: step.id.clone(),
                status: PipelineStatus::Cancelled,
                output: None,
                duration_ms: start.elapsed().as_millis() as u64,
                error: Some("Operation cancelled".to_string()),
            });
        }

        // 3. Build AIRequest based on config
        let ai_request = match &step.config {
            StepConfig::AiAgent {
                provider_id,
                model,
                system_prompt,
                user_prompt_template,
            } => {
                let mut messages = Vec::new();
                if let Some(sys) = system_prompt {
                    if !sys.trim().is_empty() {
                        messages.push(AIMessage {
                            role: AIRole::System,
                            content: sys.clone(),
                        });
                    }
                }
                messages.push(AIMessage {
                    role: AIRole::User,
                    content: user_prompt_template.clone(),
                });

                AIRequest {
                    provider_id: provider_id.clone(),
                    model: model.clone(),
                    messages,
                    options: None,
                }
            }
            StepConfig::Prompt {
                provider_id,
                model,
                prompt_template,
            } => {
                let messages = vec![AIMessage {
                    role: AIRole::User,
                    content: prompt_template.clone(),
                }];

                AIRequest {
                    provider_id: provider_id.clone(),
                    model: model.clone(),
                    messages,
                    options: None,
                }
            }
            _ => return Err(PipelineError::ValidationError("Invalid config for AI step".to_string())),
        };

        // 4. Send request via AIGateway
        let response = gateway.send_request(ai_request).await;

        let duration_ms = start.elapsed().as_millis() as u64;

        // 5. Cooperative cancellation check after dispatching
        if cancel_flag.load(Ordering::Relaxed) {
            return Ok(StepResult {
                step_id: step.id.clone(),
                status: PipelineStatus::Cancelled,
                output: None,
                duration_ms,
                error: Some("Operation cancelled".to_string()),
            });
        }

        // 6. Map and normalize responses / errors
        match response {
            Ok(res) => {
                Ok(StepResult {
                    step_id: step.id.clone(),
                    status: PipelineStatus::Success,
                    output: Some(res.content),
                    duration_ms,
                    error: None,
                })
            }
            Err(err) => {
                // Normalize error: ensure no secret or raw details leak
                let normalized_err = format!("{}", err);
                
                Ok(StepResult {
                    step_id: step.id.clone(),
                    status: PipelineStatus::Failed,
                    output: None,
                    duration_ms,
                    error: Some(normalized_err),
                })
            }
        }
    }
}
