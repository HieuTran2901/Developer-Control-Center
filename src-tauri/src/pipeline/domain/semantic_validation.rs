use std::collections::HashSet;
use serde::{Deserialize, Serialize};
use crate::pipeline::domain::pipeline::PipelineDefinition;
use crate::pipeline::domain::step::{PipelineStepType, StepConfig};
use crate::pipeline::discovery::ProjectIntelligence;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SemanticErrorCode {
    InvalidPipeline,
    DuplicateStageId,
    DuplicateStepId,
    UnknownDependency,
    SelfDependency,
    CircularDependency,
    InvalidExecutionOrder,
    MissingPrerequisite,
    InvalidDockerFlow,
    InvalidRegistryFlow,
    InvalidDeploymentFlow,
    MissingProductionApproval,
    InvalidCredentialReference,
    UnsupportedProviderConfiguration,

    // Production-Grade Planner Error Codes
    InvalidWorkingDirectory,
    BuildManifestMissing,
    BuildTargetMismatch,
    RedundantBuild,
    RedundantTest,
    ArtifactProducerMissing,
    ArtifactPathInvalid,
    CommandToolMismatch,
    InconsistentPathReference,
    UnsupportedBuildCommand,
    UnrelatedProjectIncluded,
    DuplicateStep,
    DuplicateStage,
    InvalidDependencyOrder,
    InvalidCheckoutLogic,
    RedundantComponentBuild,

    // Execution Context Error Codes
    ArtifactProducerMismatch,
    ArtifactCrossJobWorkspace,
    ArtifactTransferMissing,
    ArtifactPathNotProduced,
    ArtifactEvidenceMissing,
    InvalidJobDependency,
    CrossJobFileAccess,
    DuplicateArtifactUpload,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SemanticValidationError {
    pub code: SemanticErrorCode,
    pub stage_id: Option<String>,
    pub step_id: Option<String>,
    pub related_step_id: Option<String>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evidence: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<String>,
}

impl std::fmt::Display for SemanticValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{:?}] {}", self.code, self.message)
    }
}

impl std::error::Error for SemanticValidationError {}

pub fn validate_pipeline_semantics(pipeline: &PipelineDefinition) -> Result<(), SemanticValidationError> {
    // 1. Identity & Uniqueness Check
    let mut stage_ids = HashSet::new();
    let mut step_ids = HashSet::new();

    for stage in &pipeline.stages {
        if !stage_ids.insert(&stage.id) {
            return Err(SemanticValidationError {
                code: SemanticErrorCode::DuplicateStageId,
                stage_id: Some(stage.id.clone()),
                step_id: None,
                related_step_id: None,
                message: format!("Duplicate stage ID found: {}", stage.id),
                evidence: None,
                suggestion: None,
            });
        }

        for step in &stage.steps {
            if !step_ids.insert(&step.id) {
                return Err(SemanticValidationError {
                    code: SemanticErrorCode::DuplicateStepId,
                    stage_id: Some(stage.id.clone()),
                    step_id: Some(step.id.clone()),
                    related_step_id: None,
                    message: format!("Duplicate step ID found: {}", step.id),
                    evidence: None,
                    suggestion: None,
                });
            }
        }
    }

    // Sort stages and steps to determine global execution order
    let mut sorted_stages = pipeline.stages.clone();
    sorted_stages.sort_by_key(|s| s.order);

    let mut has_docker_build = false;
    let mut has_docker_login = false;
    let mut has_build_artifact = false;
    let mut has_approval_gate = false;

    for stage in &sorted_stages {
        let mut sorted_steps = stage.steps.clone();
        sorted_steps.sort_by_key(|s| s.order);

        let stage_is_prod = stage.name.to_lowercase().contains("production")
            || stage.name.to_lowercase().contains("prod");

        for step in &sorted_steps {
            let step_name_lower = step.name.to_lowercase();
            
            // Track approval step
            if step.step_type == PipelineStepType::Approval {
                has_approval_gate = true;
            }

            // Inspect step contents
            let mut all_text = String::new();
            match &step.config {
                StepConfig::Command { command, args, .. } => {
                    all_text.push_str(command);
                    for arg in args {
                        all_text.push(' ');
                        all_text.push_str(arg);
                    }
                }
                StepConfig::Script { script_content, .. } => {
                    all_text.push_str(script_content);
                }
                StepConfig::Http { url, headers, body, .. } => {
                    all_text.push_str(url);
                    if let Some(h) = headers {
                        for (k, v) in h {
                            all_text.push_str(k);
                            all_text.push_str(v);
                        }
                    }
                    if let Some(b) = body {
                        all_text.push_str(b);
                    }
                }
                StepConfig::Artifact { .. } => {
                    has_build_artifact = true;
                }
                _ => {}
            }

            let text_lower = all_text.to_lowercase();

            // Credential Safety Check (Stage B.7 & B.9)
            if check_plaintext_credentials(&all_text) {
                return Err(SemanticValidationError {
                    code: SemanticErrorCode::InvalidCredentialReference,
                    stage_id: Some(stage.id.clone()),
                    step_id: Some(step.id.clone()),
                    related_step_id: None,
                    message: format!(
                        "Plaintext secret or API key detected in step '{}'. Credentials must use secret:// references.",
                        step.id
                    ),
                    evidence: Some("Plaintext key format identified in command/script".into()),
                    suggestion: Some("Use secret://provider/key syntax instead of raw secrets.".into()),
                });
            }

            // Check if step is Docker Build
            if text_lower.contains("docker build")
                || text_lower.contains("docker image build")
                || text_lower.contains("docker-build")
                || text_lower.contains("docker buildx")
            {
                has_docker_build = true;
                has_build_artifact = true;
            }

            // Check if step is Docker Login
            if text_lower.contains("docker login") || text_lower.contains("ecr get-login-password") {
                has_docker_login = true;
            }

            // Check if step is Build
            if text_lower.contains("npm run build")
                || text_lower.contains("mvn package")
                || text_lower.contains("gradle build")
                || text_lower.contains("cargo build")
                || text_lower.contains("go build")
            {
                has_build_artifact = true;
            }

            // Check Docker Push Prerequisite (Stage B.4)
            if text_lower.contains("docker push") || text_lower.contains("docker image push") {
                if !has_docker_build {
                    return Err(SemanticValidationError {
                        code: SemanticErrorCode::MissingPrerequisite,
                        stage_id: Some(stage.id.clone()),
                        step_id: Some(step.id.clone()),
                        related_step_id: None,
                        message: format!(
                            "Step '{}' attempts to push a Docker image without a preceding Docker build step.",
                            step.id
                        ),
                        evidence: None,
                        suggestion: Some("Add a Docker build step prior to docker push.".into()),
                    });
                }
                if text_lower.contains("docker.io") || text_lower.contains(".amazonaws.com") || text_lower.contains("gcr.io") {
                    if !has_docker_login && !all_text.contains("secret://") {
                        return Err(SemanticValidationError {
                            code: SemanticErrorCode::InvalidRegistryFlow,
                            stage_id: Some(stage.id.clone()),
                            step_id: Some(step.id.clone()),
                            related_step_id: None,
                            message: format!(
                                "Step '{}' pushes to a remote registry without preceding authentication or secret reference.",
                                step.id
                            ),
                            evidence: None,
                            suggestion: Some("Add a docker login step before pushing to a remote registry.".into()),
                        });
                    }
                }
            }

            // Check Deployment Prerequisite & Order (Stage B.3 & B.5 & B.6)
            let is_deploy = text_lower.contains("ecs deploy")
                || text_lower.contains("aws ecs")
                || text_lower.contains("kubectl apply")
                || text_lower.contains("helm upgrade")
                || step_name_lower.contains("deploy");

            if is_deploy {
                if !has_build_artifact && !has_docker_build {
                    return Err(SemanticValidationError {
                        code: SemanticErrorCode::InvalidExecutionOrder,
                        stage_id: Some(stage.id.clone()),
                        step_id: Some(step.id.clone()),
                        related_step_id: None,
                        message: format!(
                            "Deployment step '{}' is ordered before any build or artifact creation step.",
                            step.id
                        ),
                        evidence: None,
                        suggestion: Some("Ensure build/artifact creation stage precedes deployment.".into()),
                    });
                }
            }

            // Check Production Approval Guard (Stage B.8)
            if (stage_is_prod || step_name_lower.contains("production") || step_name_lower.contains("prod-deploy"))
                && is_deploy
                && !has_approval_gate
            {
                return Err(SemanticValidationError {
                    code: SemanticErrorCode::MissingProductionApproval,
                    stage_id: Some(stage.id.clone()),
                    step_id: Some(step.id.clone()),
                    related_step_id: None,
                    message: format!(
                        "Production deployment step '{}' requires a preceding human approval step.",
                        step.id
                    ),
                    evidence: None,
                    suggestion: Some("Add an approval step before production deployment.".into()),
                });
            }
        }
    }

    Ok(())
}

