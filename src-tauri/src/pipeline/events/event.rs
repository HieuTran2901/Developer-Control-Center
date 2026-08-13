#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(tag = "type", content = "payload", rename_all = "camelCase")]
pub enum PipelineEvent {
    PipelineStarted {
        #[serde(rename = "executionId")]
        execution_id: String,
        #[serde(rename = "pipelineId")]
        pipeline_id: String,
        timestamp: u64,
        #[serde(rename = "sequenceNumber")]
        sequence_number: u32,
    },
    StageStarted {
        #[serde(rename = "executionId")]
        execution_id: String,
        #[serde(rename = "stageId")]
        stage_id: String,
        #[serde(rename = "stageIndex")]
        stage_index: usize,
        timestamp: u64,
        #[serde(rename = "sequenceNumber")]
        sequence_number: u32,
    },
    StepStarted {
        #[serde(rename = "executionId")]
        execution_id: String,
        #[serde(rename = "stageId")]
        stage_id: String,
        #[serde(rename = "stepId")]
        step_id: String,
        #[serde(rename = "stepIndex")]
        step_index: usize,
        timestamp: u64,
        #[serde(rename = "sequenceNumber")]
        sequence_number: u32,
    },
    StepProgress {
        #[serde(rename = "executionId")]
        execution_id: String,
        #[serde(rename = "stageId")]
        stage_id: String,
        #[serde(rename = "stepId")]
        step_id: String,
        progress: u8,
        timestamp: u64,
        #[serde(rename = "sequenceNumber")]
        sequence_number: u32,
    },
    StepCompleted {
        #[serde(rename = "executionId")]
        execution_id: String,
        #[serde(rename = "stageId")]
        stage_id: String,
        #[serde(rename = "stepId")]
        step_id: String,
        status: String,
        #[serde(rename = "durationMs")]
        duration_ms: u64,
        timestamp: u64,
        #[serde(rename = "sequenceNumber")]
        sequence_number: u32,
    },
    StageCompleted {
        #[serde(rename = "executionId")]
        execution_id: String,
        #[serde(rename = "stageId")]
        stage_id: String,
        #[serde(rename = "stageIndex")]
        stage_index: usize,
        status: String,
        timestamp: u64,
        #[serde(rename = "sequenceNumber")]
        sequence_number: u32,
    },
    PipelineCompleted {
        #[serde(rename = "executionId")]
        execution_id: String,
        status: String,
        #[serde(rename = "durationMs")]
        duration_ms: u64,
        timestamp: u64,
        #[serde(rename = "sequenceNumber")]
        sequence_number: u32,
    },
    PipelineFailed {
        #[serde(rename = "executionId")]
        execution_id: String,
        #[serde(rename = "errorCode")]
        error_code: String,
        #[serde(rename = "errorMessage")]
        error_message: String,
        #[serde(rename = "stageId")]
        stage_id: Option<String>,
        #[serde(rename = "stepId")]
        step_id: Option<String>,
        timestamp: u64,
        #[serde(rename = "sequenceNumber")]
        sequence_number: u32,
    },
    PipelineCancelled {
        #[serde(rename = "executionId")]
        execution_id: String,
        reason: String,
        timestamp: u64,
        #[serde(rename = "sequenceNumber")]
        sequence_number: u32,
    },
    PolicyEvaluated {
        #[serde(rename = "executionId")]
        execution_id: String,
        #[serde(rename = "stepId")]
        step_id: String,
        decision: String,
        #[serde(rename = "riskLevel")]
        risk_level: String,
        #[serde(rename = "reasonCode")]
        reason_code: String,
        timestamp: u64,
        #[serde(rename = "sequenceNumber")]
        sequence_number: u32,
    },
    PolicyDenied {
        #[serde(rename = "executionId")]
        execution_id: String,
        #[serde(rename = "stepId")]
        step_id: String,
        #[serde(rename = "reasonCode")]
        reason_code: String,
        message: String,
        timestamp: u64,
        #[serde(rename = "sequenceNumber")]
        sequence_number: u32,
    },
    PolicyApprovalRequired {
        #[serde(rename = "executionId")]
        execution_id: String,
        #[serde(rename = "stepId")]
        step_id: String,
        #[serde(rename = "approvalId")]
        approval_id: String,
        #[serde(rename = "actionFingerprint")]
        action_fingerprint: String,
        prompt: String,
        timestamp: u64,
        #[serde(rename = "sequenceNumber")]
        sequence_number: u32,
    },
    PolicyApproved {
        #[serde(rename = "executionId")]
        execution_id: String,
        #[serde(rename = "stepId")]
        step_id: String,
        #[serde(rename = "approvalId")]
        approval_id: String,
        timestamp: u64,
        #[serde(rename = "sequenceNumber")]
        sequence_number: u32,
    },
}
