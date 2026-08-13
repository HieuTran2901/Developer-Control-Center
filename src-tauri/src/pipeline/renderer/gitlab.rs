use crate::pipeline::renderer::PipelineRenderer;
use crate::pipeline::domain::{PipelineDefinition, PipelineStepType, StepConfig};

pub struct GitLabCiRenderer;

impl PipelineRenderer for GitLabCiRenderer {
    fn supports_capability(&self, step_type: &PipelineStepType) -> bool {
        matches!(step_type, PipelineStepType::Command | PipelineStepType::Script)
    }

    fn render(&self, pipeline: &PipelineDefinition) -> Result<String, String> {
        let mut yaml = String::new();
        
        // Add workflow rules for triggers
        if let Some(ref triggers) = pipeline.triggers {
            yaml.push_str("workflow:\n  rules:\n");
            for tr in triggers {
                let mut condition_parts = Vec::new();
                match tr.trigger_type.as_str() {
                    "push" | "git_push" => condition_parts.push(String::from("$CI_PIPELINE_SOURCE == \"push\"")),
                    "pull_request" => condition_parts.push(String::from("$CI_PIPELINE_SOURCE == \"merge_request_event\"")),
                    "schedule" => condition_parts.push(String::from("$CI_PIPELINE_SOURCE == \"schedule\"")),
                    "manual" => condition_parts.push(String::from("$CI_PIPELINE_SOURCE == \"web\"")),
                    _ => condition_parts.push(String::from("$CI_PIPELINE_SOURCE == \"push\"")),
                }

                if let Some(ref branches) = tr.branches {
                    if !branches.is_empty() {
                        let branch_conds: Vec<String> = branches.iter()
                            .map(|b| format!("$CI_COMMIT_BRANCH == \"{}\"", b))
                            .collect();
                        condition_parts.push(format!("({})", branch_conds.join(" || ")));
                    }
                }

                yaml.push_str(&format!("    - if: '{}'\n", condition_parts.join(" && ")));
                
                if let Some(ref paths) = tr.paths {
                    if !paths.is_empty() {
                        yaml.push_str("      changes:\n");
                        for path in paths {
                            yaml.push_str(&format!("        - {}\n", path));
                        }
                    }
                }
            }
            yaml.push_str("\n");
        } else {
            // Fallback to legacy string
            yaml.push_str("workflow:\n  rules:\n");
            match pipeline.trigger.as_str() {
                "manual" => yaml.push_str("    - if: '$CI_PIPELINE_SOURCE == \"web\"'\n"),
                "schedule" => yaml.push_str("    - if: '$CI_PIPELINE_SOURCE == \"schedule\"'\n"),
                _ => yaml.push_str("    - if: '$CI_PIPELINE_SOURCE == \"push\" || $CI_PIPELINE_SOURCE == \"merge_request_event\"'\n"),
            }
            yaml.push_str("\n");
        }
        
        yaml.push_str("stages:\n");
        for stage in &pipeline.stages {
            let stage_name = stage.name.to_lowercase().replace(" ", "-");
            yaml.push_str(&format!("  - {}\n", stage_name));
        }
        yaml.push_str("\n");

        for stage in &pipeline.stages {
            let stage_name = stage.name.to_lowercase().replace(" ", "-");
            
            yaml.push_str(&format!("{}:\n", stage_name));
            yaml.push_str(&format!("  stage: {}\n", stage_name));
            yaml.push_str("  image: alpine:latest\n");
            yaml.push_str("  script:\n");
            
            for step in &stage.steps {
                if !self.supports_capability(&step.step_type) {
                    return Err(format!("Unsupported step type for GitLab CI: {:?}", step.step_type));
                }

                yaml.push_str(&format!("    # {}\n", step.name));
                match &step.config {
                    StepConfig::Command { command, args, cwd } => {
                        let mut cmd_str = command.clone();
                        for arg in args {
                            let arg_translated = if arg.starts_with("secret://") {
                                let key = arg.split('/').last().unwrap_or("UNKNOWN_SECRET");
                                format!("${}", key.to_uppercase().replace("-", "_"))
                            } else {
                                arg.clone()
                            };
                            cmd_str.push_str(&format!(" {}", arg_translated));
                        }
                        
                        if let Some(c) = cwd {
                            yaml.push_str(&format!("    - cd {} && {}\n", c, cmd_str));
                        } else {
                            yaml.push_str(&format!("    - {}\n", cmd_str));
                        }
                    },
                    StepConfig::Script { script_content, .. } => {
                        let safe_script = script_content.clone();
                        for line in safe_script.lines() {
                            yaml.push_str(&format!("    - {}\n", line));
                        }
                    },
                    _ => {
                        return Err(format!("Unsupported step config for GitLab CI"));
                    }
                }
            }
            yaml.push_str("\n");
        }
        
        Ok(yaml.trim_end().to_string() + "\n")
    }
}
