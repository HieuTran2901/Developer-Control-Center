use crate::monitor::antigravity_discovery::AntigravityRuntime;
use crate::monitor::antigravity_quota::{
    AntigravityQuotaClient, AntigravityQuotaError, AntigravityQuotaSnapshot,
    AntigravityRuntimeState,
};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use uuid::Uuid;

pub struct HeadlessWorkerInstance {
    pub account_id: String,
    pub process_id: u32,
    pub rpc_port: u16,
    pub csrf_token: String,
    pub profile_dir: PathBuf,
    pub last_used_at: Instant,
    pub child: Option<Child>,
}

#[derive(Clone)]
pub struct HeadlessAntigravityManager {
    binary_path: Option<PathBuf>,
    active_workers: Arc<Mutex<HashMap<String, HeadlessWorkerInstance>>>,
    quota_client: Arc<AntigravityQuotaClient>,
}

impl HeadlessAntigravityManager {
    pub fn new() -> Self {
        let binary_path = Self::find_language_server_binary();
        Self {
            binary_path,
            active_workers: Arc::new(Mutex::new(HashMap::new())),
            quota_client: Arc::new(AntigravityQuotaClient::new()),
        }
    }

    /// Locate the language_server.exe binary on Windows
    pub fn find_language_server_binary() -> Option<PathBuf> {
        let local_app_data = std::env::var("LOCALAPPDATA").ok().map(PathBuf::from);
        let user_profile = std::env::var("USERPROFILE").ok().map(PathBuf::from);

        let candidates = vec![
            // Standard Antigravity installation on Windows
            local_app_data.as_ref().map(|p| p.join("Programs").join("antigravity").join("resources").join("bin").join("language_server.exe")),
            user_profile.as_ref().map(|p| p.join("AppData").join("Local").join("Programs").join("antigravity").join("resources").join("bin").join("language_server.exe")),
            user_profile.as_ref().map(|p| p.join(".gemini").join("antigravity").join("bin").join("language_server.exe")),
        ];

        for candidate in candidates.into_iter().flatten() {
            if candidate.exists() && candidate.is_file() {
                return Some(candidate);
            }
        }

        None
    }

    /// Get default or isolated profile directory for an account
    pub fn get_profile_dir_for_account(account_id: &str) -> PathBuf {
        let home = std::env::var("USERPROFILE")
            .ok()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."));
        if account_id == "default" {
            home.join(".gemini")
        } else {
            home.join(".gemini").join("profiles").join(account_id)
        }
    }

    /// Snapshot the currently active Antigravity session into an account's isolated profile
    pub fn snapshot_active_session_to_account(account_id: &str) {
        if account_id == "default" {
            return;
        }

        let home = std::env::var("USERPROFILE")
            .ok()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."));

        let src_dir = home.join(".gemini").join("antigravity");
        let dest_dir = home.join(".gemini").join("profiles").join(account_id).join("antigravity");

        if src_dir.exists() {
            let _ = std::fs::create_dir_all(&dest_dir);
            let files_to_copy = ["antigravity_state.pbtxt", "installation_id", "agyhub_summaries_proto.pb"];
            for f in &files_to_copy {
                let src = src_dir.join(f);
                let dest = dest_dir.join(f);
                if src.exists() {
                    let _ = std::fs::copy(&src, &dest);
                }
            }

            // Also snapshot the active Windows Credential Manager token for this account.
            // This ensures the headless worker can load the correct token even after the user
            // switches to a different account in Antigravity IDE.
            Self::snapshot_credential_for_account(account_id);
        }
    }