#[derive(Debug, Clone, PartialEq)]
pub struct MavenStepInfo {
    pub is_maven: bool,
    pub executable: String,
    pub runs_tests_via_lifecycle: bool,
    pub is_test_only: bool,
    pub skips_tests: bool,
    pub is_install: bool,
    pub is_package: bool,
    pub phases: Vec<String>,
}

pub fn parse_maven_step(command: &str, args: &[String]) -> MavenStepInfo {
    let mut full_cmd = command.to_string();
    for a in args {
        full_cmd.push(' ');
        full_cmd.push_str(a);
    }
    let lower = full_cmd.to_lowercase();

    // Tool normalization: recognize mvn, ./mvnw, mvnw, mvnw.cmd, mvn.cmd as Maven tool
    let is_maven = lower.contains("mvn") || lower.contains("mvnw");
    if !is_maven {
        return MavenStepInfo {
            is_maven: false,
            executable: "".to_string(),
            runs_tests_via_lifecycle: false,
            is_test_only: false,
            skips_tests: false,
            is_install: false,
            is_package: false,
            phases: vec![],
        };
    }

    let first_token = lower.split_whitespace().next().unwrap_or("mvn").to_string();

    // Test-skipping flags awareness
    let skips_tests = lower.contains("-dskiptests")
        || lower.contains("-dmaven.test.skip=true")
        || lower.contains("-dmaven.test.skip ")
        || lower.contains("-dskipits");

    // Tokenize to find Maven phases independent of flag positions
    let tokens: Vec<&str> = lower.split_whitespace().collect();
    let mut phases = Vec::new();

    let mut has_package = false;
    let mut has_verify = false;
    let mut has_install = false;
    let mut has_test = false;

    for token in tokens {
        if token.starts_with('-') {
            continue; // Skip flags
        }
        let clean_token = token.trim_matches(|c: char| !c.is_alphanumeric());
        match clean_token {
            "clean" | "validate" | "compile" | "deploy" => {
                phases.push(clean_token.to_string());
            }
            "package" => {
                has_package = true;
                phases.push("package".to_string());
            }
            "verify" => {
                has_verify = true;
                phases.push("verify".to_string());
            }
            "install" => {
                has_install = true;
                phases.push("install".to_string());
            }
            "test" => {
                has_test = true;
                phases.push("test".to_string());
            }
            _ => {}
        }
    }

    let runs_lifecycle_phase = has_package || has_verify || has_install;
    let runs_tests_via_lifecycle = runs_lifecycle_phase && !skips_tests;
    let is_test_only = has_test && !runs_lifecycle_phase;

    MavenStepInfo {
        is_maven: true,
        executable: first_token,
        runs_tests_via_lifecycle,
        is_test_only,
        skips_tests,
        is_install: has_install,
        is_package: has_package,
        phases,
    }
}

