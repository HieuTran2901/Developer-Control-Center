use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

pub const MAX_DISCOVERY_FILES: u32 = 5000;
pub const MAX_DISCOVERY_DIRECTORIES: u32 = 1000;
pub const MAX_DISCOVERY_DEPTH: usize = 5;
pub const MAX_DISCOVERY_TIME: Duration = Duration::from_millis(3000);
pub const MAX_PROJECT_CANDIDATES: usize = 50;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ScopeClassification {
    Safe,
    Large,
    Blocked,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredProjectCandidate {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub manifest_type: String,
    pub frameworks: Vec<String>,
    pub languages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderScopeAnalysis {
    pub root_path: String,
    pub classification: ScopeClassification,
    pub reason: Option<String>,
    pub estimated_files: u32,
    pub estimated_directories: u32,
    pub excluded_directories: Vec<String>,
    pub project_candidates: Vec<DiscoveredProjectCandidate>,
    pub is_budget_exceeded: bool,
    pub is_cancelled: bool,
    pub scan_duration_ms: u64,
}

pub struct FolderSafetyGuard;

struct RawCandidateData {
    manifests: Vec<String>,
    languages: Vec<String>,
    frameworks: Vec<String>,
}

impl FolderSafetyGuard {
    /// Check if a path is a protected system root or dangerous system path
    pub fn is_protected_system_path(path: &Path) -> (bool, Option<String>) {
        let canonical_str = path.to_string_lossy().to_string();
        let normalized = canonical_str.replace("/", "\\");
        let trimmed = normalized.trim_end_matches('\\');

        // Check drive root (e.g. "C:", "D:", "C:\", "D:\", etc.)
        if trimmed.len() <= 2 && trimmed.ends_with(':') {
            return (
                true,
                Some(format!(
                    "Drive root '{}' is too broad for a project scan.",
                    canonical_str
                )),
            );
        }
        if trimmed.is_empty() || trimmed == "\\" || trimmed == "/" {
            return (
                true,
                Some("System filesystem root is too broad for a project scan.".to_string()),
            );
        }

        // Check Windows root paths
        let lower = trimmed.to_lowercase();
        let protected_prefixes = [
            "c:\\windows",
            "c:\\program files",
            "c:\\program files (x86)",
            "c:\\programdata",
            "c:\\system volume information",
            "c:\\$recycle.bin",
            "c:\\recovery",
            "c:\\perflogs",
            "c:\\boot",
            "c:\\msocache",
        ];

        for prefix in protected_prefixes.iter() {
            if lower == *prefix || lower.starts_with(&format!("{}\\", prefix)) {
                return (
                    true,
                    Some(format!(
                        "System path '{}' is protected and cannot be scanned for project files.",
                        canonical_str
                    )),
                );
            }
        }

        // Check generic drive system folders (e.g., "D:\$Recycle.Bin", "E:\System Volume Information")
        if lower.contains("\\system volume information") || lower.contains("\\$recycle.bin") {
            return (
                true,
                Some(format!(
                    "System volume directory '{}' is protected.",
                    canonical_str
                )),
            );
        }

        // Check Unix protected system roots
        let unix_protected = [
            "/bin", "/boot", "/dev", "/etc", "/lib", "/lib32", "/lib64", "/proc",
            "/root", "/run", "/sbin", "/sys", "/usr", "/var",
        ];
        let unix_norm = canonical_str.replace("\\", "/");
        let unix_trimmed = unix_norm.trim_end_matches('/');
        for prefix in unix_protected.iter() {
            if unix_trimmed == *prefix || unix_trimmed.starts_with(&format!("{}/", prefix)) {
                return (
                    true,
                    Some(format!(
                        "Unix system path '{}' is protected.",
                        canonical_str
                    )),
                );
            }
        }

        (false, None)
    }

    /// Check if a path is a broad user profile root or standard user folder (Downloads, Documents, Desktop, etc.)
    pub fn is_broad_user_container(path: &Path) -> (bool, Option<String>) {
        let canonical_str = path.to_string_lossy().to_string();
        let normalized = canonical_str.replace("/", "\\");
        let trimmed = normalized.trim_end_matches('\\');
        let lower = trimmed.to_lowercase();

        // 1. Check if path is a user root, e.g. "C:\Users" or "/home" or "/Users"
        if lower == "c:\\users" || lower == "/home" || lower == "/users" || lower == "\\users" {
            return (
                true,
                Some(format!(
                    "User root directory '{}' is too broad for a project scan.",
                    canonical_str
                )),
            );
        }

        let parts: Vec<&str> = if lower.contains('\\') {
            lower.split('\\').filter(|s| !s.is_empty()).collect()
        } else {
            lower.split('/').filter(|s| !s.is_empty()).collect()
        };

        // 2. Check user profile home directory:
        // Windows: ["c:", "users", "<username>"] (len == 3)
        // Unix: ["home", "<username>"] or ["users", "<username>"] (len == 2)
        if parts.len() == 3 && parts[1] == "users" {
            return (
                true,
                Some(format!(
                    "User profile directory '{}' is a broad user container, not a project root.",
                    canonical_str
                )),
            );
        }
        if parts.len() == 2 && (parts[0] == "home" || parts[0] == "users") {
            return (
                true,
                Some(format!(
                    "User profile directory '{}' is a broad user container, not a project root.",
                    canonical_str
                )),
            );
        }

        // 3. Standard broad user folders
        let broad_names = [
            "downloads",
            "documents",
            "desktop",
            "pictures",
            "videos",
            "music",
            "onedrive",
            "contacts",
            "favorites",
            "saved games",
            "searches",
        ];

        if let Some(folder_name) = path.file_name().and_then(|n| n.to_str()) {
            let fn_lower = folder_name.to_lowercase();
            if broad_names.contains(&fn_lower.as_str()) {
                // If it's directly under a user profile (e.g. C:\Users\<user>\Downloads or /home/<user>/Downloads)
                // or top-level / user container
                if let Some(parent) = path.parent() {
                    let p_norm = parent.to_string_lossy().replace("/", "\\");
                    let p_trimmed = p_norm.trim_end_matches('\\').to_lowercase();
                    let p_parts: Vec<&str> = p_trimmed.split('\\').filter(|s| !s.is_empty()).collect();

                    let is_under_user = (p_parts.len() == 3 && p_parts[1] == "users")
                        || (p_parts.len() == 2 && (p_parts[0] == "home" || p_parts[0] == "users"))
                        || (p_parts.len() <= 2);

                    if is_under_user {
                        return (
                            true,
                            Some(format!(
                                "Broad user directory '{}' is not a project root.",
                                canonical_str
                            )),
                        );
                    }
                }
            }
        }

        (false, None)
    }

    /// Determines if a directory name should be excluded from deep traversal
    pub fn is_ignored_directory(dir_name: &str) -> bool {
        let lower = dir_name.to_lowercase();
        matches!(
            lower.as_str(),
            ".git"
                | "node_modules"
                | "target"
                | "dist"
                | "build"
                | "out"
                | "coverage"
                | ".gradle"
                | ".mvn"
                | ".idea"
                | ".vscode"
                | "__pycache__"
                | "venv"
                | ".venv"
                | "env"
                | ".env"
                | "vendor"
                | "bin"
                | "obj"
                | "windows"
                | "program files"
                | "program files (x86)"
                | "programdata"
                | "system volume information"
                | "$recycle.bin"
        )
    }

    /// Determines if a directory is an internal code/asset folder that should not be BFS enqueued when discovering project roots
    pub fn is_internal_source_directory(dir_name: &str) -> bool {
        let lower = dir_name.to_lowercase();
        matches!(
            lower.as_str(),
            "src"
                | "source"
                | "test"
                | "tests"
                | "spec"
                | "specs"
                | "public"
                | "assets"
                | "static"
                | "resources"
                | "res"
                | "docs"
                | "doc"
                | "documentation"
                | "scripts"
                | "migrations"
                | "fixtures"
                | "mock"
                | "mocks"
                | "locales"
                | "templates"
                | "views"
                | "config"
                | ".github"
                | ".gitlab"
        )
    }

    /// Determines if a file is a high-signal project manifest marker
    pub fn is_project_manifest_file(file_name: &str) -> bool {
        let lower = file_name.to_lowercase();
        matches!(
            lower.as_str(),
            "package.json"
                | "cargo.toml"
                | "pom.xml"
                | "build.gradle"
                | "build.gradle.kts"
                | "settings.gradle"
                | "settings.gradle.kts"
                | "requirements.txt"
                | "pyproject.toml"
                | "pipfile"
                | "setup.py"
                | "go.mod"
                | "composer.json"
                | "gemfile"
        ) || lower.ends_with(".csproj")
            || lower.ends_with(".fsproj")
            || lower.ends_with(".sln")
    }

    /// Perform fast, bounded breadth-first scope analysis and project candidate discovery
    pub fn analyze_scope(root: &Path) -> FolderScopeAnalysis {
        let start_time = Instant::now();
        let root_str = root.to_string_lossy().to_string();

        // 1. Safety Guard check
        let (is_blocked, block_reason) = Self::is_protected_system_path(root);
        if is_blocked {
            return FolderScopeAnalysis {
                root_path: root_str,
                classification: ScopeClassification::Blocked,
                reason: block_reason,
                estimated_files: 0,
                estimated_directories: 0,
                excluded_directories: vec![
                    "node_modules".into(),
                    ".git".into(),
                    "target".into(),
                    "dist".into(),
                    "build".into(),
                ],
                project_candidates: Vec::new(),
                is_budget_exceeded: false,
                is_cancelled: false,
                scan_duration_ms: start_time.elapsed().as_millis() as u64,
            };
        }

        let (is_broad_user, broad_user_reason) = Self::is_broad_user_container(root);

        if !root.exists() || !root.is_dir() {
            return FolderScopeAnalysis {
                root_path: root_str,
                classification: ScopeClassification::Blocked,
                reason: Some("Folder does not exist or is not a directory.".to_string()),
                estimated_files: 0,
                estimated_directories: 0,
                excluded_directories: Vec::new(),
                project_candidates: Vec::new(),
                is_budget_exceeded: false,
                is_cancelled: false,
                scan_duration_ms: start_time.elapsed().as_millis() as u64,
            };
        }

        let mut file_count: u32 = 0;
        let mut dir_count: u32 = 0;
        let mut is_budget_exceeded = false;
        let mut raw_candidates: HashMap<PathBuf, RawCandidateData> = HashMap::new();
        let mut root_has_direct_manifest = false;

        let excluded_dirs = vec![
            "node_modules".to_string(),
            ".git".to_string(),
            "target".to_string(),
            "dist".to_string(),
            "build".to_string(),
            ".gradle".to_string(),
            "venv".to_string(),
        ];

        // 2. Bounded Breadth-First Traversal (BFS)
        let mut queue: VecDeque<(PathBuf, usize)> = VecDeque::new();
        queue.push_back((root.to_path_buf(), 0));

        while let Some((curr_dir, curr_depth)) = queue.pop_front() {
            if start_time.elapsed() >= MAX_DISCOVERY_TIME {
                is_budget_exceeded = true;
                break;
            }

            dir_count += 1;
            if dir_count >= MAX_DISCOVERY_DIRECTORIES {
                is_budget_exceeded = true;
                break;
            }

            let read_res = match fs::read_dir(&curr_dir) {
                Ok(r) => r,
                Err(_) => continue, // Permission error or unreadable directory
            };

            let mut subdirs_to_enqueue: Vec<PathBuf> = Vec::new();

            for entry_res in read_res {
                if start_time.elapsed() >= MAX_DISCOVERY_TIME {
                    is_budget_exceeded = true;
                    break;
                }

                let entry = match entry_res {
                    Ok(e) => e,
                    Err(_) => continue,
                };

                let file_type = match entry.file_type() {
                    Ok(ft) => ft,
                    Err(_) => continue,
                };

                let file_name = entry.file_name().to_string_lossy().to_string();

                if file_type.is_dir() {
                    if !Self::is_ignored_directory(&file_name) {
                        // For depth >= 1, prune internal source/asset directories from project root discovery
                        if curr_depth == 0 || !Self::is_internal_source_directory(&file_name) {
                            subdirs_to_enqueue.push(entry.path());
                        }
                    }
                } else if file_type.is_file() {
                    file_count += 1;
                    if file_count >= MAX_DISCOVERY_FILES {
                        is_budget_exceeded = true;
                        break;
                    }

                    if Self::is_project_manifest_file(&file_name) {
                        if curr_dir == root {
                            root_has_direct_manifest = true;
                        }

                        let cand = raw_candidates.entry(curr_dir.clone()).or_insert_with(|| RawCandidateData {
                            manifests: Vec::new(),
                            languages: Vec::new(),
                            frameworks: Vec::new(),
                        });

                        if !cand.manifests.contains(&file_name) {
                            cand.manifests.push(file_name.clone());
                        }

                        Self::inspect_manifest_metadata_raw(
                            &entry.path(),
                            &file_name,
                            &mut cand.languages,
                            &mut cand.frameworks,
                        );
                    }
                }
            }

            if is_budget_exceeded {
                break;
            }

            // Enqueue child subdirectories if not at max depth
            if curr_depth < MAX_DISCOVERY_DEPTH {
                for subdir in subdirs_to_enqueue {
                    queue.push_back((subdir, curr_depth + 1));
                }
            }
        }

        // 3. Root-First Project Identification via Project Intelligence
        let intel = crate::pipeline::discovery::ProjectScanner::scan(root);

        let is_root_valid_project = if is_broad_user {
            false
        } else {
            root_has_direct_manifest
                || intel.root_has_manifest
                || intel.architecture_type == "full-stack"
                || (intel.architecture_type == "single" && !intel.components.is_empty())
                || (intel.git_info.repository && !intel.components.is_empty())
                || (intel.architecture_type == "monorepo" && (intel.root_has_manifest || intel.git_info.repository))
        };

        let (project_candidates, classification, reason) = if is_root_valid_project {
            let proj_name = if !intel.project_name.is_empty() {
                intel.project_name.clone()
            } else {
                let n = root.file_name().unwrap_or_default().to_string_lossy().to_string();
                if n.is_empty() {
                    "Root Project".to_string()
                } else {
                    n
                }
            };

            let manifest_str = if !intel.root_manifests.is_empty() {
                intel.root_manifests.join(", ")
            } else {
                intel
                    .relevant_files
                    .iter()
                    .filter(|f| !f.contains('/'))
                    .cloned()
                    .collect::<Vec<_>>()
                    .join(", ")
            };

            let candidates = vec![DiscoveredProjectCandidate {
                name: proj_name,
                path: root.to_string_lossy().to_string(),
                relative_path: ".".to_string(),
                manifest_type: manifest_str,
                frameworks: intel.frameworks.clone(),
                languages: intel.languages.clone(),
            }];

            (candidates, ScopeClassification::Safe, None)
        } else {
            // Roll up & aggregate submodules into top-level project candidates under the scanned root
            let mut aggregated_map: HashMap<PathBuf, DiscoveredProjectCandidate> = HashMap::new();

            for (cand_path, raw) in raw_candidates {
                // Determine project target path
                let (target_proj_path, is_root) = if cand_path == root {
                    (root.to_path_buf(), true)
                } else if let Ok(rel) = cand_path.strip_prefix(root) {
                    let mut components = rel.components();
                    if let Some(first) = components.next() {
                        let depth1_path = root.join(first);
                        (depth1_path, false)
                    } else {
                        (cand_path.clone(), false)
                    }
                } else {
                    (cand_path.clone(), false)
                };

                let dir_name = target_proj_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();

                let rel_path = target_proj_path
                    .strip_prefix(root)
                    .unwrap_or(&target_proj_path)
                    .to_string_lossy()
                    .replace("\\", "/");

                let final_name = if is_root || rel_path.is_empty() {
                    let n = root.file_name().unwrap_or_default().to_string_lossy().to_string();
                    if n.is_empty() {
                        "Root Project".to_string()
                    } else {
                        n
                    }
                } else {
                    dir_name
                };

                let entry = aggregated_map.entry(target_proj_path.clone()).or_insert_with(|| {
                    DiscoveredProjectCandidate {
                        name: final_name,
                        path: target_proj_path.to_string_lossy().to_string(),
                        relative_path: if rel_path.is_empty() {
                            ".".to_string()
                        } else {
                            rel_path
                        },
                        manifest_type: String::new(),
                        frameworks: Vec::new(),
                        languages: Vec::new(),
                    }
                });

                // Merge manifests
                for m in raw.manifests {
                    if entry.manifest_type.is_empty() {
                        entry.manifest_type = m;
                    } else if !entry.manifest_type.contains(&m) {
                        entry.manifest_type.push_str(&format!(", {}", m));
                    }
                }

                // Merge languages
                for lang in raw.languages {
                    if !entry.languages.contains(&lang) {
                        entry.languages.push(lang);
                    }
                }

                // Merge frameworks
                for fw in raw.frameworks {
                    if !entry.frameworks.contains(&fw) {
                        entry.frameworks.push(fw);
                    }
                }
            }

            let mut candidates: Vec<DiscoveredProjectCandidate> =
                aggregated_map.into_values().collect();

            // Sort candidates:
            // 1. Root candidate (".") first
            // 2. Alphabetical by relative path / name
            candidates.sort_by(|a, b| {
                if a.relative_path == "." {
                    std::cmp::Ordering::Less
                } else if b.relative_path == "." {
                    std::cmp::Ordering::Greater
                } else {
                    a.name.to_lowercase().cmp(&b.name.to_lowercase())
                }
            });

            let total_candidates_found = candidates.len();
            let candidate_limit_reached = total_candidates_found > MAX_PROJECT_CANDIDATES;
            if candidate_limit_reached {
                candidates.truncate(MAX_PROJECT_CANDIDATES);
            }

            // Scope Classification for non-root projects
            let class = if is_broad_user {
                ScopeClassification::Large
            } else if is_budget_exceeded {
                ScopeClassification::Large
            } else if candidates.len() > 1 {
                ScopeClassification::Large
            } else if candidates.len() == 1 && file_count < 2500 && dir_count < 300 {
                ScopeClassification::Safe
            } else if candidates.is_empty() {
                if file_count < 500 && dir_count < 50 {
                    ScopeClassification::Safe
                } else {
                    ScopeClassification::Large
                }
            } else {
                ScopeClassification::Large
            };

            let reason_text = match class {
                ScopeClassification::Safe => None,
                ScopeClassification::Large => {
                    if is_broad_user {
                        broad_user_reason.or_else(|| {
                            Some("Broad user directory is not a project root.".to_string())
                        })
                    } else if candidate_limit_reached {
                        Some(format!(
                            "Showing first {} projects. Discovery limit reached.",
                            MAX_PROJECT_CANDIDATES
                        ))
                    } else if is_budget_exceeded {
                        Some(
                            "Scan scope exceeded safety limits (files/directories threshold). Discovery was stopped to protect system resources."
                                .to_string(),
                        )
                    } else if candidates.len() > 1 {
                        Some(format!(
                            "Multiple project candidates ({}) detected in folder.",
                            candidates.len()
                        ))
                    } else {
                        Some(
                            "Folder structure is extensive and may contain nested or multi-component projects."
                                .to_string(),
                        )
                    }
                }
                ScopeClassification::Blocked => block_reason,
            };

            (candidates, class, reason_text)
        };

        FolderScopeAnalysis {
            root_path: root_str,
            classification,
            reason,
            estimated_files: file_count,
            estimated_directories: dir_count,
            excluded_directories: excluded_dirs,
            project_candidates,
            is_budget_exceeded,
            is_cancelled: false,
            scan_duration_ms: start_time.elapsed().as_millis() as u64,
        }
    }

    /// Fast, non-blocking metadata inspection for manifest files
    fn inspect_manifest_metadata_raw(
        manifest_path: &Path,
        file_name: &str,
        languages: &mut Vec<String>,
        frameworks: &mut Vec<String>,
    ) {
        let snippet = match fs::File::open(manifest_path) {
            Ok(mut f) => {
                use std::io::Read;
                let mut buf = vec![0u8; 8192];
                let n = f.read(&mut buf).unwrap_or(0);
                String::from_utf8_lossy(&buf[..n]).to_lowercase()
            }
            Err(_) => String::new(),
        };

        match file_name {
            "package.json" => {
                if !languages.contains(&"TypeScript/JavaScript".to_string()) {
                    languages.push("TypeScript/JavaScript".to_string());
                }
                if snippet.contains("\"react\"") && !frameworks.contains(&"React".to_string()) {
                    frameworks.push("React".to_string());
                }
                if snippet.contains("\"vite\"") && !frameworks.contains(&"Vite".to_string()) {
                    frameworks.push("Vite".to_string());
                }
                if snippet.contains("\"next\"") && !frameworks.contains(&"Next.js".to_string()) {
                    frameworks.push("Next.js".to_string());
                }
                if snippet.contains("\"vue\"") && !frameworks.contains(&"Vue".to_string()) {
                    frameworks.push("Vue".to_string());
                }
                if snippet.contains("\"@nestjs/core\"")
                    && !frameworks.contains(&"NestJS".to_string())
                {
                    frameworks.push("NestJS".to_string());
                }
                if snippet.contains("\"express\"") && !frameworks.contains(&"Express".to_string()) {
                    frameworks.push("Express".to_string());
                }
            }
            "Cargo.toml" => {
                if !languages.contains(&"Rust".to_string()) {
                    languages.push("Rust".to_string());
                }
                if snippet.contains("tauri") && !frameworks.contains(&"Tauri".to_string()) {
                    frameworks.push("Tauri".to_string());
                }
                if snippet.contains("axum") && !frameworks.contains(&"Axum".to_string()) {
                    frameworks.push("Axum".to_string());
                }
                if snippet.contains("actix-web") && !frameworks.contains(&"Actix".to_string()) {
                    frameworks.push("Actix".to_string());
                }
            }
            "pom.xml" | "build.gradle" | "build.gradle.kts" | "settings.gradle"
            | "settings.gradle.kts" => {
                if !languages.contains(&"Java".to_string()) {
                    languages.push("Java".to_string());
                }
                if snippet.contains("spring-boot") && !frameworks.contains(&"Spring Boot".to_string())
                {
                    frameworks.push("Spring Boot".to_string());
                }
            }
            "requirements.txt" | "pyproject.toml" | "Pipfile" | "setup.py" => {
                if !languages.contains(&"Python".to_string()) {
                    languages.push("Python".to_string());
                }
                if snippet.contains("fastapi") && !frameworks.contains(&"FastAPI".to_string()) {
                    frameworks.push("FastAPI".to_string());
                }
                if snippet.contains("django") && !frameworks.contains(&"Django".to_string()) {
                    frameworks.push("Django".to_string());
                }
                if snippet.contains("flask") && !frameworks.contains(&"Flask".to_string()) {
                    frameworks.push("Flask".to_string());
                }
            }
            "go.mod" => {
                if !languages.contains(&"Go".to_string()) {
                    languages.push("Go".to_string());
                }
            }
            "composer.json" => {
                if !languages.contains(&"PHP".to_string()) {
                    languages.push("PHP".to_string());
                }
                if snippet.contains("laravel") && !frameworks.contains(&"Laravel".to_string()) {
                    frameworks.push("Laravel".to_string());
                }
            }
            "Gemfile" => {
                if !languages.contains(&"Ruby".to_string()) {
                    languages.push("Ruby".to_string());
                }
                if snippet.contains("rails") && !frameworks.contains(&"Rails".to_string()) {
                    frameworks.push("Rails".to_string());
                }
            }
            _ => {
                if file_name.ends_with(".csproj")
                    || file_name.ends_with(".fsproj")
                    || file_name.ends_with(".sln")
                {
                    if !languages.contains(&"C#/.NET".to_string()) {
                        languages.push("C#/.NET".to_string());
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_blocked_system_roots() {
        let (blocked, _) = FolderSafetyGuard::is_protected_system_path(Path::new("C:\\"));
        assert!(blocked, "C:\\ must be blocked");

        let (blocked, _) = FolderSafetyGuard::is_protected_system_path(Path::new("C:/"));
        assert!(blocked, "C:/ must be blocked");

        let (blocked, _) = FolderSafetyGuard::is_protected_system_path(Path::new("D:\\"));
        assert!(blocked, "D:\\ must be blocked");

        let (blocked, _) = FolderSafetyGuard::is_protected_system_path(Path::new("C:\\Windows"));
        assert!(blocked, "C:\\Windows must be blocked");

        let (blocked, _) =
            FolderSafetyGuard::is_protected_system_path(Path::new("C:\\Windows\\System32"));
        assert!(blocked, "C:\\Windows\\System32 must be blocked");

        let (blocked, _) =
            FolderSafetyGuard::is_protected_system_path(Path::new("C:\\Program Files"));
        assert!(blocked, "C:\\Program Files must be blocked");

        let (blocked, _) =
            FolderSafetyGuard::is_protected_system_path(Path::new("C:\\Program Files (x86)"));
        assert!(blocked, "C:\\Program Files (x86) must be blocked");

        let (blocked, _) =
            FolderSafetyGuard::is_protected_system_path(Path::new("C:\\ProgramData"));
        assert!(blocked, "C:\\ProgramData must be blocked");

        let (blocked, _) =
            FolderSafetyGuard::is_protected_system_path(Path::new("E:\\System Volume Information"));
        assert!(blocked, "System Volume Information must be blocked");

        let (blocked, _) =
            FolderSafetyGuard::is_protected_system_path(Path::new("D:\\$Recycle.Bin"));
        assert!(blocked, "$Recycle.Bin must be blocked");
    }

    #[test]
    fn test_safe_normal_path() {
        let (blocked, _) =
            FolderSafetyGuard::is_protected_system_path(Path::new("E:\\Github\\Event_Management_Ticket"));
        assert!(!blocked, "Standard project path should not be blocked");
    }

    #[test]
    fn test_ignored_directories() {
        assert!(FolderSafetyGuard::is_ignored_directory(".git"));
        assert!(FolderSafetyGuard::is_ignored_directory("node_modules"));
        assert!(FolderSafetyGuard::is_ignored_directory("target"));
        assert!(FolderSafetyGuard::is_ignored_directory("dist"));
        assert!(FolderSafetyGuard::is_ignored_directory("build"));
        assert!(FolderSafetyGuard::is_ignored_directory(".gradle"));
        assert!(FolderSafetyGuard::is_ignored_directory(".idea"));
        assert!(FolderSafetyGuard::is_ignored_directory("venv"));
        assert!(FolderSafetyGuard::is_ignored_directory(".env"));
        assert!(!FolderSafetyGuard::is_ignored_directory("src"));
    }

    #[test]
    fn test_internal_source_directories() {
        assert!(FolderSafetyGuard::is_internal_source_directory("src"));
        assert!(FolderSafetyGuard::is_internal_source_directory("test"));
        assert!(FolderSafetyGuard::is_internal_source_directory("public"));
        assert!(FolderSafetyGuard::is_internal_source_directory("assets"));
        assert!(!FolderSafetyGuard::is_internal_source_directory("backend"));
        assert!(!FolderSafetyGuard::is_internal_source_directory("frontend"));
        assert!(!FolderSafetyGuard::is_internal_source_directory("AI_Study_Planner"));
    }

    #[test]
    fn test_manifest_file_recognition() {
        assert!(FolderSafetyGuard::is_project_manifest_file("pom.xml"));
        assert!(FolderSafetyGuard::is_project_manifest_file("package.json"));
        assert!(FolderSafetyGuard::is_project_manifest_file("Cargo.toml"));
        assert!(FolderSafetyGuard::is_project_manifest_file("build.gradle"));
        assert!(FolderSafetyGuard::is_project_manifest_file("build.gradle.kts"));
        assert!(FolderSafetyGuard::is_project_manifest_file("requirements.txt"));
        assert!(FolderSafetyGuard::is_project_manifest_file("pyproject.toml"));
        assert!(FolderSafetyGuard::is_project_manifest_file("go.mod"));
        assert!(FolderSafetyGuard::is_project_manifest_file("App.csproj"));
        assert!(FolderSafetyGuard::is_project_manifest_file("Solution.sln"));
        assert!(!FolderSafetyGuard::is_project_manifest_file("index.ts"));
        assert!(!FolderSafetyGuard::is_project_manifest_file("Main.java"));
    }

    #[test]
    fn test_scope_analysis_blocked() {
        let analysis = FolderSafetyGuard::analyze_scope(Path::new("C:\\Windows"));
        assert_eq!(analysis.classification, ScopeClassification::Blocked);
        assert!(analysis.reason.is_some());
    }

    #[test]
    fn test_broad_user_containers() {
        // Windows-style paths
        let (is_broad, reason) = FolderSafetyGuard::is_broad_user_container(Path::new("C:\\Users\\Alice\\Downloads"));
        assert!(is_broad, "Downloads under user profile must be detected as broad user container");
        assert!(reason.unwrap().contains("Broad user directory"));

        let (is_broad, _) = FolderSafetyGuard::is_broad_user_container(Path::new("C:\\Users\\Alice\\Documents"));
        assert!(is_broad, "Documents under user profile must be detected as broad user container");

        let (is_broad, _) = FolderSafetyGuard::is_broad_user_container(Path::new("C:\\Users\\Alice\\Desktop"));
        assert!(is_broad, "Desktop under user profile must be detected as broad user container");

        let (is_broad, _) = FolderSafetyGuard::is_broad_user_container(Path::new("C:\\Users\\Alice"));
        assert!(is_broad, "User profile root must be detected as broad user container");

        let (is_broad, _) = FolderSafetyGuard::is_broad_user_container(Path::new("C:\\Users"));
        assert!(is_broad, "C:\\Users root must be detected as broad user container");

        // Unix-style paths
        let (is_broad, _) = FolderSafetyGuard::is_broad_user_container(Path::new("/home/alice/Downloads"));
        assert!(is_broad, "/home/alice/Downloads must be detected as broad user container");

        let (is_broad, _) = FolderSafetyGuard::is_broad_user_container(Path::new("/Users/alice/Desktop"));
        assert!(is_broad, "/Users/alice/Desktop must be detected as broad user container");

        let (is_broad, _) = FolderSafetyGuard::is_broad_user_container(Path::new("/home/alice"));
        assert!(is_broad, "/home/alice must be detected as broad user container");

        // Standard project subdirectories should NOT be flagged as broad user containers
        let (is_broad, _) = FolderSafetyGuard::is_broad_user_container(Path::new("E:\\Github\\Event-Ticket-Manager"));
        assert!(!is_broad, "Project folder must not be flagged as broad user container");

        let (is_broad, _) = FolderSafetyGuard::is_broad_user_container(Path::new("C:\\Users\\Alice\\Downloads\\Event-Ticket-Manager"));
        assert!(!is_broad, "Project inside Downloads must not be flagged as broad user container");
    }

    #[test]
    fn test_root_first_fullstack_project_resolution() {
        use tempfile::tempdir;
        let dir = tempdir().unwrap();
        let root = dir.path();

        // Simulate Event-Ticket-Manager with backend & frontend subdirectories
        let backend = root.join("backend");
        let frontend = root.join("frontend");
        fs::create_dir_all(&backend).unwrap();
        fs::create_dir_all(&frontend).unwrap();

        fs::write(backend.join("pom.xml"), "<project><packaging>jar</packaging><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter</artifactId></dependency></dependencies></project>").unwrap();
        fs::write(frontend.join("package.json"), "{\"name\": \"frontend\", \"dependencies\": {\"react\": \"^18.0.0\"}}").unwrap();

        let analysis = FolderSafetyGuard::analyze_scope(root);
        assert_eq!(analysis.classification, ScopeClassification::Safe, "Fullstack project root must be classified as SAFE");
        assert_eq!(analysis.project_candidates.len(), 1, "Must contain exactly 1 candidate for the root project");
        assert_eq!(analysis.project_candidates[0].relative_path, ".", "Candidate must be the root project");
        assert!(analysis.project_candidates[0].languages.contains(&"Java".to_string()));
        assert!(analysis.project_candidates[0].languages.contains(&"TypeScript/JavaScript".to_string()));
        assert!(analysis.project_candidates[0].frameworks.contains(&"Spring Boot".to_string()));
        assert!(analysis.project_candidates[0].frameworks.contains(&"React".to_string()));
    }

    #[test]
    fn test_multi_project_workspace_resolution() {
        use tempfile::tempdir;
        let dir = tempdir().unwrap();
        let root = dir.path();

        // Simulate multi-project workspace with Project-A, Project-B, Project-C (independent, no root manifest, not git)
        let proj_a = root.join("Project-A");
        let proj_b = root.join("Project-B");
        let proj_c = root.join("Project-C");
        fs::create_dir_all(&proj_a).unwrap();
        fs::create_dir_all(&proj_b).unwrap();
        fs::create_dir_all(&proj_c).unwrap();

        fs::write(proj_a.join("package.json"), "{\"name\": \"project-a\"}").unwrap();
        fs::write(proj_b.join("Cargo.toml"), "[package]\nname = \"project-b\"\nversion = \"0.1.0\"").unwrap();
        fs::write(proj_c.join("pom.xml"), "<project><packaging>jar</packaging></project>").unwrap();

        let analysis = FolderSafetyGuard::analyze_scope(root);
        assert_eq!(analysis.classification, ScopeClassification::Large, "Multi-project workspace must be classified as LARGE");
        assert_eq!(analysis.project_candidates.len(), 3, "Must discover 3 independent project candidates");
        let names: Vec<String> = analysis.project_candidates.iter().map(|c| c.name.clone()).collect();
        assert!(names.contains(&"Project-A".to_string()));
        assert!(names.contains(&"Project-B".to_string()));
        assert!(names.contains(&"Project-C".to_string()));
    }
}
