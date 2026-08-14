//! Pure, deterministic Security Scan Planner.
//!
//! Generates a read-only SecurityScanPlan based on Project Intelligence metadata
//! without executing scans or mutating system state.

use serde::{Deserialize, Serialize};
use crate::security::domain::SecurityScanMode;
use crate::security::project_context::SecurityProjectContext;

/// Capabilities representing which scanner categories are active for a plan.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SecurityCapabilities {
    pub secrets: bool,
    pub configuration: bool,
    pub dependencies: bool,
    pub git_exposure: bool,
}

/// Target manifest/ecosystem identified for dependency scanning in planning.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DependencyTargetPlan {
    pub manifest_file: String,
    pub ecosystem: String,
    pub description: String,
}

/// Read-only, deterministic plan describing what security checks are relevant
/// for a given project context and scan mode.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SecurityScanPlan {
    pub project_id: String,
    pub project_name: String,
    pub project_root: String,
    pub mode: SecurityScanMode,
    pub languages: Vec<String>,
    pub frameworks: Vec<String>,
    pub manifests: Vec<String>,
    pub build_tools: Vec<String>,
    pub package_managers: Vec<String>,
    pub capabilities: SecurityCapabilities,
    pub dependency_targets: Vec<DependencyTargetPlan>,
    pub git_available: bool,
    pub planning_notes: Vec<String>,
}

pub struct SecurityScanPlanner;

