use super::*;
use crate::pipeline::domain::{PipelineDefinition, PipelineStage, PipelineStep, PipelineStepType, StepConfig};

fn create_mock_pipeline() -> PipelineDefinition {
    PipelineDefinition {
        id: "test-pipeline".into(),
        name: "Test Pipeline".into(),
        description: None,
        version: 1,
        trigger: "push".into(),
        metadata: std::collections::HashMap::new(),
        triggers: None,
        verification_status: Default::default(),
        confidence_score: 0.0,
        provenance: None,
        status: Default::default(),
        stages: vec![
            PipelineStage {
                id: "stage-1".into(),
                name: "Build & Test".into(),
                order: 1,
                steps: vec![
                    PipelineStep {
                        id: "step-1".into(),
                        name: "Run Tests".into(),
                        step_type: PipelineStepType::Command,
                        order: 1,
                        timeout_seconds: None,
                        provenance: None,
                        config: StepConfig::Command {
                            command: "npm".into(),
                            args: vec!["run".into(), "test".into()],
                            cwd: Some("./frontend".into()),
                        }
                    }
                ]
            }
        ]
    }
}

#[test]
fn test_github_renderer_determinism() {
    let pipeline = create_mock_pipeline();
    let renderer = github::GitHubActionsRenderer;
    
    let out1 = renderer.render(&pipeline).unwrap();
    let out2 = renderer.render(&pipeline).unwrap();
    
    assert_eq!(out1, out2);
    assert!(out1.contains("name: Test Pipeline"));
    assert!(out1.contains("run: npm run test"));
}

#[test]
fn test_gitlab_renderer_determinism() {
    let pipeline = create_mock_pipeline();
    let renderer = gitlab::GitLabCiRenderer;
    
    let out1 = renderer.render(&pipeline).unwrap();
    let out2 = renderer.render(&pipeline).unwrap();
    
    assert_eq!(out1, out2);
    assert!(out1.contains("build-&-test:"));
    assert!(out1.contains("npm run test"));
}

#[test]
fn test_shell_renderer_determinism() {
    let pipeline = create_mock_pipeline();
    let renderer = shell::ShellRenderer;
    
    let out1 = renderer.render(&pipeline).unwrap();
    let out2 = renderer.render(&pipeline).unwrap();
    
    assert_eq!(out1, out2);
    assert!(out1.contains("#!/usr/bin/env bash"));
    assert!(out1.contains("'npm' 'run' 'test'"));
}

#[test]
fn test_shell_command_injection_quoting() {
    let mut pipeline = create_mock_pipeline();
    pipeline.stages[0].steps[0].config = StepConfig::Command {
        command: "rm".into(),
        args: vec!["-rf".into(), "/".into(), "some file.txt".into(), "malicious$(echo 1)".into(), "'; exit 1;'".into()],
        cwd: None,
    };
    
    let renderer = shell::ShellRenderer;
    let out = renderer.render(&pipeline).unwrap();
    
    // Assert that the malicious arguments are safely quoted in single quotes to prevent evaluation
    assert!(out.contains("'rm' '-rf' '/' 'some file.txt' 'malicious$(echo 1)' ''\\'''; exit 1;''\\'''"));
}

#[test]
fn test_secret_leakage_github() {
    let mut pipeline = create_mock_pipeline();
    pipeline.stages[0].steps[0].config = StepConfig::Command {
        command: "echo".into(),
        args: vec!["secret://prod/API_KEY".into()],
        cwd: None,
    };
    
    let renderer = github::GitHubActionsRenderer;
    let out = renderer.render(&pipeline).unwrap();
    
    assert!(!out.contains("secret://prod/API_KEY"));
    assert!(out.contains("${{ secrets.API_KEY }}"));
}

#[test]
fn test_secret_leakage_gitlab() {
    let mut pipeline = create_mock_pipeline();
    pipeline.stages[0].steps[0].config = StepConfig::Command {
        command: "echo".into(),
        args: vec!["secret://prod/API_KEY".into()],
        cwd: None,
    };
    
    let renderer = gitlab::GitLabCiRenderer;
    let out = renderer.render(&pipeline).unwrap();
    
    assert!(!out.contains("secret://prod/API_KEY"));
    assert!(out.contains("$API_KEY"));
}

