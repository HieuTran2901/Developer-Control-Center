use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter};

use crate::security::domain::{SecurityScanEvent, SecurityScanSummary};
use crate::security::scanner::SecurityScanner;
use crate::security::secret_scanner::CoreSecretScanner;
use crate::security::dependency_scanner::scanner::DependencyScanner;
use crate::security::dependency_scanner::osv::OsvProvider;
use crate::security::redactor::{SecurityRedactor, DefaultRedactor};
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

    /// Recursively walks the directory without scanning node_modules, target, etc.
    /// In phase 1, we just return a simple list of paths or use `ignore::WalkDir` if available.
    /// Since we can't add dependencies, we implement a simple bounding walker for MVP.
    fn get_files_in_bounds(
        root: &Path,
        canonical_root: &Path,
        cancel_token: &AtomicBool,
    ) -> Result<Vec<PathBuf>, String> {
        let mut files = Vec::new();
        let mut stack = vec![root.to_path_buf()];

        while let Some(current) = stack.pop() {
            if cancel_token.load(Ordering::Relaxed) {
                return Err("Scan cancelled".to_string());
            }

            let entries = match std::fs::read_dir(&current) {
                Ok(e) => e,
                Err(_) => continue,
            };

            for entry in entries.filter_map(Result::ok) {
                let path = entry.path();
                let file_name = path.file_name().unwrap_or_default().to_string_lossy();

                // Simple default ignore for Phase 1
                if file_name == "node_modules" || file_name == "target" || file_name == ".git" || file_name == "dist" {
                    continue;
                }

                // Canonicalize to prevent traversal/symlink escape
                let canonical_path = match std::fs::canonicalize(&path) {
                    Ok(p) => p,
                    Err(_) => continue,
                };

                if !canonical_path.starts_with(canonical_root) {
                    // Path Traversal or Symlink Escape detected!
                    continue;
                }

                if canonical_path.is_dir() {
                    stack.push(canonical_path);
                } else if canonical_path.is_file() {
                    files.push(canonical_path);
                }
            }
        }

        Ok(files)
    }

    pub async fn start_scan(
        &self,
        project_id: String,
        root_path: String,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        let scan_id = format!("scan_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
        let cancel_token = Arc::new(AtomicBool::new(false));

        {
            let mut active = self.active_scans.lock().await;
            active.insert(scan_id.clone(), cancel_token.clone());
        }

        let canonical_root = self.validate_root(&root_path)?;

        let scan_id_clone = scan_id.clone();
        
        let _ = app_handle.emit("security_event", SecurityScanEvent::Started {
            project_id: project_id.clone(),
            scan_id: scan_id.clone(),
        });

        // We clone scanners manually since Box<dyn SecurityScanner> can't be easily cloned if it's not cloneable.
        // Actually, we can just use an Arc around the scanners, but in this case, we have them owned.
        // Wait, the spawned task needs access to scanners, but we can't easily move them.
        // For Phase 2, we will instantiate a new scanner in the task, or we should wrap them in Arc.
        // Let's just create a new scanner for the task to avoid lifetime issues for now.
        // Real implementation would have scanners wrapped in Arc.
        let scanners = self.scanners.clone();
        let redactor = Arc::new(DefaultRedactor::new());
        
        tauri::async_runtime::spawn(async move {
            let start_time = std::time::Instant::now();
            let mut summary = SecurityScanSummary::default();
            let mut chunk = Vec::new();
            let chunk_size = 50;

            let files = match Self::get_files_in_bounds(&canonical_root, &canonical_root, &cancel_token) {
                Ok(f) => f,
                Err(e) if e == "Scan cancelled" => {
                    let _ = app_handle.emit("security_event", SecurityScanEvent::Cancelled { scan_id: scan_id_clone });
                    return;
                },
                Err(e) => {
                    let _ = app_handle.emit("security_event", SecurityScanEvent::Failed { scan_id: scan_id_clone, reason: e });
                    return;
                }
            };

            for (i, path) in files.iter().enumerate() {
                if cancel_token.load(Ordering::Relaxed) {
                    let _ = app_handle.emit("security_event", SecurityScanEvent::Cancelled { scan_id: scan_id_clone });
                    return;
                }

                // Emit progress every 10 files
                if i % 10 == 0 {
                    let _ = app_handle.emit("security_event", SecurityScanEvent::Progress {
                        scan_id: scan_id_clone.clone(),
                        scanned_files: i,
                        current_scanner: "MultiplexedScanners".to_string(),
                    });
                }

                for scanner in &scanners {
                    if cancel_token.load(Ordering::Relaxed) {
                        let _ = app_handle.emit("security_event", SecurityScanEvent::Cancelled { scan_id: scan_id_clone });
                        return;
                    }

                    let mut findings = match scanner.scan(path, cancel_token.clone()).await {
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
                            crate::security::domain::SecuritySeverity::Critical => summary.critical += 1,
                            crate::security::domain::SecuritySeverity::High => summary.high += 1,
                            crate::security::domain::SecuritySeverity::Medium => summary.medium += 1,
                            crate::security::domain::SecuritySeverity::Low => summary.low += 1,
                            crate::security::domain::SecuritySeverity::Info => summary.info += 1,
                        }
                        summary.total_findings += 1;
                        
                        chunk.push(finding);
                        
                        if chunk.len() >= chunk_size {
                            let _ = app_handle.emit("security_event", SecurityScanEvent::FindingsChunk {
                                scan_id: scan_id_clone.clone(),
                                findings: std::mem::take(&mut chunk),
                            });
                        }
                    }
                }
            }

            // Flush remaining chunk
            if !chunk.is_empty() {
                let _ = app_handle.emit("security_event", SecurityScanEvent::FindingsChunk {
                    scan_id: scan_id_clone.clone(),
                    findings: chunk,
                });
            }

            if cancel_token.load(Ordering::Relaxed) {
                let _ = app_handle.emit("security_event", SecurityScanEvent::Cancelled { scan_id: scan_id_clone });
                return;
            }

            summary.scan_duration_ms = start_time.elapsed().as_millis() as u64;

            let _ = app_handle.emit("security_event", SecurityScanEvent::Completed {
                scan_id: scan_id_clone,
                summary,
            });
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
