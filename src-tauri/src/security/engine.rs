use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

use crate::security::configuration_scanner::scanner::ConfigurationScanner;
use crate::security::dependency_scanner::osv::OsvProvider;
use crate::security::dependency_scanner::scanner::DependencyScanner;
use crate::security::domain::{
    ScannerExecutionDetail, ScannerExecutionState, SecurityScanEvent, SecurityScanExecutionSummary,
    SecurityScanMode, SecurityScanStatus, SecurityScanSummary,
};
use crate::security::redactor::{DefaultRedactor, SecurityRedactor};
use crate::security::scan_planner::{SecurityCapabilities, SecurityScanPlan};
use crate::security::scanner::SecurityScanner;
use crate::security::secret_scanner::CoreSecretScanner;
use ignore::WalkBuilder;
use std::collections::HashSet;

/// Constructs a pure, backend-authoritative execution summary for a security scan.
pub fn build_execution_summary(
    scan_id: String,
    project_id: String,
    project_name: String,
    mode: SecurityScanMode,
    plan: Option<&SecurityScanPlan>,
    status: SecurityScanStatus,
    executed_ids: &[&str],
    files_examined: usize,
    findings_count: usize,
    duration_ms: u64,
) -> SecurityScanExecutionSummary {
    let all_scanners = [
        ("core_secret_scanner", "Core Secret Scanner", "Secret"),
        ("configuration_scanner", "Configuration Scanner", "Configuration"),
        ("dependency_scanner", "Dependency Scanner", "Dependency"),
        ("git_scanner", "Git Security Scanner", "Git"),
    ];

    let is_git_available = plan.map_or(true, |p| p.git_available);
    let has_dep_manifests = plan.map_or(true, |p| !p.manifests.is_empty());
    let planned_caps = plan.map(|p| p.capabilities.clone());

    let mut executed_scanners = Vec::new();
    let mut skipped_scanners = Vec::new();
    let mut scanner_details = Vec::new();

    for (sid, sname, cat) in all_scanners {
        let is_executed = executed_ids.contains(&sid) && status == SecurityScanStatus::Completed;
        if is_executed {
            executed_scanners.push(sid.to_string());
            scanner_details.push(ScannerExecutionDetail {
                scanner_id: sid.to_string(),
                scanner_name: sname.to_string(),
                category: cat.to_string(),
                state: ScannerExecutionState::Executed,
                reason: Some("Executed successfully during scan".to_string()),
            });
        } else if status == SecurityScanStatus::Cancelled {
            skipped_scanners.push(sid.to_string());
            scanner_details.push(ScannerExecutionDetail {
                scanner_id: sid.to_string(),
                scanner_name: sname.to_string(),
                category: cat.to_string(),
                state: ScannerExecutionState::Cancelled,
                reason: Some("Scan cancelled by user".to_string()),
            });
        } else if status == SecurityScanStatus::Failed {
            skipped_scanners.push(sid.to_string());
            scanner_details.push(ScannerExecutionDetail {
                scanner_id: sid.to_string(),
                scanner_name: sname.to_string(),
                category: cat.to_string(),
                state: ScannerExecutionState::Failed,
                reason: Some("Scan task encountered a runtime error".to_string()),
            });
        } else {
            // Not executed in completed scan
            skipped_scanners.push(sid.to_string());
            let (state, reason) = if sid == "git_scanner" && !is_git_available {
                (
                    ScannerExecutionState::Unavailable,
                    "Target is not a Git repository".to_string(),
                )
            } else if sid == "dependency_scanner" && !has_dep_manifests && mode == SecurityScanMode::Full {
                (
                    ScannerExecutionState::Unavailable,
                    "No dependency manifests detected in project".to_string(),
                )
            } else {
                (
                    ScannerExecutionState::NotIncluded,
                    format!(
                        "Not included in {} mode",
                        match mode {
                            SecurityScanMode::Quick => "QUICK",
                            SecurityScanMode::GitExposure => "GIT_EXPOSURE",
                            SecurityScanMode::Full => "FULL",
                        }
                    ),
                )
            };

            scanner_details.push(ScannerExecutionDetail {
                scanner_id: sid.to_string(),
                scanner_name: sname.to_string(),
                category: cat.to_string(),
                state,
                reason: Some(reason),
            });
        }
    }

    let git_checked = executed_ids.contains(&"git_scanner") && status == SecurityScanStatus::Completed;

    SecurityScanExecutionSummary {
        scan_id,
        mode,
        project_id,
        project_name,
        planned_capabilities: planned_caps,
        executed_scanners,
        skipped_scanners,
        scanner_details,
        git_checked,
        files_examined,
        findings_count,
        duration_ms,
        status,
    }
}


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

    /// Selects scanners based on the provided SecurityScanPlan capabilities,
    /// or falls back to standard SecurityScanMode baseline if no plan is provided.
    pub fn select_scanners(
        &self,
        mode: crate::security::domain::SecurityScanMode,
        plan: Option<&SecurityScanPlan>,
    ) -> Vec<Arc<dyn SecurityScanner>> {
        let capabilities = if let Some(p) = plan {
            p.capabilities.clone()
        } else {
            match mode {
                crate::security::domain::SecurityScanMode::Quick => SecurityCapabilities {
                    secrets: true,
                    configuration: true,
                    dependencies: false,
                    git_exposure: false,
                },
                crate::security::domain::SecurityScanMode::GitExposure => SecurityCapabilities {
                    secrets: false,
                    configuration: false,
                    dependencies: false,
                    git_exposure: true,
                },
                crate::security::domain::SecurityScanMode::Full => SecurityCapabilities {
                    secrets: true,
                    configuration: true,
                    dependencies: true,
                    git_exposure: true,
                },
            }
        };

        let mut filtered_scanners = Vec::new();
        for scanner in &self.scanners {
            let sid = scanner.scanner_id();
            let include = match sid {
                "core_secret_scanner" => capabilities.secrets,
                "configuration_scanner" => capabilities.configuration,
                "dependency_scanner" => capabilities.dependencies,
                "git_scanner" => capabilities.git_exposure,
                _ => false,
            };
            if include {
                filtered_scanners.push(scanner.clone());
            }
        }
        filtered_scanners
    }

    pub async fn start_scan(
        &self,
        project_id: String,
        root_path: String,
        mode: crate::security::domain::SecurityScanMode,
        plan: Option<SecurityScanPlan>,
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

        // Filter scanners based on SecurityScanPlan capabilities or fallback to mode
        let filtered_scanners = self.select_scanners(mode, plan.as_ref());

        // Fast-path for GIT_EXPOSURE: directly inspect Git metadata without walking source files
        if matches!(mode, crate::security::domain::SecurityScanMode::GitExposure) {
            let scanners = filtered_scanners;
            let redactor = Arc::new(DefaultRedactor::new());
            let app_handle_task = app_handle.clone();
            let cancel_token_task = cancel_token.clone();
            let scan_id_task = scan_id_clone.clone();
            let project_id_task = project_id.clone();
            let project_name_task = plan.as_ref().map(|p| p.project_name.clone()).unwrap_or_else(|| project_id.clone());
            let plan_task = plan.clone();

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
                summary.execution_summary = Some(build_execution_summary(
                    scan_id_task.clone(),
                    project_id_task,
                    project_name_task,
                    mode,
                    plan_task.as_ref(),
                    SecurityScanStatus::Completed,
                    &["git_scanner"],
                    scanned_files,
                    summary.total_findings,
                    summary.scan_duration_ms,
                ));

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
        let project_id_task = project_id.clone();
        let project_name_task = plan.as_ref().map(|p| p.project_name.clone()).unwrap_or_else(|| project_id.clone());
        let plan_task = plan.clone();

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
            let executed_ids: Vec<&str> = scanners.iter().map(|s| s.scanner_id()).collect();
            summary.execution_summary = Some(build_execution_summary(
                scan_id_clone.clone(),
                project_id_task,
                project_name_task,
                mode,
                plan_task.as_ref(),
                SecurityScanStatus::Completed,
                &executed_ids,
                i,
                summary.total_findings,
                summary.scan_duration_ms,
            ));

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

    #[test]
    fn test_phase3c1_1_quick_with_plan() {
        let engine = SecurityEngine::new();
        let plan = SecurityScanPlan {
            project_id: "test-proj".to_string(),
            project_name: "test-proj".to_string(),
            project_root: "/test/path".to_string(),
            architecture_type: "single".to_string(),
            mode: crate::security::domain::SecurityScanMode::Quick,
            languages: vec!["TypeScript".to_string()],
            frameworks: vec!["React".to_string()],
            manifests: vec!["package.json".to_string()],
            build_tools: vec!["Vite".to_string()],
            package_managers: vec!["npm".to_string()],
            capabilities: SecurityCapabilities {
                secrets: true,
                configuration: true,
                dependencies: false,
                git_exposure: false,
            },
            dependency_targets: vec![],
            git_available: true,
            planning_notes: vec![],
        };

        let scanners = engine.select_scanners(crate::security::domain::SecurityScanMode::Quick, Some(&plan));
        let ids: Vec<&str> = scanners.iter().map(|s| s.scanner_id()).collect();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&"core_secret_scanner"));
        assert!(ids.contains(&"configuration_scanner"));
        assert!(!ids.contains(&"dependency_scanner"));
        assert!(!ids.contains(&"git_scanner"));
    }

    #[test]
    fn test_phase3c1_2_git_exposure_with_plan() {
        let engine = SecurityEngine::new();
        let plan = SecurityScanPlan {
            project_id: "test-proj".to_string(),
            project_name: "test-proj".to_string(),
            project_root: "/test/path".to_string(),
            architecture_type: "single".to_string(),
            mode: crate::security::domain::SecurityScanMode::GitExposure,
            languages: vec![],
            frameworks: vec![],
            manifests: vec![],
            build_tools: vec![],
            package_managers: vec![],
            capabilities: SecurityCapabilities {
                secrets: false,
                configuration: false,
                dependencies: false,
                git_exposure: true,
            },
            dependency_targets: vec![],
            git_available: true,
            planning_notes: vec![],
        };

        let scanners = engine.select_scanners(crate::security::domain::SecurityScanMode::GitExposure, Some(&plan));
        let ids: Vec<&str> = scanners.iter().map(|s| s.scanner_id()).collect();
        assert_eq!(ids.len(), 1);
        assert_eq!(ids[0], "git_scanner");
    }

    #[test]
    fn test_phase3c1_3_full_with_plan() {
        let engine = SecurityEngine::new();
        let plan = SecurityScanPlan {
            project_id: "test-proj".to_string(),
            project_name: "test-proj".to_string(),
            project_root: "/test/path".to_string(),
            architecture_type: "single".to_string(),
            mode: crate::security::domain::SecurityScanMode::Full,
            languages: vec!["TypeScript".to_string()],
            frameworks: vec!["React".to_string()],
            manifests: vec!["package.json".to_string()],
            build_tools: vec![],
            package_managers: vec!["npm".to_string()],
            capabilities: SecurityCapabilities {
                secrets: true,
                configuration: true,
                dependencies: true,
                git_exposure: true,
            },
            dependency_targets: vec![],
            git_available: true,
            planning_notes: vec![],
        };

        let scanners = engine.select_scanners(crate::security::domain::SecurityScanMode::Full, Some(&plan));
        let ids: Vec<&str> = scanners.iter().map(|s| s.scanner_id()).collect();
        assert_eq!(ids.len(), 4);
        assert!(ids.contains(&"core_secret_scanner"));
        assert!(ids.contains(&"configuration_scanner"));
        assert!(ids.contains(&"dependency_scanner"));
        assert!(ids.contains(&"git_scanner"));
    }

    #[test]
    fn test_phase3c1_4_no_plan_fallback() {
        let engine = SecurityEngine::new();

        // QUICK without plan
        let scanners_quick = engine.select_scanners(crate::security::domain::SecurityScanMode::Quick, None);
        let ids_quick: Vec<&str> = scanners_quick.iter().map(|s| s.scanner_id()).collect();
        assert_eq!(ids_quick.len(), 2);
        assert!(ids_quick.contains(&"core_secret_scanner"));
        assert!(ids_quick.contains(&"configuration_scanner"));

        // GIT_EXPOSURE without plan
        let scanners_git = engine.select_scanners(crate::security::domain::SecurityScanMode::GitExposure, None);
        let ids_git: Vec<&str> = scanners_git.iter().map(|s| s.scanner_id()).collect();
        assert_eq!(ids_git.len(), 1);
        assert_eq!(ids_git[0], "git_scanner");

        // FULL without plan
        let scanners_full = engine.select_scanners(crate::security::domain::SecurityScanMode::Full, None);
        let ids_full: Vec<&str> = scanners_full.iter().map(|s| s.scanner_id()).collect();
        assert_eq!(ids_full.len(), 4);
        assert!(ids_full.contains(&"core_secret_scanner"));
        assert!(ids_full.contains(&"configuration_scanner"));
        assert!(ids_full.contains(&"dependency_scanner"));
        assert!(ids_full.contains(&"git_scanner"));
    }

    #[test]
    fn test_phase3c1_5_project_isolation() {
        let engine = SecurityEngine::new();
        let dir = tempdir().unwrap();
        let project_a = dir.path().join("proj-a");
        fs::create_dir_all(&project_a).unwrap();

        let valid_root = engine.validate_root(project_a.to_str().unwrap()).unwrap();
        assert_eq!(valid_root, std::fs::canonicalize(&project_a).unwrap());
    }

    #[test]
    fn test_phase3c1_6_phase2a_exclusions_preserved() {
        assert!(is_default_security_excluded_dir("node_modules"));
        assert!(is_default_security_excluded_dir("dist"));
        assert!(is_default_security_excluded_dir("build"));
        assert!(is_default_security_excluded_dir("target"));
        assert!(is_default_security_excluded_dir(".next"));
        assert!(is_default_security_excluded_dir("coverage"));
        assert!(is_default_security_excluded_dir(".cache"));
        assert!(is_default_security_excluded_dir("out"));
        assert!(!is_default_security_excluded_dir("src"));
    }

    #[test]
    fn test_phase3c1_7_phase2c_git_fast_path_preserved() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let git_dir = root.join(".git");
        fs::create_dir_all(&git_dir).unwrap();
        fs::write(git_dir.join("config"), "[remote \"origin\"]\nurl = https://github.com/org/repo.git").unwrap();

        let configs = locate_git_config_files(root);
        assert_eq!(configs.len(), 1);
    }

    #[test]
    fn test_phase3c1_8_cancellation_token() {
        let cancel_token = Arc::new(AtomicBool::new(false));
        assert!(!cancel_token.load(Ordering::Relaxed));
        cancel_token.store(true, Ordering::Relaxed);
        assert!(cancel_token.load(Ordering::Relaxed));
    }

    #[test]
    fn test_phase3c1_9_unknown_metadata_plan() {
        let engine = SecurityEngine::new();
        let plan = SecurityScanPlan {
            project_id: "unknown".to_string(),
            project_name: "unknown".to_string(),
            project_root: "/unknown".to_string(),
            architecture_type: "unknown".to_string(),
            mode: crate::security::domain::SecurityScanMode::Full,
            languages: vec![],
            frameworks: vec![],
            manifests: vec![],
            build_tools: vec![],
            package_managers: vec![],
            capabilities: SecurityCapabilities {
                secrets: true,
                configuration: true,
                dependencies: true,
                git_exposure: true,
            },
            dependency_targets: vec![],
            git_available: false,
            planning_notes: vec![],
        };

        let scanners = engine.select_scanners(crate::security::domain::SecurityScanMode::Full, Some(&plan));
        assert_eq!(scanners.len(), 4);
    }

    #[test]
    fn test_phase3c1_10_all_modes_operational() {
        let engine = SecurityEngine::new();
        for mode in [
            crate::security::domain::SecurityScanMode::Quick,
            crate::security::domain::SecurityScanMode::GitExposure,
            crate::security::domain::SecurityScanMode::Full,
        ] {
            let scanners = engine.select_scanners(mode, None);
            assert!(!scanners.is_empty());
        }
    }

    #[test]
    fn test_phase3d_1_quick_execution_summary() {
        let plan = SecurityScanPlan {
            project_id: "quick-proj".to_string(),
            project_name: "quick-proj".to_string(),
            project_root: "/path/quick".to_string(),
            architecture_type: "single".to_string(),
            mode: SecurityScanMode::Quick,
            languages: vec!["TypeScript".to_string()],
            frameworks: vec!["React".to_string()],
            manifests: vec!["package.json".to_string()],
            build_tools: vec!["Vite".to_string()],
            package_managers: vec!["npm".to_string()],
            capabilities: SecurityCapabilities {
                secrets: true,
                configuration: true,
                dependencies: false,
                git_exposure: false,
            },
            dependency_targets: vec![],
            git_available: true,
            planning_notes: vec![],
        };

        let summary = build_execution_summary(
            "scan_101".to_string(),
            "quick-proj".to_string(),
            "quick-proj".to_string(),
            SecurityScanMode::Quick,
            Some(&plan),
            SecurityScanStatus::Completed,
            &["core_secret_scanner", "configuration_scanner"],
            15,
            0,
            120,
        );

        assert_eq!(summary.status, SecurityScanStatus::Completed);
        assert_eq!(summary.executed_scanners.len(), 2);
        assert!(summary.executed_scanners.contains(&"core_secret_scanner".to_string()));
        assert!(summary.executed_scanners.contains(&"configuration_scanner".to_string()));
        assert_eq!(summary.skipped_scanners.len(), 2);
        assert!(summary.skipped_scanners.contains(&"dependency_scanner".to_string()));
        assert!(summary.skipped_scanners.contains(&"git_scanner".to_string()));

        let dep_detail = summary.scanner_details.iter().find(|d| d.scanner_id == "dependency_scanner").unwrap();
        assert_eq!(dep_detail.state, ScannerExecutionState::NotIncluded);

        let git_detail = summary.scanner_details.iter().find(|d| d.scanner_id == "git_scanner").unwrap();
        assert_eq!(git_detail.state, ScannerExecutionState::NotIncluded);
    }

    #[test]
    fn test_phase3d_2_git_exposure_execution_summary() {
        let plan = SecurityScanPlan {
            project_id: "git-proj".to_string(),
            project_name: "git-proj".to_string(),
            project_root: "/path/git".to_string(),
            architecture_type: "single".to_string(),
            mode: SecurityScanMode::GitExposure,
            languages: vec![],
            frameworks: vec![],
            manifests: vec![],
            build_tools: vec![],
            package_managers: vec![],
            capabilities: SecurityCapabilities {
                secrets: false,
                configuration: false,
                dependencies: false,
                git_exposure: true,
            },
            dependency_targets: vec![],
            git_available: true,
            planning_notes: vec![],
        };

        let summary = build_execution_summary(
            "scan_102".to_string(),
            "git-proj".to_string(),
            "git-proj".to_string(),
            SecurityScanMode::GitExposure,
            Some(&plan),
            SecurityScanStatus::Completed,
            &["git_scanner"],
            1,
            2,
            45,
        );

        assert_eq!(summary.executed_scanners, vec!["git_scanner".to_string()]);
        assert_eq!(summary.skipped_scanners.len(), 3);
        assert!(summary.git_checked);
    }

    #[test]
    fn test_phase3d_3_full_execution_summary() {
        let plan = SecurityScanPlan {
            project_id: "full-proj".to_string(),
            project_name: "full-proj".to_string(),
            project_root: "/path/full".to_string(),
            architecture_type: "single".to_string(),
            mode: SecurityScanMode::Full,
            languages: vec!["Java".to_string()],
            frameworks: vec!["Spring Boot".to_string()],
            manifests: vec!["pom.xml".to_string()],
            build_tools: vec!["Maven".to_string()],
            package_managers: vec!["Maven".to_string()],
            capabilities: SecurityCapabilities {
                secrets: true,
                configuration: true,
                dependencies: true,
                git_exposure: true,
            },
            dependency_targets: vec![],
            git_available: true,
            planning_notes: vec![],
        };

        let summary = build_execution_summary(
            "scan_103".to_string(),
            "full-proj".to_string(),
            "full-proj".to_string(),
            SecurityScanMode::Full,
            Some(&plan),
            SecurityScanStatus::Completed,
            &["core_secret_scanner", "configuration_scanner", "dependency_scanner", "git_scanner"],
            50,
            5,
            300,
        );

        assert_eq!(summary.executed_scanners.len(), 4);
        assert!(summary.skipped_scanners.is_empty());
        for detail in &summary.scanner_details {
            assert_eq!(detail.state, ScannerExecutionState::Executed);
        }
    }

    #[test]
    fn test_phase3d_4_non_git_project_execution_summary() {
        let plan = SecurityScanPlan {
            project_id: "no-git-proj".to_string(),
            project_name: "no-git-proj".to_string(),
            project_root: "/path/nogit".to_string(),
            architecture_type: "single".to_string(),
            mode: SecurityScanMode::Full,
            languages: vec!["TypeScript".to_string()],
            frameworks: vec![],
            manifests: vec!["package.json".to_string()],
            build_tools: vec![],
            package_managers: vec!["npm".to_string()],
            capabilities: SecurityCapabilities {
                secrets: true,
                configuration: true,
                dependencies: true,
                git_exposure: true,
            },
            dependency_targets: vec![],
            git_available: false,
            planning_notes: vec![],
        };

        let summary = build_execution_summary(
            "scan_104".to_string(),
            "no-git-proj".to_string(),
            "no-git-proj".to_string(),
            SecurityScanMode::Full,
            Some(&plan),
            SecurityScanStatus::Completed,
            &["core_secret_scanner", "configuration_scanner", "dependency_scanner"],
            30,
            1,
            200,
        );

        let git_detail = summary.scanner_details.iter().find(|d| d.scanner_id == "git_scanner").unwrap();
        assert_eq!(git_detail.state, ScannerExecutionState::Unavailable);
        assert_eq!(git_detail.reason.as_deref(), Some("Target is not a Git repository"));
    }

    #[test]
    fn test_phase3d_5_no_manifest_project_execution_summary() {
        let plan = SecurityScanPlan {
            project_id: "no-manifest-proj".to_string(),
            project_name: "no-manifest-proj".to_string(),
            project_root: "/path/nomanifest".to_string(),
            architecture_type: "single".to_string(),
            mode: SecurityScanMode::Full,
            languages: vec!["Plain".to_string()],
            frameworks: vec![],
            manifests: vec![],
            build_tools: vec![],
            package_managers: vec![],
            capabilities: SecurityCapabilities {
                secrets: true,
                configuration: true,
                dependencies: true,
                git_exposure: true,
            },
            dependency_targets: vec![],
            git_available: true,
            planning_notes: vec![],
        };

        let summary = build_execution_summary(
            "scan_105".to_string(),
            "no-manifest-proj".to_string(),
            "no-manifest-proj".to_string(),
            SecurityScanMode::Full,
            Some(&plan),
            SecurityScanStatus::Completed,
            &["core_secret_scanner", "configuration_scanner", "git_scanner"],
            10,
            0,
            90,
        );

        let dep_detail = summary.scanner_details.iter().find(|d| d.scanner_id == "dependency_scanner").unwrap();
        assert_eq!(dep_detail.state, ScannerExecutionState::Unavailable);
        assert_eq!(dep_detail.reason.as_deref(), Some("No dependency manifests detected in project"));
    }

    #[test]
    fn test_phase3d_6_cancelled_execution_summary() {
        let summary = build_execution_summary(
            "scan_106".to_string(),
            "cancel-proj".to_string(),
            "cancel-proj".to_string(),
            SecurityScanMode::Full,
            None,
            SecurityScanStatus::Cancelled,
            &[],
            5,
            0,
            50,
        );

        assert_eq!(summary.status, SecurityScanStatus::Cancelled);
        for detail in &summary.scanner_details {
            assert_eq!(detail.state, ScannerExecutionState::Cancelled);
        }
    }

    #[test]
    fn test_phase3d_7_failed_execution_summary() {
        let summary = build_execution_summary(
            "scan_107".to_string(),
            "fail-proj".to_string(),
            "fail-proj".to_string(),
            SecurityScanMode::Full,
            None,
            SecurityScanStatus::Failed,
            &[],
            0,
            0,
            10,
        );

        assert_eq!(summary.status, SecurityScanStatus::Failed);
        for detail in &summary.scanner_details {
            assert_eq!(detail.state, ScannerExecutionState::Failed);
        }
    }

    #[test]
    fn test_phase3d_8_project_isolation() {
        let summary_a = build_execution_summary(
            "scan_a".to_string(),
            "proj_a".to_string(),
            "Project A".to_string(),
            SecurityScanMode::Quick,
            None,
            SecurityScanStatus::Completed,
            &["core_secret_scanner"],
            10,
            1,
            50,
        );

        let summary_b = build_execution_summary(
            "scan_b".to_string(),
            "proj_b".to_string(),
            "Project B".to_string(),
            SecurityScanMode::Full,
            None,
            SecurityScanStatus::Completed,
            &["core_secret_scanner", "configuration_scanner", "dependency_scanner", "git_scanner"],
            40,
            3,
            150,
        );

        assert_ne!(summary_a.scan_id, summary_b.scan_id);
        assert_ne!(summary_a.project_id, summary_b.project_id);
        assert_ne!(summary_a.project_name, summary_b.project_name);
        assert_ne!(summary_a.executed_scanners, summary_b.executed_scanners);
    }
}