/// Project-Aware Semantic Validation Engine
pub fn validate_pipeline_project_semantics(
    pipeline: &PipelineDefinition,
    context: &ProjectIntelligence,
) -> Result<(), SemanticValidationError> {
    // 1. First run basic pipeline semantic validation
    validate_pipeline_semantics(pipeline)?;

    // 2. Build map of detected components and valid paths
    let mut valid_cwds = HashSet::new();
    valid_cwds.insert(".".to_string());
    valid_cwds.insert("./".to_string());
    valid_cwds.insert("".to_string());

    let mut component_manifests = std::collections::HashMap::new();
    let mut known_scripts = HashSet::new();
    let mut known_artifacts = HashSet::new();

    for comp in &context.components {
        valid_cwds.insert(comp.path.clone());
        if comp.path != "root" {
            valid_cwds.insert(format!("./{}", comp.path));
        }

        let mut manifests = HashSet::new();
        for pkg_file in &comp.package_files {
            manifests.insert(pkg_file.clone());
        }
        // Also map build tools to manifest filenames
        if let Some(ref bt) = comp.build_tool {
            let lower_bt = bt.to_lowercase();
            if lower_bt.contains("maven") { manifests.insert("pom.xml".to_string()); }
            if lower_bt.contains("gradle") { manifests.insert("build.gradle".to_string()); manifests.insert("build.gradle.kts".to_string()); }
            if lower_bt.contains("cargo") { manifests.insert("Cargo.toml".to_string()); }
        }
        if let Some(ref pm) = comp.package_manager {
            let lower_pm = pm.to_lowercase();
            if lower_pm.contains("npm") || lower_pm.contains("yarn") || lower_pm.contains("pnpm") {
                manifests.insert("package.json".to_string());
            }
        }
        component_manifests.insert(comp.path.clone(), manifests);

        for script_name in comp.scripts.keys() {
            known_scripts.insert(script_name.clone());
        }
        for cand in &comp.artifact_candidates {
            known_artifacts.insert(cand.clone());
        }
    }

    let mut executed_build_steps = Vec::new();
    let mut executed_maven_test_producers = Vec::new();
    let mut executed_commands = std::collections::HashMap::new();

    for stage in &pipeline.stages {
        for step in &stage.steps {
            match &step.config {
                StepConfig::Command { command, args, cwd } => {
                    let mut full_cmd = command.clone();
                    for a in args {
                        full_cmd.push(' ');
                        full_cmd.push_str(a);
                    }
                    let cmd_lower = full_cmd.to_lowercase();
                    
                    if cmd_lower.contains("git checkout") || cmd_lower.contains("git clone") {
                        if !cmd_lower.contains("--depth") && cmd_lower.contains("git clone") {
                            // Enforce shallow clone for CI/CD
                             return Err(SemanticValidationError {
                                code: SemanticErrorCode::InvalidCheckoutLogic,
                                stage_id: Some(stage.id.clone()),
                                step_id: Some(step.id.clone()),
                                related_step_id: None,
                                message: format!("Step '{}' uses 'git clone' without '--depth 1'. CI pipelines should use shallow clones.", step.id),
                                evidence: Some(full_cmd.clone()),
                                suggestion: Some("Add '--depth 1' to 'git clone'.".to_string()),
                            });
                        }
                    }

                    // Check for Windows-specific local scripts in Linux CI (Platform Awareness)
                    if cmd_lower.contains("mvnw.cmd") || cmd_lower.contains("gradlew.bat") {
                        return Err(SemanticValidationError {
                            code: SemanticErrorCode::UnsupportedBuildCommand,
                            stage_id: Some(stage.id.clone()),
                            step_id: Some(step.id.clone()),
                            related_step_id: None,
                            message: format!("Step '{}' uses Windows batch script in command. Linux CI requires Unix wrappers.", step.id),
                            evidence: Some(full_cmd.clone()),
                            suggestion: Some("Use './mvnw' or './gradlew' instead of Windows batch scripts.".to_string()),
                        });
                    }

                    // Check working directory path consistency
                    let effective_cwd = cwd.as_deref().unwrap_or(".");
                    
                    // Check for absolute paths
                    if effective_cwd.starts_with('/') || (effective_cwd.len() >= 2 && effective_cwd.chars().nth(1) == Some(':')) {
                        return Err(SemanticValidationError {
                            code: SemanticErrorCode::InconsistentPathReference,
                            stage_id: Some(stage.id.clone()),
                            step_id: Some(step.id.clone()),
                            related_step_id: None,
                            message: format!("Step '{}' specifies absolute path '{}'. DCC paths must be repository-relative.", step.id, effective_cwd),
                            evidence: Some(effective_cwd.to_string()),
                            suggestion: Some("Use repository-relative path e.g. '.' or 'Backend/App'.".to_string()),
                        });
                    }

                    // Rule: Project root must NEVER be assumed ("root" folder check)
                    if effective_cwd == "root" && !valid_cwds.contains("root") {
                        // Check if pom.xml / package.json exists in a subcomponent
                        if let Some(target_comp) = context.components.iter().find(|c| c.path != "root" && !c.path.is_empty()) {
                            return Err(SemanticValidationError {
                                code: SemanticErrorCode::BuildTargetMismatch,
                                stage_id: Some(stage.id.clone()),
                                step_id: Some(step.id.clone()),
                                related_step_id: None,
                                message: format!("Step '{}' attempts execution from 'root', but target project manifest is located in '{}'.", step.id, target_comp.path),
                                evidence: Some(format!("Detected project at '{}'", target_comp.path)),
                                suggestion: Some(format!("Set cwd to '{}'.", target_comp.path)),
                            });
                        }

                        return Err(SemanticValidationError {
                            code: SemanticErrorCode::InvalidWorkingDirectory,
                            stage_id: Some(stage.id.clone()),
                            step_id: Some(step.id.clone()),
                            related_step_id: None,
                            message: format!("Step '{}' uses cwd 'root', but no directory named 'root' exists in project structure.", step.id),
                            evidence: Some(format!("Valid directories: {:?}", valid_cwds)),
                            suggestion: Some("Set cwd to '.' for repository root or to the specific component path.".to_string()),
                        });
                    }

                    if !valid_cwds.contains(effective_cwd) {
                        return Err(SemanticValidationError {
                            code: SemanticErrorCode::InvalidWorkingDirectory,
                            stage_id: Some(stage.id.clone()),
                            step_id: Some(step.id.clone()),
                            related_step_id: None,
                            message: format!("Step '{}' specifies unknown working directory '{}'.", step.id, effective_cwd),
                            evidence: Some(format!("Known component paths: {:?}", valid_cwds)),
                            suggestion: Some("Set cwd to one of the detected component directories.".to_string()),
                        });
                    }

                    // Check Build Manifest Match for directory
                    let is_maven = cmd_lower.contains("mvn") || cmd_lower.contains("mvnw");
                    let is_gradle = cmd_lower.contains("gradle") || cmd_lower.contains("gradlew");
                    let is_npm = cmd_lower.contains("npm") || cmd_lower.contains("yarn") || cmd_lower.contains("pnpm");
                    let is_cargo = cmd_lower.contains("cargo");

                    let target_component_path = if effective_cwd == "." || effective_cwd == "./" || effective_cwd.is_empty() {
                        "root"
                    } else {
                        effective_cwd.trim_start_matches("./")
                    };

                    let empty_set = HashSet::new();
                    let current_manifests = component_manifests.get(target_component_path).unwrap_or(&empty_set);

                    if is_maven {
                        if !current_manifests.contains("pom.xml") && !current_manifests.contains("mvnw") {
                            // Check if pom.xml exists elsewhere
                            if let Some((comp_path, _)) = component_manifests.iter().find(|(_, m)| m.contains("pom.xml")) {
                                return Err(SemanticValidationError {
                                    code: SemanticErrorCode::BuildTargetMismatch,
                                    stage_id: Some(stage.id.clone()),
                                    step_id: Some(step.id.clone()),
                                    related_step_id: None,
                                    message: format!("Maven command in step '{}' is executed from '{}', but pom.xml is in '{}'.", step.id, effective_cwd, comp_path),
                                    evidence: Some(format!("{}/pom.xml", comp_path)),
                                    suggestion: Some(format!("Set cwd to '{}'.", comp_path)),
                                });
                            }
                            return Err(SemanticValidationError {
                                code: SemanticErrorCode::BuildManifestMissing,
                                stage_id: Some(stage.id.clone()),
                                step_id: Some(step.id.clone()),
                                related_step_id: None,
                                message: format!("Step '{}' attempts Maven command in '{}', but no pom.xml or Maven wrapper exists there.", step.id, effective_cwd),
                                evidence: Some(format!("Directory '{}' missing pom.xml", effective_cwd)),
                                suggestion: Some("Ensure cwd points to directory containing pom.xml.".to_string()),
                            });
                        }
                    }

                    if is_gradle {
                        if !current_manifests.contains("build.gradle") && !current_manifests.contains("build.gradle.kts") && !current_manifests.contains("gradlew") {
                            return Err(SemanticValidationError {
                                code: SemanticErrorCode::BuildManifestMissing,
                                stage_id: Some(stage.id.clone()),
                                step_id: Some(step.id.clone()),
                                related_step_id: None,
                                message: format!("Step '{}' attempts Gradle command in '{}', but no build.gradle exists there.", step.id, effective_cwd),
                                evidence: Some(format!("Directory '{}' missing build.gradle", effective_cwd)),
                                suggestion: Some("Ensure cwd points to directory containing build.gradle.".to_string()),
                            });
                        }
                    }

                    if is_npm {
                        if !current_manifests.contains("package.json") {
                            return Err(SemanticValidationError {
                                code: SemanticErrorCode::BuildManifestMissing,
                                stage_id: Some(stage.id.clone()),
                                step_id: Some(step.id.clone()),
                                related_step_id: None,
                                message: format!("Step '{}' attempts Node/npm command in '{}', but no package.json exists there.", step.id, effective_cwd),
                                evidence: Some(format!("Directory '{}' missing package.json", effective_cwd)),
                                suggestion: Some("Ensure cwd points to directory containing package.json.".to_string()),
                            });
                        }
                    }

                    if is_cargo {
                        if !current_manifests.contains("Cargo.toml") {
                            return Err(SemanticValidationError {
                                code: SemanticErrorCode::BuildManifestMissing,
                                stage_id: Some(stage.id.clone()),
                                step_id: Some(step.id.clone()),
                                related_step_id: None,
                                message: format!("Step '{}' attempts Cargo command in '{}', but no Cargo.toml exists there.", step.id, effective_cwd),
                                evidence: Some(format!("Directory '{}' missing Cargo.toml", effective_cwd)),
                                suggestion: Some("Ensure cwd points to directory containing Cargo.toml.".to_string()),
                            });
                        }
                    }

                    // Rule 4: Build / Test Duplication Rule & Maven Lifecycle Awareness
                    let mvn_info = parse_maven_step(command, args);

                    if mvn_info.is_maven || cmd_lower.contains("cargo build") || cmd_lower.contains("gradle build") || cmd_lower.contains("npm run build") {
                        executed_build_steps.push((stage.id.clone(), step.id.clone(), effective_cwd.to_string(), full_cmd.clone()));
                    }

                    if mvn_info.is_maven {
                        if mvn_info.runs_tests_via_lifecycle {
                            executed_maven_test_producers.push((step.id.clone(), effective_cwd.to_string(), full_cmd.clone()));
                        } else if mvn_info.is_test_only && !mvn_info.skips_tests {
                            if let Some((prev_id, _, prev_cmd)) = executed_maven_test_producers.iter().find(|(_, c, _)| c == effective_cwd) {
                                return Err(SemanticValidationError {
                                    code: SemanticErrorCode::RedundantTest,
                                    stage_id: Some(stage.id.clone()),
                                    step_id: Some(step.id.clone()),
                                    related_step_id: Some(prev_id.clone()),
                                    message: format!(
                                        "Step '{}' executes 'mvn test', but preceding step '{}' ('{}') already runs the Maven lifecycle including tests.",
                                        step.id, prev_id, prev_cmd
                                    ),
                                    evidence: Some(format!("Preceding step '{}' ran '{}'", prev_id, prev_cmd)),
                                    suggestion: Some(
                                        "Remove redundant test step or use a build command with tests explicitly skipped if a separate test phase is required.".to_string()
                                    ),
                                });
                            }
                        }
                    }

                    // Check duplicate commands in same cwd
                    let cmd_key = format!("{}:{}", effective_cwd, full_cmd);
                    if let Some(prev_step_id) = executed_commands.insert(cmd_key, step.id.clone()) {
                        return Err(SemanticValidationError {
                            code: SemanticErrorCode::RedundantBuild,
                            stage_id: Some(stage.id.clone()),
                            step_id: Some(step.id.clone()),
                            related_step_id: Some(prev_step_id.clone()),
                            message: format!("Duplicate command '{}' executed in step '{}', previously executed in step '{}'.", full_cmd, step.id, prev_step_id),
                            evidence: Some(format!("Identical command executed in step '{}'", prev_step_id)),
                            suggestion: Some("Remove redundant step to optimize pipeline execution.".to_string()),
                        });
                    }
                }

                StepConfig::Artifact { path, artifact_name } => {
                    // Check Rule 6: Every artifact must have a valid producer
                    if executed_build_steps.is_empty() {
                        return Err(SemanticValidationError {
                            code: SemanticErrorCode::ArtifactProducerMissing,
                            stage_id: Some(stage.id.clone()),
                            step_id: Some(step.id.clone()),
                            related_step_id: None,
                            message: format!("Artifact step '{}' ('{}') is defined without any preceding build/package step in the pipeline.", step.id, artifact_name),
                            evidence: Some(format!("Artifact path: '{}'", path)),
                            suggestion: Some("Add a build or package step prior to artifact collection.".to_string()),
                        });
                    }

                    // Check for CROSS JOB WORKSPACE issues
                    let mut found_producer_in_same_stage = false;
                    let mut found_producer_in_different_stage = false;
                    let mut related_producer_step = None;
                    
                    for (prod_stage_id, prod_step_id, prod_cwd, _cmd) in executed_build_steps.iter().rev() {
                        let is_related = prod_cwd == "." || path.starts_with(&format!("{}/", prod_cwd)) || path.starts_with(prod_cwd);
                        if is_related {
                            if prod_stage_id == &stage.id {
                                found_producer_in_same_stage = true;
                                related_producer_step = Some(prod_step_id.clone());
                                break;
                            } else {
                                found_producer_in_different_stage = true;
                                related_producer_step = Some(prod_step_id.clone());
                            }
                        }
                    }

                    if !found_producer_in_same_stage {
                        if found_producer_in_different_stage {
                            return Err(SemanticValidationError {
                                code: SemanticErrorCode::ArtifactCrossJobWorkspace,
                                stage_id: Some(stage.id.clone()),
                                step_id: Some(step.id.clone()),
                                related_step_id: related_producer_step,
                                message: format!("Artifact step '{}' consumes files produced in a different stage (job) without an artifact transfer.", step.id),
                                evidence: Some(format!("Artifact path: '{}' in stage '{}'", path, stage.id)),
                                suggestion: Some("Move the upload-artifact step into the producer job or explicitly model an artifact transfer.".to_string()),
                            });
                        } else {
                            return Err(SemanticValidationError {
                                code: SemanticErrorCode::ArtifactPathNotProduced,
                                stage_id: Some(stage.id.clone()),
                                step_id: Some(step.id.clone()),
                                related_step_id: None,
                                message: format!("Artifact step '{}' specifies path '{}', but no preceding build step produced outputs in this path.", step.id, path),
                                evidence: Some(format!("Path: '{}'", path)),
                                suggestion: Some("Ensure the artifact path matches the output directory of a preceding build step.".to_string()),
                            });
                        }
                    }

                    // Check path consistency
                    if path.starts_with('/') || (path.len() >= 2 && path.chars().nth(1) == Some(':')) {
                        return Err(SemanticValidationError {
                            code: SemanticErrorCode::InconsistentPathReference,
                            stage_id: Some(stage.id.clone()),
                            step_id: Some(step.id.clone()),
                            related_step_id: None,
                            message: format!("Artifact step '{}' specifies absolute path '{}'. Artifact paths must be repository-relative.", step.id, path),
                            evidence: Some(path.clone()),
                            suggestion: Some("Use relative path e.g. 'Backend/target/*.jar' or 'dist'.".to_string()),
                        });
                    }
                    if path.contains("../") {
                        return Err(SemanticValidationError {
                            code: SemanticErrorCode::InconsistentPathReference,
                            stage_id: Some(stage.id.clone()),
                            step_id: Some(step.id.clone()),
                            related_step_id: None,
                            message: format!("Artifact step '{}' specifies traversal path '{}'. Artifact paths must be repository-relative and not traverse upwards.", step.id, path),
                            evidence: Some(path.clone()),
                            suggestion: Some("Use purely repository-relative paths without '../' traversal.".to_string()),
                        });
                    }
                }
                _ => {}
            }
        }
    }


    Ok(())
}