#[test]
fn test_secret_leakage_shell() {
    let mut pipeline = create_mock_pipeline();
    pipeline.stages[0].steps[0].config = StepConfig::Command {
        command: "echo".into(),
        args: vec!["secret://prod/API_KEY".into()],
        cwd: None,
    };
    
    let renderer = shell::ShellRenderer;
    let out = renderer.render(&pipeline).unwrap();
    
    assert!(!out.contains("secret://prod/API_KEY"));
    // Must be quoted in double quotes for safe expansion
    assert!(out.contains("\"$API_KEY\""));
}

#[test]
fn test_unsupported_capability_rejection() {
    let mut pipeline = create_mock_pipeline();
    pipeline.stages[0].steps[0].step_type = PipelineStepType::Http; // Unsupported by CI renderers
    pipeline.stages[0].steps[0].config = StepConfig::Http {
        url: "http://example.com".into(),
        method: "GET".into(),
        headers: None,
        body: None,
    };
    
    let renderer = github::GitHubActionsRenderer;
    let res = renderer.render(&pipeline);
    assert!(res.is_err());
    assert!(res.unwrap_err().contains("Unsupported step type"));
}

#[test]
fn test_factory_selection() {
    assert!(RendererFactory::get("github").is_ok());
    assert!(RendererFactory::get("gitlab").is_ok());
    assert!(RendererFactory::get("shell").is_ok());
    assert!(RendererFactory::get("unknown_platform").is_err());
}





#[test]
fn test_github_actions_artifact_export_valid() {
    let mut pipeline = create_mock_pipeline();
    // Test 1, 2, 8, 10
    pipeline.stages[0].steps.push(PipelineStep {
        id: "step-2".into(),
        name: "Upload Backend Artifact".into(),
        step_type: PipelineStepType::Artifact,
        order: 2,
        timeout_seconds: None,
        provenance: None,
        config: StepConfig::Artifact {
            artifact_name: "backend-artifact".into(),
            path: "Backend/Event_Management_Ticket/target/*.jar".into(),
        },
    });

    let renderer = github::GitHubActionsRenderer;
    let yaml = renderer.render(&pipeline).unwrap();

    assert!(yaml.contains("run: npm run test")); // command preserved
    assert!(yaml.contains("uses: actions/upload-artifact@v4"));
    assert!(yaml.contains("name: backend-artifact"));
    assert!(yaml.contains("path: Backend/Event_Management_Ticket/target/*.jar"));
    // Verify order
    let run_idx = yaml.find("run: npm run test").unwrap();
    let upload_idx = yaml.find("uses: actions/upload-artifact@v4").unwrap();
    assert!(run_idx < upload_idx);
}

#[test]
fn test_github_actions_multiple_artifacts() {
    let mut pipeline = create_mock_pipeline();
    // Test 3
    pipeline.stages[0].steps.push(PipelineStep {
        id: "step-2".into(),
        name: "Upload Backend Artifact".into(),
        step_type: PipelineStepType::Artifact,
        order: 2,
        timeout_seconds: None,
        provenance: None,
        config: StepConfig::Artifact {
            artifact_name: "backend-artifact".into(),
            path: "backend/target/*.jar".into(),
        },
    });
    pipeline.stages[0].steps.push(PipelineStep {
        id: "step-3".into(),
        name: "Upload Frontend Artifact".into(),
        step_type: PipelineStepType::Artifact,
        order: 3,
        timeout_seconds: None,
        provenance: None,
        config: StepConfig::Artifact {
            artifact_name: "frontend-artifact".into(),
            path: "frontend/dist".into(),
        },
    });

    let renderer = github::GitHubActionsRenderer;
    let yaml = renderer.render(&pipeline).unwrap();
    assert!(yaml.contains("name: backend-artifact"));
    assert!(yaml.contains("path: backend/target/*.jar"));
    assert!(yaml.contains("name: frontend-artifact"));
    assert!(yaml.contains("path: frontend/dist"));
}

