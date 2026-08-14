use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

use crate::security::configuration_scanner::scanner::ConfigurationScanner;
use crate::security::dependency_scanner::osv::OsvProvider;
use crate::security::dependency_scanner::scanner::DependencyScanner;
use crate::security::domain::{SecurityScanEvent, SecurityScanSummary};
use crate::security::redactor::{DefaultRedactor, SecurityRedactor};
use crate::security::scanner::SecurityScanner;
use crate::security::secret_scanner::CoreSecretScanner;
use ignore::WalkBuilder;
use std::collections::HashSet;

/// Centralized default directories excluded from security scans to avoid
/// scanning generated artifacts, dependencies, build outputs, and caches.
pub const DEFAULT_SECURITY_EXCLUDED_DIRS: &[&str] = &[
    "node_modules",
    "dist",
    "build",
    "target",
    ".next",
    "coverage",
    ".cache",
    "out",
];

/// Returns true if a directory name matches any default security exclusion (case-insensitive).
pub fn is_default_security_excluded_dir(dir_name: &str) -> bool {
    DEFAULT_SECURITY_EXCLUDED_DIRS
        .iter()
        .any(|&excluded| excluded.eq_ignore_ascii_case(dir_name))
}

/// Builds a configured `ignore::Walk` that respects `.gitignore` rules while
/// pruning default excluded generated/dependency directories at any depth.
pub fn create_security_walker(root: &std::path::Path) -> ignore::Walk {
    let mut builder = WalkBuilder::new(root);
    builder.hidden(true);
    builder.git_ignore(true);
    builder.git_global(true);
    builder.git_exclude(true);
    builder.filter_entry(|entry| {
        // Prune default excluded directories at depth >= 1 to prevent descending into them
        if entry.depth() > 0 && entry.file_type().map_or(false, |ft| ft.is_dir()) {
            if let Some(name) = entry.file_name().to_str() {
                if is_default_security_excluded_dir(name) {
                    return false;
                }
            }
        }
        true
    });
    builder.build()
}

/// Discovers Git configuration files for the targeted project root without traversing
/// the entire codebase source tree.
pub fn locate_git_config_files(root: &std::path::Path) -> Vec<PathBuf> {
    let mut git_config_paths = Vec::new();
    let root_git = root.join(".git");

    if root_git.is_dir() {
        let config = root_git.join("config");
        if config.is_file() {
            git_config_paths.push(config);
        }
    } else if root_git.is_file() {
        // Git worktree or submodule pointer (e.g. "gitdir: ../.git/modules/...")
        if let Ok(content) = std::fs::read_to_string(&root_git) {
            let line = content.trim();
            if let Some(git_dir_rel) = line.strip_prefix("gitdir:") {
                let git_dir = root.join(git_dir_rel.trim());
                let config = git_dir.join("config");
                if config.is_file() {
                    git_config_paths.push(config);
                }
            }
        }
    } else if root.join("HEAD").is_file() && root.join("config").is_file() {
        // Bare repository
        git_config_paths.push(root.join("config"));
    }

    git_config_paths
}

pub struct SecurityEngine {
    scanners: Vec<Arc<dyn SecurityScanner>>,
    active_scans: Mutex<std::collections::HashMap<String, Arc<AtomicBool>>>,
}

impl SecurityEngine {
    pub fn new() -> Self {
        let mut engine = Self {
            scanners: Vec::new(),
            active_scans: Mutex::new(std::collections::HashMap::new()),
        };
        engine.register_scanner(Arc::new(CoreSecretScanner::new()));

        let osv_provider = Arc::new(OsvProvider::new());
        engine.register_scanner(Arc::new(DependencyScanner::new(osv_provider)));

        engine.register_scanner(Arc::new(ConfigurationScanner::new()));

        engine.register_scanner(Arc::new(
            crate::security::git_scanner::scanner::GitSecurityScanner::new(),
        ));

        engine
    }

    pub fn register_scanner(&mut self, scanner: Arc<dyn SecurityScanner>) {
        self.scanners.push(scanner);
    }

    /// Canonicalizes the path and ensures it's a valid directory.
    fn validate_root(&self, path: &str) -> Result<PathBuf, String> {
        let root = PathBuf::from(path);
        let canonical_root = std::fs::canonicalize(&root)
            .map_err(|e| format!("Failed to canonicalize root {}: {}", path, e))?;

        if !canonical_root.is_dir() {
            return Err("Project root must be a directory".to_string());
        }

        Ok(canonical_root)
    }