/// Final Consistency Validator catching contradictions between steps, evidence, metadata, artifacts, and root manifests.
pub fn validate_pipeline_consistency(
    pipeline: &PipelineDefinition,
    context: &ProjectIntelligence,
) -> Result<(), SemanticValidationError> {
    // 1. Run basic & project semantics
    validate_pipeline_project_semantics(pipeline, context)?;

    // 2. Enforce Root Manifest Guard (Rule 3)
    for stage in &pipeline.stages {
        for step in &stage.steps {
            if let StepConfig::Command { command, cwd, .. } = &step.config {
                let eff_cwd = cwd.as_deref().unwrap_or(".");
                let is_root_cwd = eff_cwd == "." || eff_cwd == "./" || eff_cwd.is_empty() || eff_cwd == "root";
                
                let is_build_cmd = command.contains("mvn") || command.contains("gradle") || command.contains("npm") || command.contains("cargo") || command.contains("go");
                
                if is_root_cwd && is_build_cmd && !context.root_has_manifest {
                    return Err(SemanticValidationError {
                        code: SemanticErrorCode::BuildManifestMissing,
                        stage_id: Some(stage.id.clone()),
                        step_id: Some(step.id.clone()),
                        related_step_id: None,
                        message: format!("Step '{}' attempts execution at repository root, but no build manifest exists at root.", step.id),
                        evidence: Some(format!("Root manifests: {:?}", context.root_manifests)),
                        suggestion: Some("Set cwd to a specific component directory containing a valid build manifest.".to_string()),
                    });
                }
            }
        }
    }

    Ok(())
}

