use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::pipeline::domain::stage::PipelineStage;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PipelineDefinition {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: u32,
    pub trigger: String, // e.g., manual, git_push, schedule
    pub stages: Vec<PipelineStage>,
    
    #[serde(default)]
    pub metadata: HashMap<String, String>,
}
