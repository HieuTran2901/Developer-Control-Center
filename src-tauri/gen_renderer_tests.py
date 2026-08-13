import os

path = r'E:\Github project\Developer-Control-Center\src-tauri\src\pipeline\renderer\tests.rs'

with open(path, 'a', encoding='utf-8') as f:
    tests = """
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
    let renderer = gitlab::GitlabCiRenderer;
    let yaml = renderer.render(&pipeline).unwrap();
    
    assert!(yaml.contains("stages:"));
    assert!(yaml.contains("- build-stage"));
    assert!(yaml.contains("build-stage:"));
    assert!(yaml.contains("stage: build-stage"));
}
"""
    f.write(tests)

print("Renderer tests injected successfully")
