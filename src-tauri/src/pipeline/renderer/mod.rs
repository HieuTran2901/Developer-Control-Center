pub mod github;
pub mod gitlab;
pub mod shell;

#[cfg(test)]
pub mod tests;

use crate::pipeline::domain::{PipelineDefinition, PipelineStepType};

pub trait PipelineRenderer: Send + Sync {
    fn supports_capability(&self, step_type: &PipelineStepType) -> bool;
    fn render(&self, pipeline: &PipelineDefinition) -> Result<String, String>;
}

pub struct RendererFactory;

impl RendererFactory {
    pub fn get(platform: &str) -> Result<Box<dyn PipelineRenderer>, String> {
        match platform.to_lowercase().as_str() {
            "github actions" | "github" => Ok(Box::new(github::GitHubActionsRenderer)),
            "gitlab ci" | "gitlab" => Ok(Box::new(gitlab::GitLabCiRenderer)),
            "generic shell" | "shell" => Ok(Box::new(shell::ShellRenderer)),
            _ => Err(format!("Unsupported platform: {}", platform)),
        }
    }
}
