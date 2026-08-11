use serde::{Deserialize, Serialize};
use crate::pipeline::domain::PipelineStatus;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StepResult {
    pub step_id: String,
    pub status: PipelineStatus,
    pub output: Option<String>,
    pub duration_ms: u64,
    pub error: Option<String>,
}