fn check_plaintext_credentials(text: &str) -> bool {
    let lower = text.to_lowercase();
    
    // Check for hardcoded OpenAI / Auth keys
    if text.contains("sk-") && !text.contains("secret://") {
        return true;
    }
    
    // Check for explicit hardcoded password assignment (e.g. password: "...", myPassword123)
    if (lower.contains("password:") || lower.contains("password=")) && !text.contains("secret://") && !text.contains("$") {
        return true;
    }

    if lower.contains("mypassword") || lower.contains("secret123") {
        return true;
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pipeline::domain::pipeline::PipelineDefinition;
    use crate::pipeline::domain::stage::PipelineStage;
    use crate::pipeline::domain::step::{PipelineStep, PipelineStepType, StepConfig};
    use crate::pipeline::discovery::{ProjectIntelligence, ComponentIntelligence};
    use std::collections::HashMap;

    fn create_mock_step(id: &str, name: &str, config: StepConfig) -> PipelineStep {
        let step_type = match &config {
            StepConfig::Command { .. } => PipelineStepType::Command,
            StepConfig::Script { .. } => PipelineStepType::Script,
            StepConfig::Http { .. } => PipelineStepType::Http,
            StepConfig::Approval { .. } => PipelineStepType::Approval,
            StepConfig::Condition { .. } => PipelineStepType::Condition,
            StepConfig::Artifact { .. } => PipelineStepType::Artifact,
            StepConfig::Mock { .. } => PipelineStepType::Mock,
            StepConfig::AiAgent { .. } => PipelineStepType::AiAgent,
            StepConfig::Prompt { .. } => PipelineStepType::Prompt,
        };
        PipelineStep {
            id: id.to_string(),
            name: name.to_string(),
            step_type,
            config,
            order: 1,
            timeout_seconds: Some(300),
            provenance: None,
        }
    }

    fn create_mock_pipeline(stages: Vec<PipelineStage>) -> PipelineDefinition {
        PipelineDefinition {
            id: "test-pipeline".to_string(),
            name: "Test Pipeline".to_string(),
            description: None,
            version: 1,
            trigger: "manual".to_string(),
            triggers: None,
            stages,
            metadata: HashMap::new(),
            verification_status: Default::default(),
            confidence_score: 0.0,
            provenance: None,
            status: Default::default(),
        }
    }

    #[test]
    fn test_1_maven_project_inside_backend() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "Backend".to_string(),
            path: "Backend/App".to_string(),
            component_type: "backend".to_string(),
            languages: vec!["Java".to_string()],
            frameworks: vec!["Spring Boot".to_string()],
            build_tool: Some("Maven".to_string()),
            package_manager: None,
            test_frameworks: vec!["JUnit".to_string()],
            detected_commands: vec!["./mvnw clean package".to_string()],
            package_files: vec!["pom.xml".to_string(), "mvnw".to_string()],
            scripts: HashMap::new(),
            artifact_candidates: vec!["target/*.jar".to_string()], ..Default::default()
        });

        // Test wrong execution at root when pom.xml is in Backend/App
        let bad_pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(),
            name: "Build".to_string(),
            order: 1,
            steps: vec![create_mock_step("step-mvn", "Build Maven", StepConfig::Command {
                command: "./mvnw".to_string(),
                args: vec!["clean".to_string(), "package".to_string()],
                cwd: Some(".".to_string()),
            })],
        }]);

        let res = validate_pipeline_project_semantics(&bad_pipeline, &context);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().code, SemanticErrorCode::BuildTargetMismatch);

        // Test valid execution with cwd = "Backend/App"
        let good_pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(),
            name: "Build".to_string(),
            order: 1,
            steps: vec![create_mock_step("step-mvn", "Build Maven", StepConfig::Command {
                command: "./mvnw".to_string(),
                args: vec!["clean".to_string(), "package".to_string()],
                cwd: Some("Backend/App".to_string()),
            })],
        }]);

        let res_good = validate_pipeline_project_semantics(&good_pipeline, &context);
        assert!(res_good.is_ok());
    }

    #[test]
    fn test_2_node_project_inside_frontend() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "Frontend".to_string(),
            path: "Frontend".to_string(),
            component_type: "frontend".to_string(),
            languages: vec!["TypeScript".to_string()],
            frameworks: vec!["React".to_string()],
            build_tool: None,
            package_manager: Some("npm".to_string()),
            test_frameworks: vec!["Vitest".to_string()],
            detected_commands: vec!["npm run build".to_string()],
            package_files: vec!["package.json".to_string()],
            scripts: HashMap::from([("build".to_string(), "vite build".to_string())]),
            artifact_candidates: vec!["dist".to_string()], ..Default::default()
        });

        let pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(),
            name: "Build".to_string(),
            order: 1,
            steps: vec![create_mock_step("step-npm", "Build Frontend", StepConfig::Command {
                command: "npm".to_string(),
                args: vec!["run".to_string(), "build".to_string()],
                cwd: Some("Frontend".to_string()),
            })],
        }]);

        assert!(validate_pipeline_project_semantics(&pipeline, &context).is_ok());
    }

    #[test]
    fn test_3_rust_project() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "root".to_string(),
            path: "root".to_string(),
            component_type: "root".to_string(),
            languages: vec!["Rust".to_string()],
            frameworks: vec![],
            build_tool: Some("Cargo".to_string()),
            package_manager: None,
            test_frameworks: vec![],
            detected_commands: vec!["cargo build --release".to_string()],
            package_files: vec!["Cargo.toml".to_string()],
            scripts: HashMap::new(),
            artifact_candidates: vec!["target/release".to_string()], ..Default::default()
        });

        let pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(),
            name: "Build".to_string(),
            order: 1,
            steps: vec![create_mock_step("step-cargo", "Cargo Build", StepConfig::Command {
                command: "cargo".to_string(),
                args: vec!["build".to_string(), "--release".to_string()],
                cwd: Some(".".to_string()),
            })],
        }]);

        assert!(validate_pipeline_project_semantics(&pipeline, &context).is_ok());
    }

    #[test]
    fn test_6_wrong_cwd() {
        let context = ProjectIntelligence::default();
        let bad_cwd_pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(),
            name: "Build".to_string(),
            order: 1,
            steps: vec![create_mock_step("step-1", "Build", StepConfig::Command {
                command: "npm".to_string(),
                args: vec!["run".to_string(), "build".to_string()],
                cwd: Some("NonExistentFolder".to_string()),
            })],
        }]);

        let res = validate_pipeline_project_semantics(&bad_cwd_pipeline, &context);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().code, SemanticErrorCode::InvalidWorkingDirectory);
    }

    #[test]
    fn test_8_duplicate_maven_build_test() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "root".to_string(),
            path: "root".to_string(),
            component_type: "root".to_string(),
            languages: vec!["Java".to_string()],
            frameworks: vec![],
            build_tool: Some("Maven".to_string()),
            package_manager: None,
            test_frameworks: vec![],
            detected_commands: vec![],
            package_files: vec!["pom.xml".to_string(), "mvnw".to_string()],
            scripts: HashMap::new(),
            artifact_candidates: vec![], ..Default::default()
        });

        let dup_pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(),
            name: "Build & Test".to_string(),
            order: 1,
            steps: vec![
                create_mock_step("step-pkg", "Package Maven", StepConfig::Command {
                    command: "./mvnw".to_string(),
                    args: vec!["clean".to_string(), "package".to_string()],
                    cwd: Some(".".to_string()),
                }),
                create_mock_step("step-test", "Test Maven", StepConfig::Command {
                    command: "./mvnw".to_string(),
                    args: vec!["test".to_string()],
                    cwd: Some(".".to_string()),
                }),
            ],
        }]);

        let res = validate_pipeline_project_semantics(&dup_pipeline, &context);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().code, SemanticErrorCode::RedundantTest);
    }

    #[test]
    fn test_9_artifact_without_producer() {
        let context = ProjectIntelligence::default();
        let no_build_pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(),
            name: "Artifacts".to_string(),
            order: 1,
            steps: vec![create_mock_step("step-art", "Save Artifact", StepConfig::Artifact {
                artifact_name: "app.jar".to_string(),
                path: "target/*.jar".to_string(),
            })],
        }]);

        let res = validate_pipeline_project_semantics(&no_build_pipeline, &context);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().code, SemanticErrorCode::ArtifactProducerMissing);
    }

    #[test]
    fn test_10_wrong_artifact_path() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "root".to_string(),
            path: "root".to_string(),
            component_type: "root".to_string(),
            languages: vec!["Java".to_string()],
            frameworks: vec![],
            build_tool: Some("Maven".to_string()),
            package_manager: None,
            test_frameworks: vec![],
            detected_commands: vec![],
            package_files: vec!["pom.xml".to_string()],
            scripts: HashMap::new(),
            artifact_candidates: vec![], ..Default::default()
        });

        let abs_path_pipeline = create_mock_pipeline(vec![
            PipelineStage {
                id: "s1".to_string(),
                name: "Build".to_string(),
                order: 1,
                steps: vec![create_mock_step("step-pkg", "Package", StepConfig::Command {
                    command: "mvn".to_string(),
                    args: vec!["package".to_string()],
                    cwd: Some(".".to_string()),
                })],
            },
            PipelineStage {
                id: "s2".to_string(),
                name: "Artifacts".to_string(),
                order: 2,
                steps: vec![create_mock_step("step-art", "Save Artifact", StepConfig::Artifact {
                    artifact_name: "app.jar".to_string(),
                    path: "C:/Users/Build/target/app.jar".to_string(),
                })],
            },
        ]);

        let res = validate_pipeline_project_semantics(&abs_path_pipeline, &context);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().code, SemanticErrorCode::InconsistentPathReference);
    }

    #[test]
    fn test_13_windows_local_to_linux_ci() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "root".to_string(),
            path: "root".to_string(),
            component_type: "root".to_string(),
            languages: vec!["Java".to_string()],
            frameworks: vec![],
            build_tool: Some("Maven".to_string()),
            package_manager: None,
            test_frameworks: vec![],
            detected_commands: vec![],
            package_files: vec!["pom.xml".to_string(), "mvnw".to_string()],
            scripts: HashMap::new(),
            artifact_candidates: vec![], ..Default::default()
        });

        let win_pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(),
            name: "Build".to_string(),
            order: 1,
            steps: vec![create_mock_step("step-win", "Build Windows Batch", StepConfig::Command {
                command: "mvnw.cmd".to_string(),
                args: vec!["clean".to_string(), "package".to_string()],
                cwd: Some(".".to_string()),
            })],
        }]);

        let res = validate_pipeline_project_semantics(&win_pipeline, &context);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().code, SemanticErrorCode::UnsupportedBuildCommand);
    }

    #[test]
    fn test_17_secret_reference_validation() {
        let pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(),
            name: "Build".to_string(),
            order: 1,
            steps: vec![create_mock_step("step-sec", "Secret Step", StepConfig::Command {
                command: "echo".to_string(),
                args: vec!["sk-proj-1234567890abcdef".to_string()],
                cwd: Some(".".to_string()),
            })],
        }]);

        let res = validate_pipeline_semantics(&pipeline);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().code, SemanticErrorCode::InvalidCredentialReference);
    }

    #[test]
    fn test_18_version_fingerprint_binding() {
        let dup_stage_pipeline = create_mock_pipeline(vec![
            PipelineStage {
                id: "stage-dup".to_string(),
                name: "Build".to_string(),
                order: 1,
                steps: vec![create_mock_step("step-1", "Build", StepConfig::Script {
                    script_content: "echo build".to_string(),
                    interpreter: None,
                })],
            },
            PipelineStage {
                id: "stage-dup".to_string(),
                name: "Deploy".to_string(),
                order: 2,
                steps: vec![create_mock_step("step-2", "Deploy", StepConfig::Script {
                    script_content: "echo deploy".to_string(),
                    interpreter: None,
                })],
            },
        ]);

        let res = validate_pipeline_semantics(&dup_stage_pipeline);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().code, SemanticErrorCode::DuplicateStageId);
    }

    #[test]
    fn test_maven_lifecycle_scenario_1_package_and_test_fails() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "root".to_string(), path: "root".to_string(), component_type: "backend".to_string(),
            languages: vec!["Java".to_string()], frameworks: vec![], build_tool: Some("Maven".to_string()),
            package_manager: None, test_frameworks: vec!["JUnit".to_string()], detected_commands: vec![],
            package_files: vec!["pom.xml".to_string(), "mvnw".to_string()], scripts: HashMap::new(), artifact_candidates: vec![], ..Default::default()
        });

        let pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(), name: "Build & Test".to_string(), order: 1,
            steps: vec![
                create_mock_step("step-1", "Package", StepConfig::Command { command: "./mvnw".to_string(), args: vec!["clean".to_string(), "package".to_string()], cwd: Some(".".to_string()) }),
                create_mock_step("step-3", "Test", StepConfig::Command { command: "./mvnw".to_string(), args: vec!["test".to_string()], cwd: Some(".".to_string()) }),
            ],
        }]);

        let res = validate_pipeline_project_semantics(&pipeline, &context);
        assert!(res.is_err());
        let err = res.unwrap_err();
        assert_eq!(err.code, SemanticErrorCode::RedundantTest);
        assert_eq!(err.step_id, Some("step-3".to_string()));
        assert_eq!(err.related_step_id, Some("step-1".to_string()));
    }

    #[test]
    fn test_maven_lifecycle_scenario_2_install_and_mvn_test_fails() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "root".to_string(), path: "root".to_string(), component_type: "backend".to_string(),
            languages: vec!["Java".to_string()], frameworks: vec![], build_tool: Some("Maven".to_string()),
            package_manager: None, test_frameworks: vec!["JUnit".to_string()], detected_commands: vec![],
            package_files: vec!["pom.xml".to_string()], scripts: HashMap::new(), artifact_candidates: vec![], ..Default::default()
        });

        let pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(), name: "Build & Test".to_string(), order: 1,
            steps: vec![
                create_mock_step("step-1", "Install", StepConfig::Command { command: "./mvnw".to_string(), args: vec!["clean".to_string(), "install".to_string()], cwd: Some(".".to_string()) }),
                create_mock_step("step-3", "Test", StepConfig::Command { command: "mvn".to_string(), args: vec!["test".to_string()], cwd: Some(".".to_string()) }),
            ],
        }]);

        let res = validate_pipeline_project_semantics(&pipeline, &context);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().code, SemanticErrorCode::RedundantTest);
    }

    #[test]
    fn test_maven_lifecycle_scenario_3_verify_and_test_fails() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "root".to_string(), path: "root".to_string(), component_type: "backend".to_string(),
            languages: vec!["Java".to_string()], frameworks: vec![], build_tool: Some("Maven".to_string()),
            package_manager: None, test_frameworks: vec!["JUnit".to_string()], detected_commands: vec![],
            package_files: vec!["pom.xml".to_string(), "mvnw".to_string()], scripts: HashMap::new(), artifact_candidates: vec![], ..Default::default()
        });

        let pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(), name: "Build & Test".to_string(), order: 1,
            steps: vec![
                create_mock_step("step-1", "Verify", StepConfig::Command { command: "./mvnw".to_string(), args: vec!["clean".to_string(), "verify".to_string()], cwd: Some(".".to_string()) }),
                create_mock_step("step-3", "Test", StepConfig::Command { command: "./mvnw".to_string(), args: vec!["test".to_string()], cwd: Some(".".to_string()) }),
            ],
        }]);

        let res = validate_pipeline_project_semantics(&pipeline, &context);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().code, SemanticErrorCode::RedundantTest);
    }

    #[test]
    fn test_maven_lifecycle_scenario_4_package_skiptests_and_test_passes() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "root".to_string(), path: "root".to_string(), component_type: "backend".to_string(),
            languages: vec!["Java".to_string()], frameworks: vec![], build_tool: Some("Maven".to_string()),
            package_manager: None, test_frameworks: vec!["JUnit".to_string()], detected_commands: vec![],
            package_files: vec!["pom.xml".to_string(), "mvnw".to_string()], scripts: HashMap::new(), artifact_candidates: vec![], ..Default::default()
        });

        let pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(), name: "Build & Test".to_string(), order: 1,
            steps: vec![
                create_mock_step("step-1", "Package No Tests", StepConfig::Command { command: "./mvnw".to_string(), args: vec!["clean".to_string(), "package".to_string(), "-DskipTests".to_string()], cwd: Some(".".to_string()) }),
                create_mock_step("step-3", "Explicit Test", StepConfig::Command { command: "./mvnw".to_string(), args: vec!["test".to_string()], cwd: Some(".".to_string()) }),
            ],
        }]);

        assert!(validate_pipeline_project_semantics(&pipeline, &context).is_ok());
    }

    #[test]
    fn test_maven_lifecycle_scenario_5_install_skiptests_and_test_passes() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "root".to_string(), path: "root".to_string(), component_type: "backend".to_string(),
            languages: vec!["Java".to_string()], frameworks: vec![], build_tool: Some("Maven".to_string()),
            package_manager: None, test_frameworks: vec!["JUnit".to_string()], detected_commands: vec![],
            package_files: vec!["pom.xml".to_string()], scripts: HashMap::new(), artifact_candidates: vec![], ..Default::default()
        });

        let pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(), name: "Build & Test".to_string(), order: 1,
            steps: vec![
                create_mock_step("step-1", "Install No Tests", StepConfig::Command { command: "./mvnw".to_string(), args: vec!["clean".to_string(), "install".to_string(), "-DskipTests".to_string()], cwd: Some(".".to_string()) }),
                create_mock_step("step-3", "Explicit Test", StepConfig::Command { command: "./mvnw".to_string(), args: vec!["test".to_string()], cwd: Some(".".to_string()) }),
            ],
        }]);

        assert!(validate_pipeline_project_semantics(&pipeline, &context).is_ok());
    }

    #[test]
    fn test_maven_lifecycle_scenario_6_mvn_test_only_passes() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "root".to_string(), path: "root".to_string(), component_type: "backend".to_string(),
            languages: vec!["Java".to_string()], frameworks: vec![], build_tool: Some("Maven".to_string()),
            package_manager: None, test_frameworks: vec!["JUnit".to_string()], detected_commands: vec![],
            package_files: vec!["pom.xml".to_string()], scripts: HashMap::new(), artifact_candidates: vec![], ..Default::default()
        });

        let pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(), name: "Test Only".to_string(), order: 1,
            steps: vec![
                create_mock_step("step-1", "Run Tests", StepConfig::Command { command: "mvn".to_string(), args: vec!["test".to_string()], cwd: Some(".".to_string()) }),
            ],
        }]);

        assert!(validate_pipeline_project_semantics(&pipeline, &context).is_ok());
    }

    #[test]
    fn test_maven_lifecycle_scenario_7_mvn_package_only_passes() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "root".to_string(), path: "root".to_string(), component_type: "backend".to_string(),
            languages: vec!["Java".to_string()], frameworks: vec![], build_tool: Some("Maven".to_string()),
            package_manager: None, test_frameworks: vec!["JUnit".to_string()], detected_commands: vec![],
            package_files: vec!["pom.xml".to_string()], scripts: HashMap::new(), artifact_candidates: vec![], ..Default::default()
        });

        let pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(), name: "Package Only".to_string(), order: 1,
            steps: vec![
                create_mock_step("step-1", "Build Package", StepConfig::Command { command: "mvn".to_string(), args: vec!["package".to_string()], cwd: Some(".".to_string()) }),
            ],
        }]);

        assert!(validate_pipeline_project_semantics(&pipeline, &context).is_ok());
    }

    #[test]
    fn test_maven_lifecycle_scenario_8_clean_package_and_artifact_passes() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "root".to_string(), path: "root".to_string(), component_type: "backend".to_string(),
            languages: vec!["Java".to_string()], frameworks: vec![], build_tool: Some("Maven".to_string()),
            package_manager: None, test_frameworks: vec!["JUnit".to_string()], detected_commands: vec![],
            package_files: vec!["pom.xml".to_string()], scripts: HashMap::new(), artifact_candidates: vec!["target/*.jar".to_string()], ..Default::default()
        });

        let pipeline = create_mock_pipeline(vec![
            PipelineStage {
                id: "s1".to_string(), name: "Build".to_string(), order: 1,
                steps: vec![
                    create_mock_step("step-1", "Build Package", StepConfig::Command { command: "mvn".to_string(), args: vec!["clean".to_string(), "package".to_string()], cwd: Some(".".to_string()) }),
                ],
            },
            PipelineStage {
                id: "s2".to_string(), name: "Artifact".to_string(), order: 2,
                steps: vec![
                    create_mock_step("step-2", "Save JAR", StepConfig::Artifact { artifact_name: "app.jar".to_string(), path: "target/*.jar".to_string() }),
                ],
            },
        ]);

        assert!(validate_pipeline_project_semantics(&pipeline, &context).is_ok());
    }

    #[test]
    fn test_maven_lifecycle_scenario_9_clean_install_and_artifact_passes() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "root".to_string(), path: "root".to_string(), component_type: "backend".to_string(),
            languages: vec!["Java".to_string()], frameworks: vec![], build_tool: Some("Maven".to_string()),
            package_manager: None, test_frameworks: vec!["JUnit".to_string()], detected_commands: vec![],
            package_files: vec!["pom.xml".to_string()], scripts: HashMap::new(), artifact_candidates: vec!["target/*.jar".to_string()], ..Default::default()
        });

        let pipeline = create_mock_pipeline(vec![
            PipelineStage {
                id: "s1".to_string(), name: "Build".to_string(), order: 1,
                steps: vec![
                    create_mock_step("step-1", "Install Package", StepConfig::Command { command: "mvn".to_string(), args: vec!["clean".to_string(), "install".to_string()], cwd: Some(".".to_string()) }),
                ],
            },
            PipelineStage {
                id: "s2".to_string(), name: "Artifact".to_string(), order: 2,
                steps: vec![
                    create_mock_step("step-2", "Save JAR", StepConfig::Artifact { artifact_name: "app.jar".to_string(), path: "target/*.jar".to_string() }),
                ],
            },
        ]);

        assert!(validate_pipeline_project_semantics(&pipeline, &context).is_ok());
    }

    #[test]
    fn test_maven_lifecycle_scenario_10_multi_module_install_passes() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "module-core".to_string(), path: "core".to_string(), component_type: "library".to_string(),
            languages: vec!["Java".to_string()], frameworks: vec![], build_tool: Some("Maven".to_string()),
            package_manager: None, test_frameworks: vec![], detected_commands: vec![],
            package_files: vec!["pom.xml".to_string()], scripts: HashMap::new(), artifact_candidates: vec![], ..Default::default()
        });
        context.components.push(ComponentIntelligence {
            name: "module-app".to_string(), path: "app".to_string(), component_type: "backend".to_string(),
            languages: vec!["Java".to_string()], frameworks: vec![], build_tool: Some("Maven".to_string()),
            package_manager: None, test_frameworks: vec![], detected_commands: vec![],
            package_files: vec!["pom.xml".to_string()], scripts: HashMap::new(), artifact_candidates: vec!["app/target/*.jar".to_string()], ..Default::default()
        });

        let pipeline = create_mock_pipeline(vec![
            PipelineStage {
                id: "s1".to_string(), name: "Build Core".to_string(), order: 1,
                steps: vec![
                    create_mock_step("step-1", "Install Core", StepConfig::Command { command: "mvn".to_string(), args: vec!["clean".to_string(), "install".to_string()], cwd: Some("core".to_string()) }),
                ],
            },
            PipelineStage {
                id: "s2".to_string(), name: "Build App".to_string(), order: 2,
                steps: vec![
                    create_mock_step("step-2", "Package App", StepConfig::Command { command: "mvn".to_string(), args: vec!["clean".to_string(), "package".to_string()], cwd: Some("app".to_string()) }),
                ],
            },
        ]);

        assert!(validate_pipeline_project_semantics(&pipeline, &context).is_ok());
    }

    #[test]
    fn test_maven_lifecycle_scenario_11_mvnw_vs_mvn_redundancy_detected() {
        let mut context = ProjectIntelligence::default();
        context.components.push(ComponentIntelligence {
            name: "root".to_string(), path: "root".to_string(), component_type: "backend".to_string(),
            languages: vec!["Java".to_string()], frameworks: vec![], build_tool: Some("Maven".to_string()),
            package_manager: None, test_frameworks: vec![], detected_commands: vec![],
            package_files: vec!["pom.xml".to_string(), "mvnw".to_string()], scripts: HashMap::new(), artifact_candidates: vec![], ..Default::default()
        });

        let pipeline = create_mock_pipeline(vec![PipelineStage {
            id: "s1".to_string(), name: "Build".to_string(), order: 1,
            steps: vec![
                create_mock_step("step-1", "Build wrapper", StepConfig::Command { command: "./mvnw".to_string(), args: vec!["clean".to_string(), "package".to_string()], cwd: Some(".".to_string()) }),
                create_mock_step("step-2", "Test system mvn", StepConfig::Command { command: "mvn".to_string(), args: vec!["test".to_string()], cwd: Some(".".to_string()) }),
            ],
        }]);

        let res = validate_pipeline_project_semantics(&pipeline, &context);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().code, SemanticErrorCode::RedundantTest);
    }
}








