use crate::pipeline::renderer::PipelineRenderer;
use crate::pipeline::domain::{PipelineDefinition, PipelineStepType, StepConfig};

pub struct GitHubActionsRenderer;

impl PipelineRenderer for GitHubActionsRenderer {
    fn supports_capability(&self, step_type: &PipelineStepType) -> bool {
        matches!(step_type, PipelineStepType::Command | PipelineStepType::Script | PipelineStepType::Artifact)
    }

    fn render(&self, pipeline: &PipelineDefinition) -> Result<String, String> {
        if let Err(e) = crate::pipeline::domain::semantic_validation::validate_pipeline_semantics(pipeline) {
            return Err(format!("Export failed: pipeline failed semantic validation: {}", e));
        }

        let mut yaml = String::new();
        yaml.push_str(&format!("name: {}\n\n", pipeline.name));
        
        yaml.push_str("on:\n");
        if let Some(ref triggers) = pipeline.triggers {
            for tr in triggers {
                match tr.trigger_type.as_str() {
                    "manual" => yaml.push_str("  workflow_dispatch:\n"),
                    "push" | "git_push" => {
                        yaml.push_str("  push:\n");
                        if let Some(ref branches) = tr.branches {
                            yaml.push_str(&format!("    branches: {:?}\n", branches));
                        } else {
                            yaml.push_str("    branches: [ \"main\" ]\n");
                        }
                    }
                    "pull_request" => {
                        yaml.push_str("  pull_request:\n");
                        if let Some(ref branches) = tr.branches {
                            yaml.push_str(&format!("    branches: {:?}\n", branches));
                        } else {
                            yaml.push_str("    branches: [ \"main\" ]\n");
                        }
                    }
                    "schedule" => {
                        yaml.push_str("  schedule:\n");
                        if let Some(ref cron) = tr.cron {
                            yaml.push_str(&format!("    - cron: '{}'\n", cron));
                        }
                    }
                    _ => yaml.push_str("  workflow_dispatch:\n"),
                }
            }
        } else if pipeline.trigger == "manual" {
            yaml.push_str("  workflow_dispatch:\n");
        } else {
            yaml.push_str("  push:\n    branches: [ \"main\" ]\n");
            yaml.push_str("  pull_request:\n    branches: [ \"main\" ]\n");
        }

        yaml.push_str("\njobs:\n");

        let mut stage_meta = std::collections::HashMap::new();
        for stage in &pipeline.stages {
            let job_id = stage.name.to_lowercase().replace(" ", "-").replace("&", "and");
            let mut artifacts = Vec::new();
            for step in &stage.steps {
                if let StepConfig::Artifact { artifact_name, .. } = &step.config {
                    artifacts.push(artifact_name.clone());
                }
            }
            stage_meta.insert(stage.id.clone(), (stage.order, job_id, artifacts));
        }

        for stage in &pipeline.stages {
            let (my_order, my_job_id, _) = stage_meta.get(&stage.id).unwrap();
            
            yaml.push_str(&format!("  {}:\n", my_job_id));
            yaml.push_str("    runs-on: ubuntu-latest\n");
            
            let mut needed_jobs = Vec::new();
            let mut artifacts_to_download = Vec::new();
            for (_, (order, job_id, artifacts)) in &stage_meta {
                if order < my_order {
                    needed_jobs.push(job_id.clone());
                    for name in artifacts {
                        artifacts_to_download.push(name.clone());
                    }
                }
            }
            needed_jobs.sort();
            needed_jobs.dedup();
            artifacts_to_download.sort();
            artifacts_to_download.dedup();
            
            if !needed_jobs.is_empty() {
                yaml.push_str("    needs: [");
                yaml.push_str(&needed_jobs.join(", "));
                yaml.push_str("]\n");
            }
            
            yaml.push_str("    steps:\n");
            
            // Default checkout
            yaml.push_str("      - uses: actions/checkout@v4\n");
            
            for artifact_name in artifacts_to_download {
                yaml.push_str(&format!("      - name: Download artifact {}\n", artifact_name));
                yaml.push_str("        uses: actions/download-artifact@v4\n");
                yaml.push_str("        with:\n");
                yaml.push_str(&format!("          name: {}\n", artifact_name));
                yaml.push_str("          path: .\n");
            }
            
            for step in &stage.steps {
                if !self.supports_capability(&step.step_type) {
                    return Err(format!("Unsupported step type for GitHub Actions: {:?}", step.step_type));
                }

                yaml.push_str(&format!("      - name: {}\n", step.name));
                match &step.config {
                    StepConfig::Command { command, args, cwd } => {
                        let mut cmd_str = command.clone();
                        for arg in args {
                            let arg_translated = if arg.starts_with("secret://") {
                                let key = arg.split('/').last().unwrap_or("UNKNOWN_SECRET");
                                format!("${{{{ secrets.{} }}}}", key.to_uppercase().replace("-", "_"))
                            } else {
                                arg.clone()
                            };
                            cmd_str.push_str(&format!(" {}", arg_translated));
                        }
                        
                        if let Some(c) = cwd {
                            yaml.push_str(&format!("        working-directory: {}\n", c));
                        }
                        yaml.push_str(&format!("        run: {}\n", cmd_str));
                    },
                    StepConfig::Script { script_content, .. } => {
                        let mut safe_script = script_content.clone();
                        if safe_script.contains("secret://") {
                            safe_script = safe_script.replace("secret://", "${{ secrets.");
                        }
                        let indented_script = safe_script.lines().map(|l| format!("          {}", l)).collect::<Vec<_>>().join("\n");
                        yaml.push_str(&format!("        run: |\n{}\n", indented_script));
                    },
                    StepConfig::Artifact { artifact_name, path } => {
                        if artifact_name.trim().is_empty() {
                            return Err(format!("Validation failed: artifact_name is empty in step '{}'", step.name));
                        }
                        if path.trim().is_empty() {
                            return Err(format!("Validation failed: artifact path is empty in step '{}'", step.name));
                        }
                        if path.starts_with("/") {
                            return Err(format!("Validation failed: artifact path must be repository-relative in step '{}'", step.name));
                        }
                        if path.contains("../") {
                            return Err(format!("Validation failed: artifact path contains traversal in step '{}'", step.name));
                        }

                        yaml.push_str("        uses: actions/upload-artifact@v4\n");
                        yaml.push_str("        with:\n");
                        yaml.push_str(&format!("          name: {}\n", artifact_name));
                        yaml.push_str(&format!("          path: {}\n", path));
                    },
                    _ => {
                        return Err(format!("Unsupported step config for GitHub Actions"));
                    }
                }
            }
        }
        
        Ok(yaml)
    }
}
