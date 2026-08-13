use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::collections::{HashSet, HashMap};
use walkdir::WalkDir;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitContext {
    pub repository: bool,
    pub branch: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ComponentRole {
    RootApplication,
    RootAggregator,
    RootParent,
    Module,
    Application,
    Library,
    Unknown,
}

impl Default for ComponentRole {
    fn default() -> Self {
        ComponentRole::Unknown
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ComponentGraph {
    pub components: HashMap<String, ComponentIntelligence>,
    pub root_component: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ComponentIntelligence {
    pub name: String,
    pub path: String,
    pub component_type: String, // "frontend", "backend", "unknown"
    pub languages: Vec<String>,
    pub frameworks: Vec<String>,
    pub build_tool: Option<String>,
    pub package_manager: Option<String>,
    pub test_frameworks: Vec<String>,
    pub detected_commands: Vec<String>,
    pub package_files: Vec<String>,
    pub scripts: HashMap<String, String>,
    pub artifact_candidates: Vec<String>,
    #[serde(default)]
    pub has_valid_manifest: bool,
    
    #[serde(default)]
    pub role: ComponentRole,
    #[serde(default)]
    pub parent_component: Option<String>,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub has_build_capability: bool,
    #[serde(default)]
    pub has_test_capability: bool,
    #[serde(default)]
    pub has_artifact_capability: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectIntelligence {
    pub project_name: String,
    pub project_path: String,
    pub repository_root: Option<String>,
    pub architecture_type: String, // "monorepo", "full-stack", "single", "unknown"
    pub languages: Vec<String>,
    pub frameworks: Vec<String>,
    pub build_tools: Vec<String>,
    pub package_managers: Vec<String>,
    pub test_frameworks: Vec<String>,
    pub infrastructure: Vec<String>,
    pub ci_cd: Vec<String>,
    pub components: Vec<ComponentIntelligence>,
    #[serde(default)]
    pub component_graph: ComponentGraph,
    pub detected_commands: Vec<String>,
    pub git_info: GitContext,
    pub scanned_file_count: u32,
    pub ignored_directory_count: u32,
    pub scanner_version: String,
    #[serde(default)]
    pub root_has_manifest: bool,
    #[serde(default)]
    pub root_manifests: Vec<String>,
    
    // Backward compatibility fields
    pub language: Option<String>,
    pub build_tool: Option<String>,
    pub docker: bool,
    pub existing_ci: Vec<String>,
    pub build_commands: Vec<String>,
    pub test_commands: Vec<String>,
    pub relevant_files: Vec<String>,
}

pub struct ProjectScanner;

impl ProjectScanner {
    pub fn scan<P: AsRef<Path>>(project_root: P) -> ProjectIntelligence {
        let root = project_root.as_ref();
        
        let project_name = root.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let mut intel = ProjectIntelligence {
            project_name,
            project_path: root.to_string_lossy().to_string(),
            architecture_type: "unknown".to_string(),
            scanner_version: "2.1".to_string(),
            ..Default::default()
        };

        // 1. Detect Git
        let git_dir = root.join(".git");
        if git_dir.exists() {
            intel.git_info.repository = true;
            intel.repository_root = Some(root.to_string_lossy().to_string());
            if let Ok(output) = std::process::Command::new("git")
                .arg("rev-parse")
                .arg("--abbrev-ref")
                .arg("HEAD")
                .current_dir(root)
                .output() {
                if output.status.success() {
                    let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    intel.git_info.branch = Some(branch);
                }
            }
        }

        let mut scanned_count = 0;
        let mut ignored_count = 0;

        let mut component_map = std::collections::HashMap::new();

        // 2. Traversal
        let walker = WalkDir::new(root).max_depth(3).into_iter();
        for entry in walker.filter_map(|e| e.ok()) {
            let path = entry.path();
            let is_dir = entry.file_type().is_dir();
            
            let path_str = path.to_string_lossy().to_string();
            if path_str.contains("node_modules") || 
               path_str.contains("target") || 
               path_str.contains("dist") || 
               path_str.contains("build") ||
               path_str.contains(".git") ||
               path_str.contains(".idea") ||
               path_str.contains(".vscode") ||
               path_str.contains("vendor") {
                if is_dir { ignored_count += 1; }
                continue;
            }

            scanned_count += 1;
            let rel_path = path.strip_prefix(root).unwrap_or(path).to_string_lossy().replace("\\", "/");
            let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            let dir_name = path.parent().and_then(|p| p.file_name()).unwrap_or_default().to_string_lossy().to_string();

            // Infrastructure & CI
            if rel_path.starts_with(".github/workflows/") && rel_path.ends_with(".yml") {
                intel.existing_ci.push(rel_path.clone());
                intel.ci_cd.push("GitHub Actions".to_string());
            } else if file_name == ".gitlab-ci.yml" {
                intel.existing_ci.push(rel_path.clone());
                intel.ci_cd.push("GitLab CI".to_string());
            }

            if file_name == "Dockerfile" {
                intel.docker = true;
                intel.infrastructure.push("Docker".to_string());
                intel.relevant_files.push(rel_path.clone());
            }
            if file_name == "docker-compose.yml" || file_name == "compose.yaml" {
                intel.infrastructure.push("Docker Compose".to_string());
                intel.relevant_files.push(rel_path.clone());
            }
            if file_name.ends_with(".tf") {
                intel.infrastructure.push("Terraform".to_string());
            }

            // Lockfiles
            let is_lockfile = matches!(file_name.as_str(), "package-lock.json" | "yarn.lock" | "pnpm-lock.yaml" | "Cargo.lock" | "poetry.lock");
            
            // Component Manifests
            let is_manifest = matches!(file_name.as_str(), 
                "package.json" | "Cargo.toml" | "pom.xml" | "build.gradle" | "build.gradle.kts" |
                "requirements.txt" | "pyproject.toml" | "go.mod");

            if is_manifest || is_lockfile {
                intel.relevant_files.push(rel_path.clone());
                let component_path = if rel_path == file_name { "root".to_string() } else { path.parent().unwrap().strip_prefix(root).unwrap_or(path).to_string_lossy().replace("\\", "/") };
                
                let comp = component_map.entry(component_path.clone()).or_insert_with(|| {
                    let mut comp_type = "unknown";
                    let lower_name = dir_name.to_lowercase();
                    if lower_name.contains("front") || lower_name.contains("client") || lower_name.contains("web") || lower_name.contains("ui") {
                        comp_type = "frontend";
                    } else if lower_name.contains("back") || lower_name.contains("server") || lower_name.contains("api") {
                        comp_type = "backend";
                    }
                    if component_path == "root" {
                        comp_type = "root";
                    }

                    ComponentIntelligence {
                        name: if component_path == "root" { "root".to_string() } else { dir_name.clone() },
                        path: component_path.clone(),
                        component_type: comp_type.to_string(),
                        languages: vec![],
                        frameworks: vec![],
                        build_tool: None,
                        package_manager: None,
                        test_frameworks: vec![],
                        detected_commands: vec![],
                        package_files: vec![],
                        scripts: HashMap::new(),
                        artifact_candidates: vec![],
                        has_valid_manifest: false,
                        role: ComponentRole::default(),
                        parent_component: None,
                        dependencies: vec![],
                        has_build_capability: false,
                        has_test_capability: false,
                        has_artifact_capability: false,
                    }
                });

                comp.package_files.push(file_name.clone());

                if is_manifest {
                    let content = std::fs::read_to_string(path).unwrap_or_default();
                    let lower_content = content.to_lowercase();

                    match file_name.as_str() {
                        "package.json" => {
                            comp.languages.push("TypeScript/JavaScript".to_string());
                            
                            // Detect package manager based on lockfiles
                            let has_npm_lock = std::fs::metadata(path.with_file_name("package-lock.json")).is_ok();
                            let has_yarn_lock = std::fs::metadata(path.with_file_name("yarn.lock")).is_ok();
                            let has_pnpm_lock = std::fs::metadata(path.with_file_name("pnpm-lock.yaml")).is_ok();
                            if has_pnpm_lock {
                                comp.package_manager = Some("pnpm".to_string());
                            } else if has_yarn_lock {
                                comp.package_manager = Some("yarn".to_string());
                            } else if has_npm_lock {
                                comp.package_manager = Some("npm".to_string());
                            } else {
                                comp.package_manager = Some("npm".to_string());
                            }
                            
                            // Naive parse for scripts
                            if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content) {
                                if let Some(scripts) = pkg.get("scripts").and_then(|s| s.as_object()) {
                                    for (k, v) in scripts {
                                        if let Some(cmd) = v.as_str() {
                                            comp.scripts.insert(k.clone(), cmd.to_string());
                                            comp.detected_commands.push(format!("{} run {}", comp.package_manager.as_deref().unwrap_or("npm"), k));
                                        }
                                    }
                                }
                            }
                            
                            if lower_content.contains("\"react\"") { comp.frameworks.push("React".to_string()); }
                            if lower_content.contains("\"vue\"") { comp.frameworks.push("Vue".to_string()); }
                            if lower_content.contains("\"next\"") { comp.frameworks.push("Next.js".to_string()); comp.artifact_candidates.push(".next".to_string()); }
                            if lower_content.contains("\"nuxt\"") { comp.frameworks.push("Nuxt".to_string()); }
                            if lower_content.contains("\"@angular/core\"") { comp.frameworks.push("Angular".to_string()); }
                            if lower_content.contains("\"vite\"") { comp.frameworks.push("Vite".to_string()); comp.artifact_candidates.push("dist".to_string()); }
                            if lower_content.contains("\"express\"") { comp.frameworks.push("Express".to_string()); comp.component_type = "backend".to_string(); }
                            if lower_content.contains("\"@nestjs/core\"") { comp.frameworks.push("NestJS".to_string()); comp.component_type = "backend".to_string(); comp.artifact_candidates.push("dist".to_string()); }

                            if lower_content.contains("\"jest\"") { comp.test_frameworks.push("Jest".to_string()); }
                            if lower_content.contains("\"vitest\"") { comp.test_frameworks.push("Vitest".to_string()); }
                            if lower_content.contains("\"cypress\"") { comp.test_frameworks.push("Cypress".to_string()); }
                            if lower_content.contains("\"playwright\"") { comp.test_frameworks.push("Playwright".to_string()); }
                            
                            if !comp.artifact_candidates.contains(&"dist".to_string()) && !comp.artifact_candidates.contains(&"build".to_string()) {
                                comp.artifact_candidates.push("build".to_string());
                            }
                        },
                        "pom.xml" => {
                            comp.languages.push("Java".to_string());
                            comp.build_tool = Some("Maven".to_string());
                            comp.component_type = "backend".to_string();
                            if lower_content.contains("spring-boot") { comp.frameworks.push("Spring Boot".to_string()); }
                            if lower_content.contains("junit") { comp.test_frameworks.push("JUnit".to_string()); }
                            if lower_content.contains("mockito") { comp.test_frameworks.push("Mockito".to_string()); }
                            
                            // Advanced POM parsing for ComponentGraph
                            if lower_content.contains("<packaging>pom</packaging>") {
                                comp.role = ComponentRole::RootAggregator; // Default assumption for POM packaging
                            } else {
                                comp.role = if comp.path == "root" { ComponentRole::RootApplication } else { ComponentRole::Application };
                            }

                            // Naive module extraction
                            let mut modules = Vec::new();
                            let mut in_modules = false;
                            for line in content.lines() {
                                let line_trim = line.trim();
                                if line_trim.contains("<modules>") { in_modules = true; continue; }
                                if line_trim.contains("</modules>") { in_modules = false; continue; }
                                if in_modules && line_trim.starts_with("<module>") && line_trim.ends_with("</module>") {
                                    let module_name = line_trim.replace("<module>", "").replace("</module>", "").trim().to_string();
                                    modules.push(module_name);
                                }
                            }
                            
                            if !modules.is_empty() {
                                comp.dependencies.extend(modules);
                                comp.role = if comp.path == "root" { ComponentRole::RootAggregator } else { ComponentRole::RootParent };
                            }
                            
                            let has_mvnw = std::fs::metadata(path.with_file_name("mvnw")).is_ok();
                            let cmd_prefix = if has_mvnw { "./mvnw" } else { "mvn" };
                            comp.detected_commands.push(format!("{} clean package", cmd_prefix));
                            comp.detected_commands.push(format!("{} test", cmd_prefix));
                            comp.scripts.insert("build".to_string(), format!("{} clean package", cmd_prefix));
                            comp.scripts.insert("test".to_string(), format!("{} test", cmd_prefix));
                            comp.artifact_candidates.push("target/*.jar".to_string());
                            
                            comp.has_build_capability = true;
                            comp.has_test_capability = true;
                            comp.has_artifact_capability = comp.role == ComponentRole::Application || comp.role == ComponentRole::RootApplication;
                        },
                        "build.gradle" | "build.gradle.kts" => {
                            comp.languages.push("Java/Kotlin".to_string());
                            comp.build_tool = Some("Gradle".to_string());
                            comp.component_type = "backend".to_string();
                            if lower_content.contains("spring-boot") { comp.frameworks.push("Spring Boot".to_string()); }
                            if lower_content.contains("junit") { comp.test_frameworks.push("JUnit".to_string()); }
                            
                            let has_gradlew = std::fs::metadata(path.with_file_name("gradlew")).is_ok();
                            let cmd_prefix = if has_gradlew { "./gradlew" } else { "gradle" };
                            comp.detected_commands.push(format!("{} build", cmd_prefix));
                            comp.detected_commands.push(format!("{} test", cmd_prefix));
                            comp.scripts.insert("build".to_string(), format!("{} build", cmd_prefix));
                            comp.scripts.insert("test".to_string(), format!("{} test", cmd_prefix));
                            comp.artifact_candidates.push("build/libs/*.jar".to_string());
                        },
                        "Cargo.toml" => {
                            comp.languages.push("Rust".to_string());
                            comp.build_tool = Some("Cargo".to_string());
                            if lower_content.contains("tauri") { comp.frameworks.push("Tauri".to_string()); }
                            if lower_content.contains("axum") { comp.frameworks.push("Axum".to_string()); comp.component_type = "backend".to_string(); }
                            if lower_content.contains("actix-web") { comp.frameworks.push("Actix".to_string()); comp.component_type = "backend".to_string(); }
                            comp.detected_commands.push("cargo build --release".to_string());
                            comp.detected_commands.push("cargo test".to_string());
                            comp.scripts.insert("build".to_string(), "cargo build --release".to_string());
                            comp.scripts.insert("test".to_string(), "cargo test".to_string());
                            comp.artifact_candidates.push("target/release".to_string());
                        },
                        "requirements.txt" | "pyproject.toml" => {
                            comp.languages.push("Python".to_string());
                            comp.package_manager = Some("pip".to_string());
                            if file_name == "pyproject.toml" && lower_content.contains("poetry") {
                                comp.package_manager = Some("poetry".to_string());
                            }
                            if lower_content.contains("django") { comp.frameworks.push("Django".to_string()); comp.component_type = "backend".to_string(); }
                            if lower_content.contains("flask") { comp.frameworks.push("Flask".to_string()); comp.component_type = "backend".to_string(); }
                            if lower_content.contains("fastapi") { comp.frameworks.push("FastAPI".to_string()); comp.component_type = "backend".to_string(); }
                            if lower_content.contains("pytest") { 
                                comp.test_frameworks.push("pytest".to_string()); 
                                let pm = comp.package_manager.as_deref().unwrap_or("pip");
                                let cmd = if pm == "poetry" { "poetry run pytest" } else { "pytest" };
                                comp.detected_commands.push(cmd.to_string());
                                comp.scripts.insert("test".to_string(), cmd.to_string());
                            }
                        },
                        "go.mod" => {
                            comp.languages.push("Go".to_string());
                            comp.build_tool = Some("Go Modules".to_string());
                            comp.component_type = "backend".to_string();
                            comp.detected_commands.push("go build ./...".to_string());
                            comp.detected_commands.push("go test ./...".to_string());
                            comp.scripts.insert("build".to_string(), "go build ./...".to_string());
                            comp.scripts.insert("test".to_string(), "go test ./...".to_string());
                        }
                        _ => {}
                    }
                }
            }
        }

        intel.scanned_file_count = scanned_count;
        intel.ignored_directory_count = ignored_count;

        // Process components and aggregate
        let mut all_langs = HashSet::new();
        let mut all_frameworks = HashSet::new();
        let mut all_build = HashSet::new();
        let mut all_pkg = HashSet::new();
        let mut all_tests = HashSet::new();

        let mut has_frontend = false;
        let mut has_backend = false;

        for (_, mut comp) in component_map.into_iter() {
            comp.has_valid_manifest = !comp.package_files.is_empty();

            if comp.path == "root" {
                intel.root_has_manifest = comp.has_valid_manifest;
                intel.root_manifests = comp.package_files.clone();
            }

            if comp.component_type == "frontend" { has_frontend = true; }
            if comp.component_type == "backend" { has_backend = true; }
            
            // Clean up empty vecs
            comp.languages.sort(); comp.languages.dedup();
            comp.frameworks.sort(); comp.frameworks.dedup();
            
            all_langs.extend(comp.languages.clone());
            all_frameworks.extend(comp.frameworks.clone());
            all_tests.extend(comp.test_frameworks.clone());
            if let Some(ref bt) = comp.build_tool { all_build.insert(bt.clone()); }
            if let Some(ref pm) = comp.package_manager { all_pkg.insert(pm.clone()); }

            // Also map to legacy fields for backward compatibility
            if intel.language.is_none() { intel.language = comp.languages.first().cloned(); }
            if intel.build_tool.is_none() { intel.build_tool = comp.build_tool.clone().or(comp.package_manager.clone()); }
            intel.build_commands.extend(comp.detected_commands.iter().filter(|c| c.contains("build") || c.contains("package")).cloned());
            intel.test_commands.extend(comp.detected_commands.iter().filter(|c| c.contains("test")).cloned());

            intel.component_graph.components.insert(comp.path.clone(), comp.clone());
            if comp.path == "root" {
                intel.component_graph.root_component = Some("root".to_string());
            }
            intel.components.push(comp);
        }
        
        // Post-process component graph to assign parent_component
        for (path, comp) in intel.component_graph.components.clone().iter() {
            for dep in comp.dependencies.iter() {
                // If a module dependency is found, try to resolve its path
                let mut resolved_path = format!("{}/{}", if path == "root" { "" } else { path }, dep);
                resolved_path = resolved_path.trim_start_matches('/').to_string();
                if let Some(child_comp) = intel.component_graph.components.get_mut(&resolved_path) {
                    child_comp.parent_component = Some(path.clone());
                } else {
                    // Try exact match
                    if let Some(child_comp) = intel.component_graph.components.get_mut(dep) {
                        child_comp.parent_component = Some(path.clone());
                    }
                }
            }
        }

        if intel.components.len() > 1 && has_frontend && has_backend {
            intel.architecture_type = "full-stack".to_string();
        } else if intel.components.len() > 1 {
            intel.architecture_type = "monorepo".to_string();
        } else if intel.components.len() == 1 {
            intel.architecture_type = "single".to_string();
        }

        intel.languages = all_langs.into_iter().collect();
        intel.frameworks = all_frameworks.into_iter().collect();
        intel.build_tools = all_build.into_iter().collect();
        intel.package_managers = all_pkg.into_iter().collect();
        intel.test_frameworks = all_tests.into_iter().collect();

        // Sort for deterministic output
        intel.languages.sort();
        intel.frameworks.sort();
        intel.build_tools.sort();
        intel.package_managers.sort();
        intel.test_frameworks.sort();
        intel.infrastructure.sort();
        intel.infrastructure.dedup();
        intel.ci_cd.sort();
        intel.ci_cd.dedup();

        // deduplicate legacy fields
        intel.build_commands.sort(); intel.build_commands.dedup();
        intel.test_commands.sort(); intel.test_commands.dedup();
        
        intel
    }
}
