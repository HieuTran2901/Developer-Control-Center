use std::collections::HashSet;
use crate::pipeline::domain::pipeline::PipelineDefinition;
use crate::pipeline::domain::error::PipelineError;

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
