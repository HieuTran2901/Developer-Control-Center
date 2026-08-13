use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ActionType {
    Command,
    FileRead,
    FileWrite,
    FileDelete,
    Network,
    Git,
    ExportPipeline,
    EnvironmentMutation,
    DeploymentExecution,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", content = "details", rename_all = "camelCase")]
pub enum PolicyDecision {
    Allow {
        #[serde(rename = "riskLevel")]
        risk_level: RiskLevel,
        #[serde(rename = "reasonCode")]
        reason_code: String,
    },
    Deny {
        #[serde(rename = "riskLevel")]
        risk_level: RiskLevel,
        #[serde(rename = "reasonCode")]
        reason_code: String,
        message: String,
    },
    RequireApproval {
        #[serde(rename = "approvalId")]
        approval_id: String,
        #[serde(rename = "riskLevel")]
        risk_level: RiskLevel,
        #[serde(rename = "reasonCode")]
        reason_code: String,
        prompt: String,
        #[serde(rename = "actionFingerprint")]
        action_fingerprint: String,
        #[serde(rename = "expiresAtMs")]
        expires_at_ms: u64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PolicyEvaluationRequest {
    pub execution_id: String,
    pub pipeline_id: String,
    pub stage_id: String,
    pub step_id: String,
    pub step_type: String,
    pub environment_id: Option<String>,
    pub platform: Option<String>,
    pub action_type: ActionType,
    pub command: Option<String>,
    pub args: Vec<String>,
    pub cwd: Option<String>,
    pub path: Option<String>,
    pub url: Option<String>,
    pub workspace_root: String,
    pub policy_version: String,
    pub pipeline_version: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PolicyEvaluationResult {
    pub decision: PolicyDecision,
    pub evaluated_at_ms: u64,
    pub policy_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalRequest {
    pub approval_id: String,
    pub execution_id: String,
    pub step_id: String,
    pub action_fingerprint: String,
    pub approved: bool,
    pub timestamp_ms: u64,
}