impl SecurityScanPlanner {
    /// Pure, deterministic function to generate a SecurityScanPlan from a SecurityProjectContext and SecurityScanMode.
    pub fn plan(context: &SecurityProjectContext, mode: SecurityScanMode) -> SecurityScanPlan {
        let capabilities = match mode {
            SecurityScanMode::Quick => SecurityCapabilities {
                secrets: true,
                configuration: true,
                dependencies: false,
                git_exposure: false,
            },
            SecurityScanMode::GitExposure => SecurityCapabilities {
                secrets: false,
                configuration: false,
                dependencies: false,
                git_exposure: true,
            },
            SecurityScanMode::Full => SecurityCapabilities {
                secrets: true,
                configuration: true,
                dependencies: true,
                git_exposure: true,
            },
        };

        // Determine dependency targets based on manifests
        let mut dependency_targets = Vec::new();
        for manifest in &context.manifests {
            match manifest.as_str() {
                "package.json" => {
                    dependency_targets.push(DependencyTargetPlan {
                        manifest_file: "package.json".to_string(),
                        ecosystem: "npm".to_string(),
                        description: "Node.js / JavaScript / TypeScript npm package manifest".to_string(),
                    });
                }
                "pom.xml" => {
                    dependency_targets.push(DependencyTargetPlan {
                        manifest_file: "pom.xml".to_string(),
                        ecosystem: "Maven".to_string(),
                        description: "Java Maven Project Object Model manifest".to_string(),
                    });
                }
                "build.gradle" | "build.gradle.kts" => {
                    dependency_targets.push(DependencyTargetPlan {
                        manifest_file: manifest.clone(),
                        ecosystem: "Gradle".to_string(),
                        description: "Java / Kotlin Gradle build script manifest".to_string(),
                    });
                }
                "Cargo.toml" => {
                    dependency_targets.push(DependencyTargetPlan {
                        manifest_file: "Cargo.toml".to_string(),
                        ecosystem: "Cargo".to_string(),
                        description: "Rust Cargo package manifest".to_string(),
                    });
                }
                "requirements.txt" | "Pipfile" | "pyproject.toml" => {
                    dependency_targets.push(DependencyTargetPlan {
                        manifest_file: manifest.clone(),
                        ecosystem: "PyPI".to_string(),
                        description: "Python package dependency manifest".to_string(),
                    });
                }
                "go.mod" => {
                    dependency_targets.push(DependencyTargetPlan {
                        manifest_file: "go.mod".to_string(),
                        ecosystem: "Go".to_string(),
                        description: "Go module definition manifest".to_string(),
                    });
                }
                _ => {}
            }
        }

        let mut planning_notes = Vec::new();

        match mode {
            SecurityScanMode::Quick => {
                planning_notes.push("Quick scan: scanning secrets and configuration files.".to_string());
            }
            SecurityScanMode::GitExposure => {
                if context.is_git_repo {
                    planning_notes.push("Git exposure scan: inspecting Git configuration and remote exposure.".to_string());
                } else {
                    planning_notes.push("Git exposure scan: target is not a Git repository; fast-path inspection will yield 0 findings.".to_string());
                }
            }
            SecurityScanMode::Full => {
                planning_notes.push("Full scan: scanning secrets, configurations, dependencies, and git exposure.".to_string());
                if !dependency_targets.is_empty() {
                    planning_notes.push(format!("Detected {} dependency manifest target(s) for OSV vulnerability auditing.", dependency_targets.len()));
                }
            }
        }

        SecurityScanPlan {
            project_id: context.project_id.clone(),
            project_name: context.project_name.clone(),
            project_root: context.project_root.clone(),
            mode,
            languages: context.languages.clone(),
            frameworks: context.frameworks.clone(),
            manifests: context.manifests.clone(),
            build_tools: context.build_tools.clone(),
            package_managers: context.package_managers.clone(),
            capabilities,
            dependency_targets,
            git_available: context.is_git_repo,
            planning_notes,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_mock_react_context() -> SecurityProjectContext {
        SecurityProjectContext {
            project_id: "react-app-1".to_string(),
            project_name: "react-app".to_string(),
            project_root: "E:/projects/react-app".to_string(),
            architecture_type: "single".to_string(),
            languages: vec!["TypeScript".to_string(), "JavaScript".to_string()],
            frameworks: vec!["React".to_string(), "Vite".to_string()],
            build_tools: vec!["Vite".to_string()],
            package_managers: vec!["npm".to_string()],
            manifests: vec!["package.json".to_string()],
            is_git_repo: true,
            git_branch: Some("main".to_string()),
        }
    }

    fn create_mock_spring_context() -> SecurityProjectContext {
        SecurityProjectContext {
            project_id: "spring-app-1".to_string(),
            project_name: "spring-app".to_string(),
            project_root: "E:/projects/spring-app".to_string(),
            architecture_type: "single".to_string(),
            languages: vec!["Java".to_string()],
            frameworks: vec!["Spring Boot".to_string()],
            build_tools: vec!["Maven".to_string()],
            package_managers: vec!["Maven".to_string()],
            manifests: vec!["pom.xml".to_string()],
            is_git_repo: true,
            git_branch: Some("master".to_string()),
        }
    }

    #[test]
    fn test_1_react_typescript_vite_plan() {
        let ctx = create_mock_react_context();

        let plan_quick = SecurityScanPlanner::plan(&ctx, SecurityScanMode::Quick);
        assert!(plan_quick.capabilities.secrets);
        assert!(plan_quick.capabilities.configuration);
        assert!(!plan_quick.capabilities.dependencies);
        assert!(!plan_quick.capabilities.git_exposure);

        let plan_git = SecurityScanPlanner::plan(&ctx, SecurityScanMode::GitExposure);
        assert!(!plan_git.capabilities.secrets);
        assert!(!plan_git.capabilities.configuration);
        assert!(!plan_git.capabilities.dependencies);
        assert!(plan_git.capabilities.git_exposure);

        let plan_full = SecurityScanPlanner::plan(&ctx, SecurityScanMode::Full);
        assert!(plan_full.capabilities.secrets);
        assert!(plan_full.capabilities.configuration);
        assert!(plan_full.capabilities.dependencies);
        assert!(plan_full.capabilities.git_exposure);

        assert_eq!(plan_full.dependency_targets.len(), 1);
        assert_eq!(plan_full.dependency_targets[0].manifest_file, "package.json");
        assert_eq!(plan_full.dependency_targets[0].ecosystem, "npm");
    }

    #[test]
    fn test_2_java_spring_boot_maven_plan() {
        let ctx = create_mock_spring_context();
        let plan = SecurityScanPlanner::plan(&ctx, SecurityScanMode::Full);

        assert_eq!(plan.dependency_targets.len(), 1);
        assert_eq!(plan.dependency_targets[0].manifest_file, "pom.xml");
        assert_eq!(plan.dependency_targets[0].ecosystem, "Maven");

        // No TypeScript or React data should appear
        assert!(!plan.languages.contains(&"TypeScript".to_string()));
        assert!(!plan.frameworks.contains(&"React".to_string()));
        assert!(plan.languages.contains(&"Java".to_string()));
        assert!(plan.frameworks.contains(&"Spring Boot".to_string()));
    }

    #[test]
    fn test_3_multi_language_project_plan() {
        let ctx = SecurityProjectContext {
            project_id: "polyglot-1".to_string(),
            project_name: "polyglot".to_string(),
            project_root: "E:/projects/polyglot".to_string(),
            architecture_type: "full-stack".to_string(),
            languages: vec!["TypeScript".to_string(), "Java".to_string()],
            frameworks: vec!["React".to_string(), "Spring Boot".to_string()],
            build_tools: vec!["Vite".to_string(), "Maven".to_string()],
            package_managers: vec!["npm".to_string(), "Maven".to_string()],
            manifests: vec!["package.json".to_string(), "pom.xml".to_string()],
            is_git_repo: true,
            git_branch: Some("main".to_string()),
        };

        let plan = SecurityScanPlanner::plan(&ctx, SecurityScanMode::Full);
        assert!(plan.languages.contains(&"TypeScript".to_string()));
        assert!(plan.languages.contains(&"Java".to_string()));
        assert_eq!(plan.languages.len(), 2);
        assert_eq!(plan.dependency_targets.len(), 2);
    }

    #[test]
    fn test_4_unknown_project_plan() {
        let ctx = SecurityProjectContext {
            project_id: "unknown-1".to_string(),
            project_name: "unknown".to_string(),
            project_root: "E:/projects/unknown".to_string(),
            architecture_type: "unknown".to_string(),
            languages: vec![],
            frameworks: vec![],
            build_tools: vec![],
            package_managers: vec![],
            manifests: vec![],
            is_git_repo: false,
            git_branch: None,
        };

        let plan = SecurityScanPlanner::plan(&ctx, SecurityScanMode::Full);
        assert!(plan.languages.is_empty());
        assert!(plan.frameworks.is_empty());
        assert!(plan.manifests.is_empty());
        assert!(plan.dependency_targets.is_empty());
        assert!(!plan.git_available);
    }

    #[test]
    fn test_5_git_repository_plan() {
        let mut ctx = create_mock_react_context();
        ctx.is_git_repo = true;

        let plan = SecurityScanPlanner::plan(&ctx, SecurityScanMode::GitExposure);
        assert!(plan.git_available);
        assert!(plan.capabilities.git_exposure);
    }

    #[test]
    fn test_6_non_git_project_plan() {
        let mut ctx = create_mock_react_context();
        ctx.is_git_repo = false;

        let plan = SecurityScanPlanner::plan(&ctx, SecurityScanMode::GitExposure);
        assert!(!plan.git_available);
        assert!(plan.capabilities.git_exposure); // capability requested by mode, but git_available is false
    }

    #[test]
    fn test_7_quick_mode_capabilities() {
        let ctx = create_mock_react_context();
        let plan = SecurityScanPlanner::plan(&ctx, SecurityScanMode::Quick);

        assert_eq!(
            plan.capabilities,
            SecurityCapabilities {
                secrets: true,
                configuration: true,
                dependencies: false,
                git_exposure: false,
            }
        );
    }

    #[test]
    fn test_8_git_exposure_mode_capabilities() {
        let ctx = create_mock_react_context();
        let plan = SecurityScanPlanner::plan(&ctx, SecurityScanMode::GitExposure);

        assert_eq!(
            plan.capabilities,
            SecurityCapabilities {
                secrets: false,
                configuration: false,
                dependencies: false,
                git_exposure: true,
            }
        );
    }

    #[test]
    fn test_9_full_mode_capabilities() {
        let ctx = create_mock_react_context();
        let plan = SecurityScanPlanner::plan(&ctx, SecurityScanMode::Full);

        assert_eq!(
            plan.capabilities,
            SecurityCapabilities {
                secrets: true,
                configuration: true,
                dependencies: true,
                git_exposure: true,
            }
        );
    }

    #[test]
    fn test_10_determinism() {
        let ctx = create_mock_react_context();
        let plan_1 = SecurityScanPlanner::plan(&ctx, SecurityScanMode::Full);
        let plan_2 = SecurityScanPlanner::plan(&ctx, SecurityScanMode::Full);

        assert_eq!(plan_1, plan_2);
    }
}
