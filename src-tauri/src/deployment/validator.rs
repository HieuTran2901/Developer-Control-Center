use crate::config::ConfigStore;
use crate::deployment::domain::DeploymentRequest;
use std::sync::Arc;
use crate::pipeline::domain::pipeline::PipelineDefinition;

pub struct DeploymentValidator;

impl DeploymentValidator {
    pub fn validate(
        request: &DeploymentRequest,
        config_store: &Arc<ConfigStore>,
        pipelines: &[PipelineDefinition],
    ) -> Result<(), String> {
        let config = config_store.get_config();

        // 1. Pipeline existence
        let _pipeline = pipelines.iter().find(|p| p.id == request.pipeline_id)
            .ok_or_else(|| format!("Pipeline {} not found", request.pipeline_id))?;

        // 2. Environment existence
        let env = config.environments.iter().find(|e| e.id == request.environment_id)
            .ok_or_else(|| format!("Environment {} not found", request.environment_id))?;

        // 3. Platform support in environment (simulate finding matching target)
        // Ensure that the requested platform corresponds to an actual deployment target
        // For Generic Shell we might just allow it, but we enforce this logically
        let has_platform = env.deployment_targets.iter().any(|t| t.provider == request.platform);
        if !has_platform && request.platform != "generic" && request.platform != "shell" && request.platform != "github" && request.platform != "gitlab" {
            // Strictly speaking, we should just ensure the platform is one of the known ones
            // or is explicitly in deployment targets.
            // For now, ensure it's not arbitrary garbage.
            return Err(format!("Platform {} is not supported or not configured in environment targets", request.platform));
        }

        // Project binding is implicit for now as we operate in a single-project context (DCC is local)
        // If we had multi-project, we'd check pipeline.project_id == request.project_id.

        // Secret Reference structural validation
        for var in &env.variables {
            match var {
                crate::config::domain::EnvironmentVariable::SecretRef { reference, .. } => {
                    if !reference.starts_with("secret://env:") {
                        return Err(format!("Invalid secret reference format: {}", reference));
                    }
                }
                _ => {}
            }
        }

        Ok(())
    }
}
