use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::pipeline::domain::PipelineDefinition;
use regex::Regex;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AuditActor {
    Ai,
    User,
    System,
    PolicyEngine,
    Executor,
    Unknown,
}

impl Default for AuditActor {
    fn default() -> Self {
        AuditActor::Unknown
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PipelineHistoryEvent {
    pub event_id: String,
    
    #[serde(default)]
    pub sequence_number: u64,

    pub pipeline_id: String,
    pub pipeline_version: u32,
    pub event_type: String,
    
    #[serde(default)]
    pub actor: AuditActor,
    
    pub timestamp_ms: u64,
    
    #[serde(default)]
    pub stage_id: Option<String>,
    
    #[serde(default)]
    pub step_id: Option<String>,
    
    #[serde(default)]
    pub approval_id: Option<String>,
    
    #[serde(default)]
    pub execution_id: Option<String>,

    #[serde(default)]
    pub command_fingerprint: Option<String>,

    #[serde(default)]
    pub previous_state: Option<String>,

    #[serde(default)]
    pub new_state: Option<String>,

    #[serde(default)]
    pub reason_code: Option<String>,

    #[serde(default)]
    pub reason: Option<String>,

    #[serde(default)]
    pub policy_code: Option<String>,

    pub summary: String,
    
    #[serde(default)]
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PipelineVersionRecord {
    pub pipeline_id: String,
    pub version: u32,
    pub name: String,
    pub description: Option<String>,
    pub trigger: String,
    pub definition: PipelineDefinition,
    pub created_at_ms: u64,
    pub source_type: String, // "ai_generator", "manual", "imported"
    pub prompt_reference: Option<String>,
    pub provider_id: Option<String>,
    pub model_name: Option<String>,
    pub fingerprint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct SecuritySummary {
    pub allowed_count: u32,
    pub approval_required_count: u32,
    pub denied_count: u32,
    #[serde(default)]
    pub approved_count: u32,
    #[serde(default)]
    pub rejected_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PipelineHistorySummary {
    pub pipeline_id: String,
    pub pipeline_name: String,
    pub latest_version: u32,
    pub latest_status: String,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
    pub provider_id: Option<String>,
    pub model_name: Option<String>,
    pub security_summary: SecuritySummary,
    pub total_events: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StepDiff {
    pub step_id: String,
    pub step_name: String,
    pub diff_type: String, // "added", "removed", "modified", "unchanged"
    pub old_command: Option<String>,
    pub new_command: Option<String>,
    pub old_args: Vec<String>,
    pub new_args: Vec<String>,
    pub security_changed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VersionDiff {
    pub pipeline_id: String,
    pub v1: u32,
    pub v2: u32,
    pub added_stages: Vec<String>,
    pub removed_stages: Vec<String>,
    pub step_diffs: Vec<StepDiff>,
    pub has_security_changes: bool,
}

pub fn redact_sensitive_data(input: &str) -> String {
    if input.is_empty() {
        return String::new();
    }

    let secret_patterns = [
        r"(?i)(api[_-]?key|access[_-]?token|refresh[_-]?token|bearer[_-]?token|secret[_-]?key|password|auth[_-]?header|private[_-]?key|cookie)\s*[:=]\s*[^\s,;]+",
        r"(?i)bearer\s+[a-zA-Z0-9\-\._~\+\/]+=*",
        r"(?i)ghp_[a-zA-Z0-9]{36}",
        r"(?i)sk-[a-zA-Z0-9]{32,}",
    ];

    let mut redacted = input.to_string();
    for pat in secret_patterns {
        if let Ok(re) = Regex::new(pat) {
            redacted = re.replace_all(&redacted, "[REDACTED_SECRET]").to_string();
        }
    }
    redacted
}

pub fn redact_metadata(metadata: &mut HashMap<String, String>) {
    let sensitive_keys = [
        "password",
        "token",
        "secret",
        "key",
        "api_key",
        "apikey",
        "authorization",
        "auth",
        "header",
        "cookie",
        "private_key",
    ];

    for (k, v) in metadata.iter_mut() {
        let k_lower = k.to_lowercase();
        if sensitive_keys.iter().any(|sk| k_lower.contains(sk)) {
            *v = "[REDACTED_SECRET]".to_string();
        } else {
            *v = redact_sensitive_data(v);
        }
    }
}
