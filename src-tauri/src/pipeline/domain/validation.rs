use std::collections::HashSet;
use crate::pipeline::domain::pipeline::PipelineDefinition;
use crate::pipeline::domain::error::PipelineError;
use crate::pipeline::domain::step::{PipelineStepType, StepConfig};

pub fn validate_pipeline(pipeline: &PipelineDefinition) -> Result<(), PipelineError> {
    if pipeline.id.trim().is_empty() {
        return Err(PipelineError::ValidationError("Pipeline ID cannot be empty".to_string()));
    }
    if pipeline.name.trim().is_empty() {
        return Err(PipelineError::ValidationError("Pipeline name cannot be empty".to_string()));
    }
    if pipeline.stages.is_empty() {
        return Err(PipelineError::ValidationError("Pipeline must have at least one stage".to_string()));
    }

    let mut stage_ids = HashSet::new();
    let mut step_ids = HashSet::new();

    for stage in &pipeline.stages {
        if stage.id.trim().is_empty() {
            return Err(PipelineError::ValidationError("Stage ID cannot be empty".to_string()));
        }
        if stage.name.trim().is_empty() {
            return Err(PipelineError::ValidationError(format!("Stage name cannot be empty for stage '{}'", stage.id)));
        }
        if !stage_ids.insert(&stage.id) {
            return Err(PipelineError::ValidationError(format!("Duplicate stage ID: {}", stage.id)));
        }
        if stage.steps.is_empty() {
            return Err(PipelineError::ValidationError(format!("Stage '{}' must have at least one step", stage.id)));
        }

        for step in &stage.steps {
            if step.id.trim().is_empty() {
                return Err(PipelineError::ValidationError("Step ID cannot be empty".to_string()));
            }
            if step.name.trim().is_empty() {
                return Err(PipelineError::ValidationError(format!("Step name cannot be empty for step '{}'", step.id)));
            }
            if !step_ids.insert(&step.id) {
                return Err(PipelineError::ValidationError(format!("Duplicate step ID: {}", step.id)));
            }
        }
    }

    Ok(())
}

pub fn validate_pipeline_ir(pipeline: &PipelineDefinition) -> Result<(), PipelineError> {
    // 1. Call standard validate_pipeline first
    validate_pipeline(pipeline)?;

    // 2. Perform deep IR validation on platforms and steps
    if let Some(platform) = pipeline.metadata.get("platform") {
        let p_lower = platform.to_lowercase();
        if p_lower != "github" && p_lower != "gitlab" && p_lower != "shell" {
            return Err(PipelineError::ValidationError(format!("Unsupported platform: {}", platform)));
        }
    }

    for stage in &pipeline.stages {
        for step in &stage.steps {
            // Check matching step_type and config
            match (&step.step_type, &step.config) {
                (PipelineStepType::AiAgent, StepConfig::AiAgent { user_prompt_template, .. }) => {
                    if user_prompt_template.trim().is_empty() {
                        return Err(PipelineError::ValidationError(format!("User prompt template cannot be empty for step '{}'", step.id)));
                    }
                }
                (PipelineStepType::Prompt, StepConfig::Prompt { prompt_template, .. }) => {
                    if prompt_template.trim().is_empty() {
                        return Err(PipelineError::ValidationError(format!("Prompt template cannot be empty for step '{}'", step.id)));
                    }
                }
                (PipelineStepType::Command, StepConfig::Command { command, .. }) => {
                    if command.trim().is_empty() {
                        return Err(PipelineError::ValidationError(format!("Command cannot be empty for step '{}'", step.id)));
                    }
                }
                (PipelineStepType::Script, StepConfig::Script { script_content, .. }) => {
                    if script_content.trim().is_empty() {
                        return Err(PipelineError::ValidationError(format!("Script content cannot be empty for step '{}'", step.id)));
                    }
                }
                (PipelineStepType::Http, StepConfig::Http { url, method, .. }) => {
                    if url.trim().is_empty() {
                        return Err(PipelineError::ValidationError(format!("HTTP URL cannot be empty for step '{}'", step.id)));
                    }
                    if method.trim().is_empty() {
                        return Err(PipelineError::ValidationError(format!("HTTP Method cannot be empty for step '{}'", step.id)));
                    }
                    if !url.starts_with("http://") && !url.starts_with("https://") {
                        return Err(PipelineError::ValidationError(format!("Invalid HTTP URL protocol in step '{}': {}", step.id, url)));
                    }
                }
                (PipelineStepType::Artifact, StepConfig::Artifact { artifact_name, path }) => {
                    if artifact_name.trim().is_empty() {
                        return Err(PipelineError::ValidationError(format!("Artifact name cannot be empty for step '{}'", step.id)));
                    }
                    if path.trim().is_empty() {
                        return Err(PipelineError::ValidationError(format!("Artifact path cannot be empty for step '{}'", step.id)));
                    }
                }
                (PipelineStepType::Approval, StepConfig::Approval { approvers, .. }) => {
                    if approvers.is_empty() {
                        return Err(PipelineError::ValidationError(format!("Approvers list cannot be empty for step '{}'", step.id)));
                    }
                }
                (PipelineStepType::Condition, StepConfig::Condition { expression }) => {
                    if expression.trim().is_empty() {
                        return Err(PipelineError::ValidationError(format!("Condition expression cannot be empty for step '{}'", step.id)));
                    }
                }
                (PipelineStepType::Mock, StepConfig::Mock { behavior, .. }) => {
                    if behavior != "success" && behavior != "failure" && behavior != "timeout" {
                        return Err(PipelineError::ValidationError(format!("Invalid mock behavior for step '{}': {}", step.id, behavior)));
                    }
                }
                _ => {
                    return Err(PipelineError::ValidationError(format!("Step type and config mismatch in step '{}'", step.id)));
                }
            }

            // Check for malformed secret:// templates
            match &step.config {
                StepConfig::Command { command, args, .. } => {
                    validate_secret_ref(command, &step.id)?;
                    for arg in args {
                        validate_secret_ref(arg, &step.id)?;
                    }
                }
                StepConfig::Script { script_content, .. } => {
                    validate_secret_ref(script_content, &step.id)?;
                }
                StepConfig::Http { body, headers, .. } => {
                    if let Some(b) = body {
                        validate_secret_ref(b, &step.id)?;
                    }
                    if let Some(h) = headers {
                        for (k, v) in h {
                            validate_secret_ref(k, &step.id)?;
                            validate_secret_ref(v, &step.id)?;
                        }
                    }
                }
                _ => {}
            }
        }
    }

    Ok(())
}

fn validate_secret_ref(text: &str, step_id: &str) -> Result<(), PipelineError> {
    let mut cursor = 0;
    while let Some(pos) = text[cursor..].find("secret://") {
        let actual_pos = cursor + pos;
        let rest = &text[actual_pos + 9..];
        let end_idx = rest.find(|c: char| !c.is_alphanumeric() && c != '_' && c != '-' && c != '/').unwrap_or(rest.len());
        let ref_part = &rest[..end_idx];
        
        let parts: Vec<&str> = ref_part.split('/').collect();
        if parts.len() != 2 || parts[0].is_empty() || parts[1].is_empty() {
            return Err(PipelineError::ValidationError(format!(
                "Malformed secret reference in step '{}': secret://{}",
                step_id, ref_part
            )));
        }
        cursor = actual_pos + 9 + end_idx;
    }
    Ok(())
}
