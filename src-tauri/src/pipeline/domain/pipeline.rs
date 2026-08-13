use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::pipeline::domain::stage::PipelineStage;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PipelineTriggerSpec {
    pub trigger_type: String, // "push", "pull_request", "schedule", "manual"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branches: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paths: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cron: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PipelineDefinition {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: u32,
    pub trigger: String, // e.g., manual, git_push, schedule
    
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub triggers: Option<Vec<PipelineTriggerSpec>>,

    pub stages: Vec<PipelineStage>,
    
    #[serde(default)]
    pub metadata: HashMap<String, String>,

    #[serde(default)]
    pub verification_status: crate::pipeline::domain::provenance::VerificationStatus,

    #[serde(default)]
    pub confidence_score: f32,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provenance: Option<crate::pipeline::domain::provenance::PipelineProvenance>,

    #[serde(default)]
    pub status: crate::pipeline::domain::status::PipelineStatus,
}
