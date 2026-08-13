use crate::pipeline::renderer::PipelineRenderer;
use crate::pipeline::domain::{PipelineDefinition, PipelineStepType, StepConfig};

pub struct ShellRenderer;

impl PipelineRenderer for ShellRenderer {
    fn supports_capability(&self, step_type: &PipelineStepType) -> bool {
        matches!(step_type, PipelineStepType::Command | PipelineStepType::Script)
    }

    fn render(&self, pipeline: &PipelineDefinition) -> Result<String, String> {
        let mut script = String::new();
        
        script.push_str("#!/usr/bin/env bash\n");
        script.push_str("set -euo pipefail\n\n");
        
        script.push_str(&format!("# Pipeline: {}\n\n", pipeline.name));

        for stage in &pipeline.stages {
            script.push_str(&format!("echo \"[STAGE] {}\"\n", stage.name));
            
            for step in &stage.steps {
                if !self.supports_capability(&step.step_type) {
                    return Err(format!("Unsupported step type for Generic Shell: {:?}", step.step_type));
                }

                script.push_str(&format!("echo \"  -> Running: {}\"\n", step.name));
                match &step.config {
                    StepConfig::Command { command, args, cwd } => {
                        let mut cmd_str = String::new();
                        
                        if let Some(c) = cwd {
                            cmd_str.push_str(&format!("cd {} && ", shlex_quote(c)));
                        }
                        
                        cmd_str.push_str(&shlex_quote(command));
                        
                        for arg in args {
                            let arg_translated = if arg.starts_with("secret://") {
                                let key = arg.split('/').last().unwrap_or("UNKNOWN_SECRET");
                                format!("\"${}\"", key.to_uppercase().replace("-", "_"))
                            } else {
                                shlex_quote(arg)
                            };
                            cmd_str.push_str(&format!(" {}", arg_translated));
                        }
                        
                        script.push_str(&format!("{}\n", cmd_str));
                    },
                    StepConfig::Script { script_content, .. } => {
                        script.push_str(script_content);
                        script.push_str("\n");
                    },
                    _ => {
                        return Err(format!("Unsupported step config for Generic Shell"));
                    }
                }
            }
            script.push_str("\n");
        }
        
        Ok(script)
    }
}

/// A simple function to quote arguments safely for bash
fn shlex_quote(s: &str) -> String {
    if s.is_empty() {
        return "''".to_string();
    }
    // If it only contains safe characters, return as is
    if s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '@' | '%' | '_' | '+' | ',' | '-' | '.' | '/' | ':')) {
        return s.to_string();
    }
    // Otherwise, wrap in single quotes and escape existing single quotes
    format!("'{}'", s.replace("'", "'\\''"))
}