    /// Read the active `gemini:antigravity` token from Windows Credential Manager and store it
    /// as a per-account DCC credential so the headless worker can use it later.
    pub fn snapshot_credential_for_account(account_id: &str) {
        // Write a marker file in the account profile so the headless worker knows to use
        // the active IDE session (gemini:antigravity) credential for this account.
        let script = format!(
            r##"try {{
    $profileDir = "$env:USERPROFILE\.gemini\profiles\{account}"
    if (-not (Test-Path $profileDir)) {{ New-Item -ItemType Directory -Path $profileDir -Force | Out-Null }}
    $markerFile = "$profileDir\.active_session_snapshot"
    [datetime]::UtcNow.ToString('o') | Set-Content -Path $markerFile -Encoding UTF8
}} catch {{ }}"##,
            account = account_id,
        );
        let _ = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", &script])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();
    }

    /// Fetch quota for a specific account profile using a headless language server worker
    pub async fn fetch_quota_for_account(
        &self,
        account_id: &str,
    ) -> Result<AntigravityQuotaSnapshot, AntigravityQuotaError> {
        let profile_dir = Self::get_profile_dir_for_account(account_id);
        self.fetch_quota_for_profile_dir(account_id, &profile_dir).await
    }

    /// Execute on-demand or reuse existing headless worker to fetch quota
    pub async fn fetch_quota_for_profile_dir(
        &self,
        account_id: &str,
        profile_dir: &Path,
    ) -> Result<AntigravityQuotaSnapshot, AntigravityQuotaError> {
        let binary = match &self.binary_path {
            Some(b) => b.clone(),
            None => {
                return Err(AntigravityQuotaError {
                    state: AntigravityRuntimeState::LanguageServerNotFound,
                    message: "language_server.exe binary not found on this system.".to_string(),
                });
            }
        };

        // If the profile directory doesn't have an initialized state file, fail fast without waiting
        let state_file = profile_dir.join("antigravity").join("antigravity_state.pbtxt");
        if account_id != "default" && !state_file.exists() {
            return Err(AntigravityQuotaError {
                state: AntigravityRuntimeState::AntigravityNotRunning,
                message: "No saved session found for this account. Please log in to this account in Antigravity once to initialize its profile.".to_string(),
            });
        }

        // Check if we already have an active healthy worker for this account
        let mut workers = self.active_workers.lock().await;
        if let Some(worker) = workers.get_mut(account_id) {
            let runtime = AntigravityRuntime {
                process_id: worker.process_id,
                parent_process_id: None,
                executable_path: binary.to_string_lossy().to_string(),
                command_line: String::new(),
                rpc_host: "127.0.0.1".to_string(),
                rpc_port: worker.rpc_port,
                csrf_token: worker.csrf_token.clone(),
            };

            worker.last_used_at = Instant::now();

            if let Ok(snapshot) = self.quota_client.fetch_quota_from_runtime(&runtime).await {
                return Ok(snapshot);
            }

            // If query failed, worker might have crashed, drop it and respawn
            if let Some(mut ch) = worker.child.take() {
                let _ = ch.kill();
            }
            workers.remove(account_id);
        }

        // Spawn a fresh headless worker
        let csrf_token = Uuid::new_v4().to_string();
        let app_data_dir = "antigravity";
        
        if !profile_dir.exists() {
            let _ = std::fs::create_dir_all(profile_dir);
        }

        let mut cmd = Command::new(&binary);
        cmd.arg("--standalone")
            .arg("--override_ide_name")
            .arg("antigravity")
            .arg("--subclient_type")
            .arg("hub")
            .arg("--override_ide_version")
            .arg("2.8.1")
            .arg("--override_user_agent_name")
            .arg("antigravity")
            .arg("--https_server_port")
            .arg("0")
            .arg("--csrf_token")
            .arg(&csrf_token)
            .arg("--app_data_dir")
            .arg(app_data_dir)
            .arg("--api_server_url")
            .arg("https://generativelanguage.googleapis.com")
            .arg("--cloud_code_endpoint")
            .arg("https://daily-cloudcode-pa.googleapis.com")
            .arg("--gemini_dir")
            .arg(profile_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());

        let mut child = cmd.spawn().map_err(|e| AntigravityQuotaError {
            state: AntigravityRuntimeState::RpcConnectionFailed,
            message: format!("Failed to spawn headless language server: {}", e),
        })?;

        let pid = child.id();

        // Discover listening ports assigned to this PID
        let candidate_ports = match Self::poll_ports_for_pid(pid, Duration::from_secs(3)).await {
            Some(ports) => ports,
            None => {
                let _ = child.kill();
                return Err(AntigravityQuotaError {
                    state: AntigravityRuntimeState::RpcPortNotFound,
                    message: format!("Headless language server (PID {}) did not bind to a listening port.", pid),
                });
            }
        };

        // Try candidate ports to find the active Connect-RPC HTTPS port
        for port in candidate_ports {
            let runtime = AntigravityRuntime {
                process_id: pid,
                parent_process_id: None,
                executable_path: binary.to_string_lossy().to_string(),
                command_line: String::new(),
                rpc_host: "127.0.0.1".to_string(),
                rpc_port: port,
                csrf_token: csrf_token.clone(),
            };

            if let Ok(snapshot) = self.quota_client.fetch_quota_from_runtime(&runtime).await {
                let instance = HeadlessWorkerInstance {
                    account_id: account_id.to_string(),
                    process_id: pid,
                    rpc_port: port,
                    csrf_token: csrf_token.clone(),
                    profile_dir: profile_dir.to_path_buf(),
                    last_used_at: Instant::now(),
                    child: Some(child),
                };
                workers.insert(account_id.to_string(), instance);
                return Ok(snapshot);
            }
        }

        let _ = child.kill();
        Err(AntigravityQuotaError {
            state: AntigravityRuntimeState::RpcConnectionFailed,
            message: "Failed to communicate with headless language server RPC endpoint.".to_string(),
        })
    }

    /// Poll listening TCP ports on Windows to find which ports were assigned to the PID
    async fn poll_ports_for_pid(pid: u32, timeout: Duration) -> Option<Vec<u16>> {
        let start = Instant::now();
        while start.elapsed() < timeout {
            if let Ok(ports) = crate::monitor::antigravity_discovery::AntigravityDiscovery::find_listening_ports_for_pid(pid) {
                if !ports.is_empty() {
                    return Some(ports);
                }
            }
            tokio::time::sleep(Duration::from_millis(150)).await;
        }
        None
    }

    /// Gracefully terminate all active headless workers
    pub async fn shutdown_all(&self) {
        let mut workers = self.active_workers.lock().await;
        for (_, mut worker) in workers.drain() {
            if let Some(mut ch) = worker.child.take() {
                let _ = ch.kill();
            }
        }
    }
}
