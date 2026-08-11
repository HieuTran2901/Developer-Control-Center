use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use crate::ai::AIGateway;
use crate::pipeline::domain::{PipelineStep, PipelineError, PipelineStatus, StepConfig};
use crate::pipeline::executor::step_executor::StepExecutor;
use crate::pipeline::executor::result::StepResult;

pub struct MockStepExecutor;

impl StepExecutor for MockStepExecutor {
    async fn execute(
        &self,
        step: &PipelineStep,
        _ai_gateway: Option<&Arc<AIGateway>>,
        cancel_flag: Arc<AtomicBool>,
    ) -> Result<StepResult, PipelineError> {
        let start = Instant::now();
        
        let (behavior, output) = match &step.config {
            StepConfig::Mock { behavior, output } => (behavior.as_str(), output.as_deref()),
            _ => return Err(PipelineError::ValidationError("Invalid config for Mock step".to_string())),
        };

        match behavior {
            "success" => {
                if cancel_flag.load(Ordering::Relaxed) {
                    return Ok(StepResult {
                        step_id: step.id.clone(),
                        status: PipelineStatus::Cancelled,
                        output: None,
                        duration_ms: start.elapsed().as_millis() as u64,
                        error: Some("Operation cancelled".to_string()),
                    });
                }
                
                Ok(StepResult {
                    step_id: step.id.clone(),
                    status: PipelineStatus::Success,
                    output: output.map(|o| o.to_string()),
                    duration_ms: start.elapsed().as_millis() as u64,
                    error: None,
                })
            }
            "failure" => {
                Ok(StepResult {
                    step_id: step.id.clone(),
                    status: PipelineStatus::Failed,
                    output: None,
                    duration_ms: start.elapsed().as_millis() as u64,
                    error: Some(output.unwrap_or("Simulated mock failure").to_string()),
                })
            }
            "timeout" | "cancellation" => {
                let mut elapsed = Duration::ZERO;
                let interval = Duration::from_millis(5);
                while elapsed < Duration::from_secs(5) {
                    if cancel_flag.load(Ordering::Relaxed) {
                        return Ok(StepResult {
                            step_id: step.id.clone(),
                            status: PipelineStatus::Cancelled,
                            output: None,
                            duration_ms: start.elapsed().as_millis() as u64,
                            error: Some("Operation cancelled".to_string()),
                        });
                    }
                    tokio::time::sleep(interval).await;
                    elapsed += interval;
                }
                
                Ok(StepResult {
                    step_id: step.id.clone(),
                    status: PipelineStatus::Failed,
                    output: None,
                    duration_ms: start.elapsed().as_millis() as u64,
                    error: Some("Mock timeout exceeded".to_string()),
                })
            }
            _ => Err(PipelineError::ValidationError(format!("Unknown mock behavior: {}", behavior))),
        }
    }
}
