use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum PipelineStepType {
    AiAgent,
    Prompt,
    Command,
    Script,
    Http,
    Artifact,
    Approval,
    Condition,
    Mock,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "config", rename_all = "camelCase")]
pub enum StepConfig {
    AiAgent {
        provider_id: String,
        model: Option<String>,
        system_prompt: Option<String>,
        user_prompt_template: String,
    },
    Prompt {
        provider_id: String,
        model: Option<String>,
        prompt_template: String,
    },
    Command {
        command: String,
        args: Vec<String>,
        cwd: Option<String>,
    },
    Script {
        script_content: String,
        interpreter: Option<String>,
    },
    Http {
        url: String,
        method: String,
        headers: Option<std::collections::HashMap<String, String>>,
        body: Option<String>,
    },
    Approval {
        approvers: Vec<String>,
        timeout_seconds: Option<u64>,
    },
    Condition {
        expression: String,
    },
    Artifact {
        artifact_name: String,
        path: String,
    },
    Mock {
        behavior: String, // "success", "failure", "timeout"
        output: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PipelineStep {
    pub id: String,
    pub name: String,
    pub step_type: PipelineStepType,
    pub config: StepConfig,
    pub order: u32,
    pub timeout_seconds: Option<u64>,
    
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provenance: Option<crate::pipeline::domain::provenance::PipelineStepProvenance>,
}