    pub async fn start_scan(
        &self,
        project_id: String,
        root_path: String,
        mode: crate::security::domain::SecurityScanMode,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        let scan_id = format!(
            "scan_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()
        );
        let cancel_token = Arc::new(AtomicBool::new(false));

        {
            let mut active = self.active_scans.lock().await;
            active.insert(scan_id.clone(), cancel_token.clone());
        }

        let canonical_root = self.validate_root(&root_path)?;

        let scan_id_clone = scan_id.clone();

        let _ = app_handle.emit(
            "security_event",
            SecurityScanEvent::Started {
                project_id: project_id.clone(),
                scan_id: scan_id.clone(),
            },
        );

        // Filter scanners based on SecurityScanMode
        let mut filtered_scanners = Vec::new();
        for scanner in &self.scanners {
            let sid = scanner.scanner_id();
            let include = match mode {
                crate::security::domain::SecurityScanMode::Quick => {
                    sid == "core_secret_scanner" || sid == "configuration_scanner"
                }
                crate::security::domain::SecurityScanMode::GitExposure => {
                    sid == "git_scanner"
                }
                crate::security::domain::SecurityScanMode::Full => true,
            };
            if include {
                filtered_scanners.push(scanner.clone());
            }
        }

        // Fast-path for GIT_EXPOSURE: directly inspect Git metadata without walking source files
        if matches!(mode, crate::security::domain::SecurityScanMode::GitExposure) {
            let scanners = filtered_scanners;
            let redactor = Arc::new(DefaultRedactor::new());
            let app_handle_task = app_handle.clone();
            let cancel_token_task = cancel_token.clone();
            let scan_id_task = scan_id_clone.clone();

            let handle = tauri::async_runtime::spawn(async move {
                let start_time = std::time::Instant::now();
                let mut summary = SecurityScanSummary::default();
                let git_config_paths = locate_git_config_files(&canonical_root);
                let mut scanned_files = 0;
                let mut all_findings = Vec::new();

                for path_to_scan in git_config_paths {
                    if cancel_token_task.load(Ordering::Relaxed) {
                        let _ = app_handle_task.emit(
                            "security_event",
                            SecurityScanEvent::Cancelled {
                                scan_id: scan_id_task,
                            },
                        );
                        return;
                    }

                    let _ = app_handle_task.emit(
                        "security_event",
                        SecurityScanEvent::Progress {
                            scan_id: scan_id_task.clone(),
                            scanned_files,
                            current_scanner: "git_scanner".to_string(),
                        },
                    );

                    for scanner in &scanners {
                        if cancel_token_task.load(Ordering::Relaxed) {
                            break;
                        }

                        let findings = match scanner.scan(&path_to_scan, cancel_token_task.clone()).await {
                            Ok(f) => f,
                            Err(_) => continue,
                        };

                        for mut finding in findings {
                            if let Some(ev) = finding.evidence.as_ref() {
                                let redacted = redactor.redact(&ev.0);
                                let bounded = crate::security::evidence::bound_evidence_string(
                                    &redacted.0,
                                    crate::security::evidence::DEFAULT_MAX_EVIDENCE_LENGTH,
                                );
                                finding.evidence = Some(crate::security::domain::RedactedEvidence(bounded));
                            }

                            match finding.severity {
                                crate::security::domain::SecuritySeverity::Critical => summary.critical += 1,
                                crate::security::domain::SecuritySeverity::High => summary.high += 1,
                                crate::security::domain::SecuritySeverity::Medium => summary.medium += 1,
                                crate::security::domain::SecuritySeverity::Low => summary.low += 1,
                                crate::security::domain::SecuritySeverity::Info => summary.info += 1,
                            }
                            summary.total_findings += 1;
                            all_findings.push(finding);
                        }
                    }
                    scanned_files += 1;
                }

                if cancel_token_task.load(Ordering::Relaxed) {
                    let _ = app_handle_task.emit(
                        "security_event",
                        SecurityScanEvent::Cancelled {
                            scan_id: scan_id_task,
                        },
                    );
                    return;
                }

                if !all_findings.is_empty() {
                    let _ = app_handle_task.emit(
                        "security_event",
                        SecurityScanEvent::FindingsChunk {
                            scan_id: scan_id_task.clone(),
                            findings: all_findings,
                        },
                    );
                }

                let _ = app_handle_task.emit(
                    "security_event",
                    SecurityScanEvent::Progress {
                        scan_id: scan_id_task.clone(),
                        scanned_files,
                        current_scanner: "Finalizing".to_string(),
                    },
                );

                summary.scan_duration_ms = start_time.elapsed().as_millis() as u64;

                let _ = app_handle_task.emit(
                    "security_event",
                    SecurityScanEvent::Completed {
                        scan_id: scan_id_task,
                        summary,
                    },
                );
            });

            // Supervisor task
            let supervisor_scan_id = scan_id.clone();
            let supervisor_app_handle = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(err_msg) = handle.await {
                    eprintln!("[SecurityEngine] GitExposure scan task failed/panicked for scan_id: {}: {:?}", supervisor_scan_id, err_msg);
                    let _ = supervisor_app_handle.emit(
                        "security_event",
                        SecurityScanEvent::Failed {
                            scan_id: supervisor_scan_id,
                            reason: "Security scanner task experienced a fatal runtime panic.".to_string(),
                        },
                    );
                }
            });

