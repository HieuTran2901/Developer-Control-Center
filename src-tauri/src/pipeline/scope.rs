use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use walkdir::WalkDir;

pub const MAX_DISCOVERY_FILES: u32 = 5000;
pub const MAX_DISCOVERY_DIRECTORIES: u32 = 1000;
pub const MAX_DISCOVERY_DEPTH: usize = 5;
pub const MAX_DISCOVERY_TIME: Duration = Duration::from_millis(3000);

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

impl FolderSafetyGuard {
    /// Check if a path is a protected system root or dangerous system path
    pub fn is_protected_system_path(path: &Path) -> (bool, Option<String>) {
        let canonical_str = path.to_string_lossy().to_string();
        let normalized = canonical_str.replace("/", "\\");
        let trimmed = normalized.trim_end_matches('\\');

        // Check drive root (e.g. "C:", "D:", "C:\", "D:\", etc.)
        if trimmed.len() <= 2 && trimmed.ends_with(':') {
            return (true, Some(format!("Drive root '{}' is too broad for a project scan.", canonical_str)));
        }
        if trimmed.is_empty() || trimmed == "\\" || trimmed == "/" {
            return (true, Some("System filesystem root is too broad for a project scan.".to_string()));
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
                Some(format!("System volume directory '{}' is protected.", canonical_str)),
            );
        }

