use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DeploymentStatus {
    Created,
    Validating,
    WaitingApproval,
    Approved,
    Running,
    Succeeded,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentRequest {
    pub deployment_id: String,
    pub project_id: String,
    pub pipeline_id: String,
    pub environment_id: String,
    pub platform: String,
    pub source_ref: String,
    pub variables_override: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentRecord {
    pub deployment_id: String,
    pub project_id: String,
    pub pipeline_id: String,
    pub environment_id: String,
    pub platform: String,
    pub source_ref: String,
    pub status: DeploymentStatus,
    pub created_at: u64,
    pub updated_at: u64,
    pub completed_at: Option<u64>,
    pub policy_decision: Option<String>,
    pub approval_id: Option<String>,
    pub error_message: Option<String>,
    pub execution_id: Option<String>,
    pub provider_execution_id: Option<String>,
    pub provider_status: Option<String>,
}