            return Ok(scan_id);
        }
        
        let is_quick_mode = matches!(mode, crate::security::domain::SecurityScanMode::Quick);
        let scanners = filtered_scanners;
        let redactor = Arc::new(DefaultRedactor::new());

        let app_handle_task = app_handle.clone();
        let handle = tauri::async_runtime::spawn(async move {
            let start_time = std::time::Instant::now();
            let mut summary = SecurityScanSummary::default();
            let mut chunk = Vec::new();
            let chunk_size = 50;

            let mut walk = create_security_walker(&canonical_root);
            let mut i = 0;
            let mut scanned_extra_files = HashSet::new();
            
            let mut last_progress_emit = std::time::Instant::now();

            loop {
                if cancel_token.load(Ordering::Relaxed) {
                    let _ = app_handle_task.emit(
                        "security_event",
                        SecurityScanEvent::Cancelled {
                            scan_id: scan_id_clone,
                        },
                    );
                    return;
                }

                let entry = match walk.next() {
                    Some(Ok(e)) => e,
                    Some(Err(_)) => continue,
                    None => break,
                };

                let mut paths_to_scan = Vec::new();
                let ft = entry.file_type();
                let is_dir = ft.as_ref().map_or(false, |ft| ft.is_dir());
                let is_file = ft.as_ref().map_or(false, |ft| ft.is_file());

                // If it's a directory, check if it contains a Git repository or env files
                if is_dir {
                    let git_config = entry.path().join(".git").join("config");
                    if git_config.is_file() && scanned_extra_files.insert(git_config.clone()) {
                        paths_to_scan.push(git_config);
                    }

                    let env_names = [".env", ".env.local", ".env.development", ".env.production", ".env.test", ".env.example"];
                    for env_name in env_names {
                        let env_path = entry.path().join(env_name);
                        if env_path.is_file() && scanned_extra_files.insert(env_path.clone()) {
                            paths_to_scan.push(env_path);
                        }
                    }
                }

                if is_file {
                    let p = entry.path().to_path_buf();
                    let mut should_scan = true;
                    if is_quick_mode {
                        if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                            let ext_lower = ext.to_lowercase();
                            // Skip common binary and media files
                            if matches!(ext_lower.as_str(), "exe" | "dll" | "so" | "dylib" | "jpg" | "jpeg" | "png" | "gif" | "mp4" | "zip" | "tar" | "gz" | "pdf" | "class" | "jar" | "bin" | "ttf" | "woff" | "woff2" | "eot" | "ico") {
                                should_scan = false;
                            }
                        }
                    }
                    if should_scan && scanned_extra_files.insert(p.clone()) {
                        paths_to_scan.push(p);
                    }
                }

                for path_to_scan in paths_to_scan {
                    if last_progress_emit.elapsed().as_millis() >= 200 {
                        let _ = app_handle_task.emit(
                            "security_event",
                            SecurityScanEvent::Progress {
                                scan_id: scan_id_clone.clone(),
                                scanned_files: i,
                                current_scanner: "MultiplexedScanners".to_string(),
                            },
                        );
                        last_progress_emit = std::time::Instant::now();
                    }

                    for scanner in &scanners {
                        if cancel_token.load(Ordering::Relaxed) {
                            break;
                        }

                        let mut findings = match scanner.scan(&path_to_scan, cancel_token.clone()).await {
                            Ok(f) => f,
                            Err(_) => continue,
                        };

                        // Deduplicate findings by ID for the same file (local to this scanner run)
                        let mut seen = HashSet::new();
                        findings.retain(|f| seen.insert(f.id.clone()));

                        // Redact and aggregate
                        for mut finding in findings {
                            if let Some(ev) = finding.evidence.as_ref() {
                                let redacted = redactor.redact(&ev.0);
                                let bounded = crate::security::evidence::bound_evidence_string(
                                    &redacted.0,
                                    crate::security::evidence::DEFAULT_MAX_EVIDENCE_LENGTH,
                                );
                                finding.evidence = Some(crate::security::domain::RedactedEvidence(bounded));
                            }

                            match finding.severity {
                                crate::security::domain::SecuritySeverity::Critical => {
                                    summary.critical += 1
                                }
                                crate::security::domain::SecuritySeverity::High => summary.high += 1,
                                crate::security::domain::SecuritySeverity::Medium => {
                                    summary.medium += 1
                                }
                                crate::security::domain::SecuritySeverity::Low => summary.low += 1,
                                crate::security::domain::SecuritySeverity::Info => summary.info += 1,
                            }
                            summary.total_findings += 1;

                            chunk.push(finding);

                            if chunk.len() >= chunk_size {
                                let _ = app_handle_task.emit(
                                    "security_event",
                                    SecurityScanEvent::FindingsChunk {
                                        scan_id: scan_id_clone.clone(),
                                        findings: std::mem::take(&mut chunk),
                                    },
                                );
                            }
                        }
                    }
                    i += 1;
                }
            }

            // Flush remaining chunk
            if !chunk.is_empty() {
                let _ = app_handle_task.emit(
                    "security_event",
                    SecurityScanEvent::FindingsChunk {
                        scan_id: scan_id_clone.clone(),
                        findings: chunk,
                    },
                );
            }

            if cancel_token.load(Ordering::Relaxed) {
                let _ = app_handle_task.emit(
                    "security_event",
                    SecurityScanEvent::Cancelled {
                        scan_id: scan_id_clone,
                    },
                );
                return;
            }

            // Final progress update
            let _ = app_handle_task.emit(
                "security_event",
                SecurityScanEvent::Progress {
                    scan_id: scan_id_clone.clone(),
                    scanned_files: i,
                    current_scanner: "Finalizing".to_string(),
                },
            );

            summary.scan_duration_ms = start_time.elapsed().as_millis() as u64;

            let _ = app_handle_task.emit(
                "security_event",
                SecurityScanEvent::Completed {
                    scan_id: scan_id_clone,
                    summary,
                },
            );
        });

        // Spawn a supervisor task to monitor the scan execution handle for JoinError/panic
        let supervisor_scan_id = scan_id.clone();
        let supervisor_app_handle = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(err_msg) = handle.await {
                eprintln!("[SecurityEngine] Scan task failed/panicked for scan_id: {}: {:?}", supervisor_scan_id, err_msg);
                let _ = supervisor_app_handle.emit(
                    "security_event",
                    SecurityScanEvent::Failed {
                        scan_id: supervisor_scan_id,
                        reason: "Security scanner task experienced a fatal runtime panic.".to_string(),
                    },
                );
            }
        });

        Ok(scan_id)
    }

    pub async fn cancel_scan(&self, scan_id: &str) -> Result<(), String> {
        let mut active = self.active_scans.lock().await;
        if let Some(token) = active.remove(scan_id) {
            token.store(true, Ordering::Relaxed);
            Ok(())
        } else {
            Err("Scan ID not found or already completed".to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_is_default_security_excluded_dir() {
        assert!(is_default_security_excluded_dir("node_modules"));
        assert!(is_default_security_excluded_dir("NODE_MODULES"));
        assert!(is_default_security_excluded_dir("dist"));
        assert!(is_default_security_excluded_dir("DIST"));
        assert!(is_default_security_excluded_dir("build"));
        assert!(is_default_security_excluded_dir("target"));
        assert!(is_default_security_excluded_dir(".next"));
        assert!(is_default_security_excluded_dir("coverage"));
        assert!(is_default_security_excluded_dir(".cache"));
        assert!(is_default_security_excluded_dir("out"));

        // Source and non-generated directories must NOT be excluded
        assert!(!is_default_security_excluded_dir("src"));
        assert!(!is_default_security_excluded_dir("app"));
        assert!(!is_default_security_excluded_dir("lib"));
        assert!(!is_default_security_excluded_dir("config"));
        assert!(!is_default_security_excluded_dir("public"));
        assert!(!is_default_security_excluded_dir("scripts"));
        assert!(!is_default_security_excluded_dir("tests"));
        assert!(!is_default_security_excluded_dir("resources"));
    }

    #[test]
    fn test_security_walker_pruning_default_exclusions() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        // 1. Legitimate source file (MUST be traversed)
        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(root.join("src/config.ts"), "export const config = {};").unwrap();

        // 2. node_modules (MUST NOT be traversed)
        fs::create_dir_all(root.join("node_modules/package")).unwrap();
        fs::write(root.join("node_modules/package/file.js"), "console.log('vendor');").unwrap();

        // 3. dist (MUST NOT be traversed)
        fs::create_dir_all(root.join("dist/assets")).unwrap();
        fs::write(root.join("dist/assets/index.js"), "console.log('bundle');").unwrap();

        // 4. build (MUST NOT be traversed)
        fs::create_dir_all(root.join("build/assets")).unwrap();
        fs::write(root.join("build/assets/index.js"), "console.log('build');").unwrap();

        // 5. target (MUST NOT be traversed)
        fs::create_dir_all(root.join("target/classes")).unwrap();
        fs::write(root.join("target/classes/example.class"), "binary data").unwrap();

        // 6. .next (MUST NOT be traversed)
        fs::create_dir_all(root.join(".next/static/chunks")).unwrap();
        fs::write(root.join(".next/static/chunks/app.js"), "console.log('next');").unwrap();

        // 7. coverage (MUST NOT be traversed)
        fs::create_dir_all(root.join("coverage")).unwrap();
        fs::write(root.join("coverage/lcov.info"), "TN:").unwrap();

        // 8. .cache (MUST NOT be traversed)
        fs::create_dir_all(root.join(".cache")).unwrap();
        fs::write(root.join(".cache/something.js"), "cache").unwrap();

        // 9. out (MUST NOT be traversed)
        fs::create_dir_all(root.join("out/assets")).unwrap();
        fs::write(root.join("out/assets/index.js"), "out").unwrap();

        // 10. Nested sub-modules (MUST NOT be traversed)
        fs::create_dir_all(root.join("frontend/node_modules/pkg")).unwrap();
        fs::write(root.join("frontend/node_modules/pkg/nested.js"), "nested").unwrap();

        fs::create_dir_all(root.join("frontend/dist")).unwrap();
        fs::write(root.join("frontend/dist/bundle.js"), "dist").unwrap();

        fs::create_dir_all(root.join("backend/target")).unwrap();
        fs::write(root.join("backend/target/app.jar"), "target").unwrap();

        let mut walker = create_security_walker(root);
        let mut visited_paths = Vec::new();

        while let Some(Ok(entry)) = walker.next() {
            if entry.file_type().map_or(false, |ft| ft.is_file()) {
                visited_paths.push(entry.path().to_path_buf());
            }
        }

        let visited_rel: Vec<String> = visited_paths
            .iter()
            .map(|p| p.strip_prefix(root).unwrap().to_string_lossy().replace('\\', "/"))
            .collect();

        // Source file MUST be traversed
        assert!(visited_rel.contains(&"src/config.ts".to_string()), "src/config.ts should be traversed");

        // Excluded files MUST NOT be traversed
        assert!(!visited_rel.iter().any(|p| p.contains("node_modules")), "node_modules should be pruned");
        assert!(!visited_rel.iter().any(|p| p.contains("dist/")), "dist/ should be pruned");
        assert!(!visited_rel.iter().any(|p| p.contains("build/")), "build/ should be pruned");
        assert!(!visited_rel.iter().any(|p| p.contains("target/")), "target/ should be pruned");
        assert!(!visited_rel.iter().any(|p| p.contains(".next/")), ".next/ should be pruned");
        assert!(!visited_rel.iter().any(|p| p.contains("coverage/")), "coverage/ should be pruned");
        assert!(!visited_rel.iter().any(|p| p.contains(".cache/")), ".cache/ should be pruned");
        assert!(!visited_rel.iter().any(|p| p.contains("out/")), "out/ should be pruned");
    }

    #[test]
    fn test_gitignore_compatibility() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        // Create a custom git repository simulation with .gitignore
        fs::write(root.join(".gitignore"), "custom_ignored/\n").unwrap();
        fs::create_dir_all(root.join("custom_ignored")).unwrap();
        fs::write(root.join("custom_ignored/temp.txt"), "secret").unwrap();

        fs::create_dir_all(root.join("app")).unwrap();
        fs::write(root.join("app/index.ts"), "code").unwrap();

        let mut walker = create_security_walker(root);
        let mut visited_paths = Vec::new();

        while let Some(Ok(entry)) = walker.next() {
            if entry.file_type().map_or(false, |ft| ft.is_file()) {
                visited_paths.push(entry.path().to_path_buf());
            }
        }

        let visited_rel: Vec<String> = visited_paths
            .iter()
            .map(|p| p.strip_prefix(root).unwrap().to_string_lossy().replace('\\', "/"))
            .collect();

        assert!(visited_rel.contains(&"app/index.ts".to_string()));
        assert!(!visited_rel.iter().any(|p| p.contains("custom_ignored")));
    }

    #[test]
    fn test_locate_git_config_standard_repo() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let git_dir = root.join(".git");
        fs::create_dir_all(&git_dir).unwrap();
        let config = git_dir.join("config");
        fs::write(&config, "[remote \"origin\"]\nurl = https://github.com/org/repo.git").unwrap();

        let configs = locate_git_config_files(root);
        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0], config);
    }

    #[test]
    fn test_locate_git_config_no_repo() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(root.join("src/index.ts"), "console.log('clean');").unwrap();

        let configs = locate_git_config_files(root);
        assert!(configs.is_empty());
    }

    #[test]
    fn test_locate_git_config_bare_repo() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("HEAD"), "ref: refs/heads/main").unwrap();
        let config = root.join("config");
        fs::write(&config, "[core]\nbare = true").unwrap();

        let configs = locate_git_config_files(root);
        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0], config);
    }

    #[test]
    fn test_locate_git_config_worktree_pointer() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let actual_git_dir = root.join(".git_actual");
        fs::create_dir_all(&actual_git_dir).unwrap();
        let config = actual_git_dir.join("config");
        fs::write(&config, "[core]\n").unwrap();

        fs::write(root.join(".git"), "gitdir: .git_actual").unwrap();

        let configs = locate_git_config_files(root);
        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0], config);
    }

    #[test]
    fn test_git_exposure_project_isolation() {
        let workspace = tempdir().unwrap();
        let project_a = workspace.path().join("project-a");
        let project_b = workspace.path().join("project-b");

        fs::create_dir_all(project_a.join(".git")).unwrap();
        fs::write(project_a.join(".git/config"), "[remote \"origin\"]\nurl = https://user:pass@github.com/a.git").unwrap();

        fs::create_dir_all(project_b.join(".git")).unwrap();
        fs::write(project_b.join(".git/config"), "[remote \"origin\"]\nurl = https://user:pass@github.com/b.git").unwrap();

        // When scanning project_a, only project_a config is found
        let configs_a = locate_git_config_files(&project_a);
        assert_eq!(configs_a.len(), 1);
        assert!(configs_a[0].starts_with(&project_a));
        assert!(!configs_a[0].starts_with(&project_b));
    }

    #[test]
    fn test_git_exposure_large_unrelated_tree_fast_lookup() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        // Create thousands of irrelevant files
        for i in 0..100 {
            let sub = root.join(format!("src/module_{}", i));
            fs::create_dir_all(&sub).unwrap();
            for j in 0..10 {
                fs::write(sub.join(format!("file_{}.ts", j)), "export const x = 1;").unwrap();
            }
        }

        // Normal git config
        let git_dir = root.join(".git");
        fs::create_dir_all(&git_dir).unwrap();
        let config = git_dir.join("config");
        fs::write(&config, "[remote \"origin\"]\nurl = https://github.com/org/repo.git").unwrap();

        let start = std::time::Instant::now();
        let configs = locate_git_config_files(root);
        let elapsed = start.elapsed();

        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0], config);
        // Fast path must complete in less than 50ms without traversing 1,000 source files
        assert!(elapsed.as_millis() < 50);
    }
}


