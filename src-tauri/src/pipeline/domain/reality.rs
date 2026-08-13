use std::path::{Path, PathBuf};

use crate::pipeline::discovery::ProjectIntelligence;
use crate::pipeline::domain::{
    PipelineDefinition, PipelineStep, StepConfig,
    provenance::{
        VerificationStatus, PipelineVerificationReport, StepVerificationResult,
        PipelineProvenance, PipelineStepProvenance
    }
};
use crate::pipeline::domain::lifecycle::get_analyzer;

pub struct RealityVerifier {
    project_path: PathBuf,
    intel: ProjectIntelligence,
}

impl RealityVerifier {
    pub fn new(project_path: &Path, intel: ProjectIntelligence) -> Self {
        Self {
            project_path: project_path.to_path_buf(),
            intel,
        }
    }

    pub fn verify_pipeline(&self, pipeline: &mut PipelineDefinition) -> PipelineVerificationReport {
        let mut report = PipelineVerificationReport {
            pipeline_id: pipeline.id.clone(),
            pipeline_version: pipeline.version,
            verification_id: uuid::Uuid::new_v4().to_string(),
            status: VerificationStatus::Validating,
            confidence: 1.0,
            verified_at: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
            components_checked: 0,
            steps: vec![],
            warnings: vec![],
            errors: vec![],
        };

        let all_global_evidence = vec![];
        let mut min_pipeline_confidence = 1.0_f32;

        let mut step_results = vec![];
        let mut components_touched = std::collections::HashSet::new();

        for stage in &mut pipeline.stages {
            for step in &mut stage.steps {
                let (step_res, prov) = self.verify_step(step);
                
                if let StepConfig::Command { cwd, .. } = &step.config {
                    if let Some(c) = cwd {
                        components_touched.insert(c.clone());
                    } else {
                        components_touched.insert("root".to_string());
                    }
                } else if let StepConfig::Artifact { path, .. } = &step.config {
                    components_touched.insert(path.clone()); // Simplification for now
                }

                if step_res.status == VerificationStatus::Rejected {
                    report.status = VerificationStatus::Rejected;
                } else if step_res.status == VerificationStatus::NeedsReview && report.status != VerificationStatus::Rejected {
                    report.status = VerificationStatus::NeedsReview;
                }

                if prov.step_confidence < min_pipeline_confidence {
                    min_pipeline_confidence = prov.step_confidence;
                }
                
                step.provenance = Some(prov);
                step_results.push(step_res);
            }
        }

        if report.status == VerificationStatus::Validating {
            report.status = VerificationStatus::Verified;
        }

        report.confidence = min_pipeline_confidence;
        report.components_checked = components_touched.len();
        report.steps = step_results;

        pipeline.verification_status = report.status.clone();
        pipeline.confidence_score = min_pipeline_confidence;
        pipeline.provenance = Some(PipelineProvenance {
            global_evidence: all_global_evidence,
            pipeline_confidence: min_pipeline_confidence,
        });

        report
    }

    fn verify_step(&self, step: &PipelineStep) -> (StepVerificationResult, PipelineStepProvenance) {
        let mut prov = PipelineStepProvenance {
            step_confidence: 1.0,
            ..Default::default()
        };

        let mut res = StepVerificationResult {
            step_id: step.id.clone(),
            status: VerificationStatus::Verified,
            cwd: ".".to_string(),
            command: None,
            evidence_matched: vec![],
            warnings: vec![],
            errors: vec![],
        };

        match &step.config {
            StepConfig::Command { command, args: _, cwd } => {
                let step_cwd = cwd.clone().unwrap_or_else(|| ".".to_string());
                res.cwd = step_cwd.clone();
                res.command = Some(command.clone());

                let mut comp_path = step_cwd.clone();
                if comp_path == "." || comp_path.is_empty() {
                    comp_path = "root".to_string();
                }

                if let Some(comp) = self.intel.components.iter().find(|c| c.path == comp_path) {
                    prov.step_confidence *= 0.99;
                    res.evidence_matched.push(format!("Component '{}' found", comp_path));

                    if !comp.has_valid_manifest {
                        res.errors.push(format!("Component '{}' lacks a valid manifest", comp_path));
                        res.status = VerificationStatus::Rejected;
                        prov.step_confidence = 0.0;
                    }

                    // Command wrapper physical check
                    if command.starts_with("./") {
                        let wrapper_name = command.trim_start_matches("./");
                        let wrapper_path = if comp_path == "root" {
                            self.project_path.join(wrapper_name)
                        } else {
                            self.project_path.join(&comp_path).join(wrapper_name)
                        };

                        if !wrapper_path.exists() {
                            res.errors.push(format!("Wrapper script '{}' does not exist in '{}'", wrapper_name, step_cwd));
                            res.status = VerificationStatus::Rejected;
                            prov.step_confidence = 0.0;
                        } else {
                            res.evidence_matched.push(format!("Wrapper '{}' exists", wrapper_name));
                        }
                    }

                    // Ecosystem check
                    if let Some(build_tool) = &comp.build_tool {
                        if let Some(analyzer) = get_analyzer(build_tool) {
                            if analyzer.implies_test(step) && !analyzer.implies_build(step) {
                                res.warnings.push(format!("Step implies test for {}", build_tool));
                            }
                        }
                    }

                } else {
                    res.errors.push(format!("Working directory '{}' not found in project", step_cwd));
                    res.status = VerificationStatus::Rejected;
                    prov.step_confidence = 0.0;
                }
            },
            StepConfig::Artifact { path, .. } => {
                res.cwd = path.clone();
                // We assume artifacts must be generated. We check if path looks valid.
                if path.starts_with("/") || path.contains("..") {
                    res.errors.push(format!("Artifact path '{}' must be repository-relative and cannot contain '..'", path));
                    res.status = VerificationStatus::Rejected;
                    prov.step_confidence = 0.0;
                }
            },
            _ => {}
        }

        (res, prov)
    }
}