        // Check Unix protected system roots
        let unix_protected = [
            "/bin", "/boot", "/dev", "/etc", "/lib", "/lib32", "/lib64", "/proc",
            "/root", "/run", "/sbin", "/sys", "/usr", "/var"
        ];
        let unix_norm = canonical_str.replace("\\", "/");
        let unix_trimmed = unix_norm.trim_end_matches('/');
        for prefix in unix_protected.iter() {
            if unix_trimmed == *prefix || unix_trimmed.starts_with(&format!("{}/", prefix)) {
                return (
                    true,
                    Some(format!("Unix system path '{}' is protected.", canonical_str)),
                );
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

    /// Perform fast scope analysis and lightweight project candidate discovery within strict scan budget
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
        let mut candidates_map: HashMap<PathBuf, DiscoveredProjectCandidate> = HashMap::new();
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

        // 2. Traversal with budget limits
        let walker = WalkDir::new(root)
            .max_depth(MAX_DISCOVERY_DEPTH)
            .into_iter()
            .filter_entry(|e| {
                if e.file_type().is_dir() {
                    let name = e.file_name().to_string_lossy();
                    // Don't descend into ignored directories
                    if Self::is_ignored_directory(&name) && e.depth() > 0 {
                        return false;
                    }
                }
                true
            });

        for entry in walker {
            // Check scan budget timeout
            if start_time.elapsed() >= MAX_DISCOVERY_TIME {
                is_budget_exceeded = true;
                break;
            }

            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue, // Gracefully ignore permission denied or read errors
            };

            if entry.file_type().is_dir() {
                dir_count += 1;
                if dir_count >= MAX_DISCOVERY_DIRECTORIES {
                    is_budget_exceeded = true;
                    break;
                }
            } else if entry.file_type().is_file() {
                file_count += 1;
                if file_count >= MAX_DISCOVERY_FILES {
                    is_budget_exceeded = true;
                    break;
                }

                let path = entry.path();
                let file_name = path.file_name().unwrap_or_default().to_string_lossy();
                let file_name_str = file_name.as_ref();

                // Check for project manifest indicators
                let is_manifest = matches!(
                    file_name_str,
                    "package.json"
                        | "Cargo.toml"
                        | "pom.xml"
                        | "build.gradle"
                        | "build.gradle.kts"
                        | "requirements.txt"
                        | "pyproject.toml"
                        | "go.mod"
                ) || file_name_str.ends_with(".csproj")
                    || file_name_str.ends_with(".sln");

                if is_manifest {
                    if let Some(parent) = path.parent() {
                        let is_root_manifest = parent == root;
                        if is_root_manifest {
                            root_has_direct_manifest = true;
                        }

                        let candidate = candidates_map.entry(parent.to_path_buf()).or_insert_with(|| {
                            let dir_name = parent.file_name().unwrap_or_default().to_string_lossy().to_string();
                            let rel = parent.strip_prefix(root).unwrap_or(parent).to_string_lossy().replace("\\", "/");
                            let name = if is_root_manifest {
                                root.file_name().unwrap_or_default().to_string_lossy().to_string()
                            } else {
                                dir_name
                            };

                            DiscoveredProjectCandidate {
                                name: if name.is_empty() { "Root Project".to_string() } else { name },
                                path: parent.to_string_lossy().to_string(),
                                relative_path: if rel.is_empty() { ".".to_string() } else { rel },
                                manifest_type: file_name_str.to_string(),
                                frameworks: Vec::new(),
                                languages: Vec::new(),
                            }
                        });

                        // Lightweight detection of language & common framework from manifest name / small snippet
                        Self::inspect_manifest_metadata(path, file_name_str, candidate);
                    }
                }
            }
        }

        let mut project_candidates: Vec<DiscoveredProjectCandidate> = candidates_map.into_values().collect();
        // Sort candidates: root first, then alphabetical by relative path
        project_candidates.sort_by(|a, b| {
            if a.relative_path == "." {
                std::cmp::Ordering::Less
            } else if b.relative_path == "." {
                std::cmp::Ordering::Greater
            } else {
                a.relative_path.cmp(&b.relative_path)
            }
        });

        // 3. Classification logic
        let classification = if is_budget_exceeded {
            ScopeClassification::Large
        } else if project_candidates.len() > 1 {
            // Multiple projects found under folder
            ScopeClassification::Large
        } else if project_candidates.len() == 1 && root_has_direct_manifest && file_count < 1000 && dir_count < 150 {
            // Single self-contained project at root
            ScopeClassification::Safe
        } else if project_candidates.len() == 1 && file_count < 2500 && dir_count < 300 {
            // Single project in subfolder or root with reasonable file count
            ScopeClassification::Safe
        } else if project_candidates.is_empty() {
            if file_count < 500 && dir_count < 50 {
                ScopeClassification::Safe
            } else {
                ScopeClassification::Large
            }
        } else {
            ScopeClassification::Large
        };

        let reason = match classification {
            ScopeClassification::Safe => None,
            ScopeClassification::Large => {
                if is_budget_exceeded {
                    Some("Scan scope exceeded safety limits (files/directories threshold). Discovery was stopped to protect system resources.".to_string())
                } else if project_candidates.len() > 1 {
                    Some(format!("Multiple project candidates ({}) detected in folder.", project_candidates.len()))
                } else {
                    Some("Folder structure is extensive and may contain nested or multi-component projects.".to_string())
                }
            }
            ScopeClassification::Blocked => block_reason,
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
    fn inspect_manifest_metadata(
        manifest_path: &Path,
        file_name: &str,
        candidate: &mut DiscoveredProjectCandidate,
    ) {
        // Read at most 8KB of manifest for fast inspection
        let snippet = match std::fs::File::open(manifest_path) {
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
                if !candidate.languages.contains(&"TypeScript/JavaScript".to_string()) {
                    candidate.languages.push("TypeScript/JavaScript".to_string());
                }
                if snippet.contains("\"react\"") && !candidate.frameworks.contains(&"React".to_string()) {
                    candidate.frameworks.push("React".to_string());
                }
                if snippet.contains("\"vite\"") && !candidate.frameworks.contains(&"Vite".to_string()) {
                    candidate.frameworks.push("Vite".to_string());
                }
                if snippet.contains("\"next\"") && !candidate.frameworks.contains(&"Next.js".to_string()) {
                    candidate.frameworks.push("Next.js".to_string());
                }
                if snippet.contains("\"vue\"") && !candidate.frameworks.contains(&"Vue".to_string()) {
                    candidate.frameworks.push("Vue".to_string());
                }
                if snippet.contains("\"@nestjs/core\"") && !candidate.frameworks.contains(&"NestJS".to_string()) {
                    candidate.frameworks.push("NestJS".to_string());
                }
                if snippet.contains("\"express\"") && !candidate.frameworks.contains(&"Express".to_string()) {
                    candidate.frameworks.push("Express".to_string());
                }
            }
            "Cargo.toml" => {
                if !candidate.languages.contains(&"Rust".to_string()) {
                    candidate.languages.push("Rust".to_string());
                }
                if snippet.contains("tauri") && !candidate.frameworks.contains(&"Tauri".to_string()) {
                    candidate.frameworks.push("Tauri".to_string());
                }
                if snippet.contains("axum") && !candidate.frameworks.contains(&"Axum".to_string()) {
                    candidate.frameworks.push("Axum".to_string());
                }
                if snippet.contains("actix-web") && !candidate.frameworks.contains(&"Actix".to_string()) {
                    candidate.frameworks.push("Actix".to_string());
                }
            }
            "pom.xml" | "build.gradle" | "build.gradle.kts" => {
                if !candidate.languages.contains(&"Java".to_string()) {
                    candidate.languages.push("Java".to_string());
                }
                if snippet.contains("spring-boot") && !candidate.frameworks.contains(&"Spring Boot".to_string()) {
                    candidate.frameworks.push("Spring Boot".to_string());
                }
            }
            "requirements.txt" | "pyproject.toml" => {
                if !candidate.languages.contains(&"Python".to_string()) {
                    candidate.languages.push("Python".to_string());
                }
                if snippet.contains("fastapi") && !candidate.frameworks.contains(&"FastAPI".to_string()) {
                    candidate.frameworks.push("FastAPI".to_string());
                }
                if snippet.contains("django") && !candidate.frameworks.contains(&"Django".to_string()) {
                    candidate.frameworks.push("Django".to_string());
                }
                if snippet.contains("flask") && !candidate.frameworks.contains(&"Flask".to_string()) {
                    candidate.frameworks.push("Flask".to_string());
                }
            }
            "go.mod" => {
                if !candidate.languages.contains(&"Go".to_string()) {
                    candidate.languages.push("Go".to_string());
                }
            }
            _ => {
                if file_name.ends_with(".csproj") || file_name.ends_with(".sln") {
                    if !candidate.languages.contains(&"C#/.NET".to_string()) {
                        candidate.languages.push("C#/.NET".to_string());
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

        let (blocked, _) = FolderSafetyGuard::is_protected_system_path(Path::new("C:\\Windows\\System32"));
        assert!(blocked, "C:\\Windows\\System32 must be blocked");

        let (blocked, _) = FolderSafetyGuard::is_protected_system_path(Path::new("C:\\Program Files"));
        assert!(blocked, "C:\\Program Files must be blocked");

        let (blocked, _) = FolderSafetyGuard::is_protected_system_path(Path::new("C:\\Program Files (x86)"));
        assert!(blocked, "C:\\Program Files (x86) must be blocked");

        let (blocked, _) = FolderSafetyGuard::is_protected_system_path(Path::new("C:\\ProgramData"));
        assert!(blocked, "C:\\ProgramData must be blocked");

        let (blocked, _) = FolderSafetyGuard::is_protected_system_path(Path::new("E:\\System Volume Information"));
        assert!(blocked, "System Volume Information must be blocked");

        let (blocked, _) = FolderSafetyGuard::is_protected_system_path(Path::new("D:\\$Recycle.Bin"));
        assert!(blocked, "$Recycle.Bin must be blocked");
    }

    #[test]
    fn test_safe_normal_path() {
        let (blocked, _) = FolderSafetyGuard::is_protected_system_path(Path::new("E:\\Github\\Event_Management_Ticket"));
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
    fn test_scope_analysis_blocked() {
        let analysis = FolderSafetyGuard::analyze_scope(Path::new("C:\\Windows"));
        assert_eq!(analysis.classification, ScopeClassification::Blocked);
        assert!(analysis.reason.is_some());
    }
}
