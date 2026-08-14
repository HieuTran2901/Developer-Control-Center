//! Read-only Security Project Context adapter for Project Intelligence.
//!
//! Security Center relies on Project Intelligence as the single source of truth
//! for project discovery, language detection, framework detection, and manifests.

use serde::{Deserialize, Serialize};
use std::path::Path;
use crate::pipeline::discovery::{ProjectIntelligence, ProjectScanner};

/// Read-only Security Project Context adapted directly from Project Intelligence.
///
/// Contains high-level project metadata for the selected target without altering
/// security scanning semantics.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SecurityProjectContext {
    pub project_id: String,
    pub project_name: String,
    pub project_root: String,
    pub architecture_type: String,
    pub languages: Vec<String>,
    pub frameworks: Vec<String>,
    pub build_tools: Vec<String>,
    pub package_managers: Vec<String>,
    pub manifests: Vec<String>,
    pub is_git_repo: bool,
    pub git_branch: Option<String>,
}

impl SecurityProjectContext {
    /// Adapts an existing ProjectIntelligence instance into SecurityProjectContext.
    pub fn from_project_intelligence(project_id: String, intel: &ProjectIntelligence) -> Self {
        Self {
            project_id,
            project_name: intel.project_name.clone(),
            project_root: intel.project_path.clone(),
            architecture_type: intel.architecture_type.clone(),
            languages: intel.languages.clone(),
            frameworks: intel.frameworks.clone(),
            build_tools: intel.build_tools.clone(),
            package_managers: intel.package_managers.clone(),
            manifests: intel.root_manifests.clone(),
            is_git_repo: intel.git_info.repository,
            git_branch: intel.git_info.branch.clone(),
        }
    }

    /// Queries Project Intelligence for the given root path and adapts it into SecurityProjectContext.
    pub fn from_root_path<P: AsRef<Path>>(project_id: String, root_path: P) -> Self {
        let intel = ProjectScanner::scan(root_path);
        Self::from_project_intelligence(project_id, &intel)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::fs;

    #[test]
    fn test_react_vite_project_context() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        fs::write(
            root.join("package.json"),
            r#"{"name": "my-react-app", "dependencies": {"react": "^18.0.0"}, "devDependencies": {"vite": "^5.0.0", "typescript": "^5.0.0"}}"#,
        ).unwrap();
        fs::write(root.join("vite.config.ts"), "export default {}").unwrap();

        let context = SecurityProjectContext::from_root_path("proj-react-1".to_string(), root);
        assert_eq!(context.project_id, "proj-react-1");
        assert!(context.languages.contains(&"TypeScript".to_string()) || context.languages.contains(&"JavaScript".to_string()));
        assert!(context.frameworks.contains(&"React".to_string()) || context.frameworks.contains(&"Vite".to_string()));
        assert!(context.manifests.contains(&"package.json".to_string()));
    }

    #[test]
    fn test_spring_boot_project_context() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        fs::write(
            root.join("pom.xml"),
            r#"<project><modelVersion>4.0.0</modelVersion><artifactId>demo</artifactId><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies></project>"#,
        ).unwrap();

        let context = SecurityProjectContext::from_root_path("proj-spring-1".to_string(), root);
        assert_eq!(context.project_id, "proj-spring-1");
        assert!(context.languages.contains(&"Java".to_string()));
        assert!(context.build_tools.contains(&"Maven".to_string()));
        assert!(context.manifests.contains(&"pom.xml".to_string()));
    }

    #[test]
    fn test_unknown_framework_no_fabrication() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(root.join("src/main.txt"), "hello world").unwrap();

        let context = SecurityProjectContext::from_root_path("proj-unknown".to_string(), root);
        assert_eq!(context.project_id, "proj-unknown");
        assert!(context.frameworks.is_empty() || context.frameworks.contains(&"unknown".to_string()));
        assert!(context.languages.is_empty() || context.languages.contains(&"unknown".to_string()));
    }

    #[test]
    fn test_multi_language_project_preservation() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        // Frontend
        fs::create_dir_all(root.join("frontend")).unwrap();
        fs::write(
            root.join("frontend/package.json"),
            r#"{"name": "ui", "dependencies": {"react": "^18.0.0"}}"#,
        ).unwrap();

        // Backend
        fs::create_dir_all(root.join("backend")).unwrap();
        fs::write(
            root.join("backend/pom.xml"),
            r#"<project><artifactId>api</artifactId></project>"#,
        ).unwrap();

        let context = SecurityProjectContext::from_root_path("proj-multi".to_string(), root);
        assert_eq!(context.project_id, "proj-multi");
        assert!(context.languages.contains(&"TypeScript".to_string()) || context.languages.contains(&"JavaScript".to_string()) || context.languages.contains(&"Java".to_string()));
    }

    #[test]
    fn test_project_switching_isolation() {
        let workspace = tempdir().unwrap();
        let project_a = workspace.path().join("project-a");
        let project_b = workspace.path().join("project-b");

        fs::create_dir_all(&project_a).unwrap();
        fs::write(
            project_a.join("package.json"),
            r#"{"name": "proj-a", "dependencies": {"vue": "^3.0.0"}}"#,
        ).unwrap();

        fs::create_dir_all(&project_b).unwrap();
        fs::write(
            project_b.join("Cargo.toml"),
            r#"[package]
name = "proj-b"
version = "0.1.0"
"#,
        ).unwrap();

        let context_a = SecurityProjectContext::from_root_path("id-a".to_string(), &project_a);
        let context_b = SecurityProjectContext::from_root_path("id-b".to_string(), &project_b);

        assert_eq!(context_a.project_id, "id-a");
        assert_eq!(context_b.project_id, "id-b");

        // Context A must not leak B metadata
        assert!(!context_a.manifests.contains(&"Cargo.toml".to_string()));
        assert!(context_a.manifests.contains(&"package.json".to_string()));

        // Context B must not leak A metadata
        assert!(!context_b.manifests.contains(&"package.json".to_string()));
        assert!(context_b.manifests.contains(&"Cargo.toml".to_string()));
        assert!(context_b.languages.contains(&"Rust".to_string()));
    }
}
