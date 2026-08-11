use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use crate::ai::AIGateway;
use crate::pipeline::domain::{PipelineStep, PipelineError};
use crate::pipeline::executor::result::StepResult;

pub trait StepExecutor: Send + Sync {
    async fn execute(
        &self,
        step: &PipelineStep,
        ai_gateway: Option<&Arc<AIGateway>>,
        cancel_flag: Arc<AtomicBool>,
    ) -> Result<StepResult, PipelineError>;
}
