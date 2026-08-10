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
use std::collections::HashSet;

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
        
        let is_quick_mode = matches!(mode, crate::security::domain::SecurityScanMode::Quick);
        let scanners = filtered_scanners;
        let redactor = Arc::new(DefaultRedactor::new());

        let app_handle_task = app_handle.clone();
        let handle = tauri::async_runtime::spawn(async move {
            let start_time = std::time::Instant::now();
            let mut summary = SecurityScanSummary::default();
            let mut chunk = Vec::new();
            let chunk_size = 50;

            let mut walk = ignore::Walk::new(&canonical_root);
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
                                finding.evidence = Some(redacted);
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
