use serde::{Deserialize, Serialize};
use crate::pipeline::domain::step::PipelineStep;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PipelineStage {
    pub id: String,
    pub name: String,
    pub order: u32,
    pub steps: Vec<PipelineStep>,
}