#[test]
fn test_github_actions_artifact_validation_empty_name() {
    let mut pipeline = create_mock_pipeline();
    // Test 4
    pipeline.stages[0].steps.push(PipelineStep {
        id: "step-2".into(),
        name: "Upload Backend Artifact".into(),
        step_type: PipelineStepType::Artifact,
        order: 2,
        timeout_seconds: None,
        provenance: None,
        config: StepConfig::Artifact {
            artifact_name: "".into(),
            path: "backend/target/*.jar".into(),
        },
    });

    let renderer = github::GitHubActionsRenderer;
    let res = renderer.render(&pipeline);
    assert!(res.is_err());
    assert!(res.unwrap_err().contains("artifact_name is empty"));
}

#[test]
fn test_github_actions_artifact_validation_empty_path() {
    let mut pipeline = create_mock_pipeline();
    // Test 5
    pipeline.stages[0].steps.push(PipelineStep {
        id: "step-2".into(),
        name: "Upload Backend Artifact".into(),
        step_type: PipelineStepType::Artifact,
        order: 2,
        timeout_seconds: None,
        provenance: None,
        config: StepConfig::Artifact {
            artifact_name: "app".into(),
            path: "   ".into(),
        },
    });

    let renderer = github::GitHubActionsRenderer;
    let res = renderer.render(&pipeline);
    assert!(res.is_err());
    assert!(res.unwrap_err().contains("artifact path is empty"));
}

#[test]
fn test_github_actions_artifact_validation_traversal() {
    let mut pipeline = create_mock_pipeline();
    // Test 6
    pipeline.stages[0].steps.push(PipelineStep {
        id: "step-2".into(),
        name: "Upload Backend Artifact".into(),
        step_type: PipelineStepType::Artifact,
        order: 2,
        timeout_seconds: None,
        provenance: None,
        config: StepConfig::Artifact {
            artifact_name: "app".into(),
            path: "../../secret.jar".into(),
        },
    });

    let renderer = github::GitHubActionsRenderer;
    let res = renderer.render(&pipeline);
    assert!(res.is_err());
    assert!(res.unwrap_err().contains("contains traversal"));
}

#[test]
fn test_github_actions_artifact_validation_absolute_path() {
    let mut pipeline = create_mock_pipeline();
    // Path absolute
    pipeline.stages[0].steps.push(PipelineStep {
        id: "step-2".into(),
        name: "Upload Backend Artifact".into(),
        step_type: PipelineStepType::Artifact,
        order: 2,
        timeout_seconds: None,
        provenance: None,
        config: StepConfig::Artifact {
            artifact_name: "app".into(),
            path: "/etc/passwd".into(),
        },
    });

    let renderer = github::GitHubActionsRenderer;
    let res = renderer.render(&pipeline);
    assert!(res.is_err());
    assert!(res.unwrap_err().contains("repository-relative"));
}


// ==========================================
// Phase 7: CATEGORY C — CI/CD RENDERER
// ==========================================

#[test]
fn test_cat_c_valid_github_actions_generation() {
    let pipeline = create_mock_pipeline();
    let renderer = github::GitHubActionsRenderer;
    let yaml = renderer.render(&pipeline).unwrap();
    
    assert!(yaml.contains("name: Test Pipeline"));
    assert!(yaml.contains("on: [push]"));
    assert!(yaml.contains("jobs:"));
    assert!(yaml.contains("build-stage:"));
    assert!(yaml.contains("runs-on: ubuntu-latest"));
}

#[test]
fn test_cat_c_valid_gitlab_ci_generation() {
    let pipeline = create_mock_pipeline();
    let renderer = gitlab::GitLabCiRenderer;
    let yaml = renderer.render(&pipeline).unwrap();
    
    assert!(yaml.contains("stages:"));
    assert!(yaml.contains("- build-stage"));
    assert!(yaml.contains("build-stage:"));
    assert!(yaml.contains("stage: build-stage"));
}
