use regex::Regex;
use serde::{Deserialize, Serialize};
use std::process::Command;
use sysinfo::System;


#[derive(Debug, Clone)]
pub struct AntigravityRuntime {
    pub process_id: u32,
    pub parent_process_id: Option<u32>,
    pub executable_path: String,
    pub command_line: String,
    pub rpc_host: String,
    pub rpc_port: u16,
    pub csrf_token: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DiscoveryErrorKind {
    AntigravityNotRunning,
    LanguageServerNotFound,
    CsrfTokenNotFound,
    RpcPortNotFound,
    CommandExecutionFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryError {
    pub kind: DiscoveryErrorKind,
    pub message: String,
}

impl std::fmt::Display for DiscoveryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.kind, self.message)
    }
}

impl std::error::Error for DiscoveryError {}

use std::sync::Mutex;
use std::time::{Duration, Instant};

static RUNTIMES_CACHE: Mutex<Option<(Instant, Vec<AntigravityRuntime>)>> = Mutex::new(None);
const RUNTIMES_CACHE_TTL: Duration = Duration::from_secs(4);

pub struct AntigravityDiscovery;

impl AntigravityDiscovery {
    /// Discover all running Antigravity Language Server runtime instances
    pub fn discover_all_runtimes() -> Result<Vec<AntigravityRuntime>, DiscoveryError> {
        if let Ok(guard) = RUNTIMES_CACHE.lock() {
            if let Some((cached_at, ref runtimes)) = *guard {
                if cached_at.elapsed() < RUNTIMES_CACHE_TTL && !runtimes.is_empty() {
                    return Ok(runtimes.clone());
                }
            }
        }

        let mut sys = System::new();
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

        let mut candidate_processes = Vec::new();

        for (pid, process) in sys.processes() {
            let name = process.name().to_string_lossy();
            let exe = process
                .exe()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            if name.eq_ignore_ascii_case("language_server.exe")
                || name.eq_ignore_ascii_case("language_server")
                || (exe.to_lowercase().contains("antigravity")
                    && exe.to_lowercase().contains("language_server"))
            {
                let cmd_parts = process.cmd();
                let full_cmd = if cmd_parts.is_empty() {
                    name.to_string()
                } else {
                    cmd_parts
                        .iter()
                        .map(|s| s.to_string_lossy().to_string())
                        .collect::<Vec<_>>()
                        .join(" ")
                };

                // Validate that this is the Antigravity Language Server
                if full_cmd.contains("antigravity")
                    || full_cmd.contains("csrf_token")
                    || full_cmd.contains("subclient_type")
                {
                    candidate_processes.push((
                        pid.as_u32(),
                        process.parent().map(|p| p.as_u32()),
                        exe,
                        full_cmd,
                    ));
                }
            }
        }

        if candidate_processes.is_empty() {
            let antigravity_running = sys.processes().values().any(|p| {
                let n = p.name().to_string_lossy().to_lowercase();
                n.contains("antigravity")
            });

            if antigravity_running {
                return Err(DiscoveryError {
                    kind: DiscoveryErrorKind::LanguageServerNotFound,
                    message: "Antigravity is running, but language_server.exe was not found.".to_string(),
                });
            } else {
                return Err(DiscoveryError {
                    kind: DiscoveryErrorKind::AntigravityNotRunning,
                    message: "Antigravity is not currently running.".to_string(),
                });
            }
        }

        let mut runtimes = Vec::new();

        for (pid, parent_pid, exe, cmd_line) in candidate_processes {
            if let Some(csrf_token) = Self::extract_csrf_token(&cmd_line) {
                if let Ok(ports) = Self::find_listening_ports_for_pid(pid) {
                    if !ports.is_empty() {
                        let port = ports[0];
                        runtimes.push(AntigravityRuntime {
                            process_id: pid,
                            parent_process_id: parent_pid,
                            executable_path: exe,
                            command_line: cmd_line,
                            rpc_host: "127.0.0.1".to_string(),
                            rpc_port: port,
                            csrf_token,
                        });
                    }
                }
            }
        }

        if runtimes.is_empty() {
            return Err(DiscoveryError {
                kind: DiscoveryErrorKind::RpcPortNotFound,
                message: "No reachable RPC ports found for running Language Server instances.".to_string(),
            });
        }

        // Sort deterministically by PID ASC
        runtimes.sort_by_key(|r| r.process_id);
        if let Ok(mut guard) = RUNTIMES_CACHE.lock() {
            *guard = Some((Instant::now(), runtimes.clone()));
        }
        Ok(runtimes)
    }

    /// Discover primary running Antigravity Language Server runtime metadata
    pub fn discover_runtime() -> Result<AntigravityRuntime, DiscoveryError> {
        let runtimes = Self::discover_all_runtimes()?;
        runtimes
            .into_iter()
            .next()
            .ok_or_else(|| DiscoveryError {
                kind: DiscoveryErrorKind::LanguageServerNotFound,
                message: "No Antigravity Language Server instance found.".to_string(),
            })
    }

    /// Invalidate the runtime discovery cache immediately (e.g. when a cached runtime
    /// fails to respond, indicating Antigravity restarted with new credentials).
    pub fn invalidate_cache() {
        if let Ok(mut guard) = RUNTIMES_CACHE.lock() {
            *guard = None;
        }
    }

    /// Extract the value of `--csrf_token <UUID>` from command line string
    pub fn extract_csrf_token(cmd_line: &str) -> Option<String> {
        let re = Regex::new(r"(?i)--csrf_token(?:=|\s+)([a-zA-Z0-9\-]+)").ok()?;
        let caps = re.captures(cmd_line)?;
        caps.get(1).map(|m| m.as_str().to_string())
    }

    /// Discover listening TCP ports for a given PID
    pub fn find_listening_ports_for_pid(pid: u32) -> Result<Vec<u16>, DiscoveryError> {
        #[cfg(target_os = "windows")]
        {
            Self::find_listening_ports_windows(pid)
        }

        #[cfg(not(target_os = "windows"))]
        {
            Self::find_listening_ports_unix(pid)
        }
    }

    #[cfg(target_os = "windows")]
    fn find_listening_ports_windows(pid: u32) -> Result<Vec<u16>, DiscoveryError> {
        let output = Command::new("netstat")
            .args(["-ano", "-p", "tcp"])
            .output()
            .map_err(|e| DiscoveryError {
                kind: DiscoveryErrorKind::CommandExecutionFailed,
                message: format!("Failed to execute netstat: {}", e),
            })?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        Self::parse_netstat_listening_ports(&stdout, pid)
    }

    /// Parse netstat output to extract listening ports for a specific PID
    pub fn parse_netstat_listening_ports(
        netstat_output: &str,
        target_pid: u32,
    ) -> Result<Vec<u16>, DiscoveryError> {
        let mut ports = Vec::new();
        let target_pid_str = target_pid.to_string();

        for line in netstat_output.lines() {
            let trimmed = line.trim();
            if !trimmed.starts_with("TCP") {
                continue;
            }

            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            // Format: TCP 127.0.0.1:50028 0.0.0.0:0 LISTENING 8360
            if parts.len() >= 5 {
                let local_addr = parts[1];
                let state = parts[3];
                let pid_str = parts[4];

                if state.eq_ignore_ascii_case("LISTENING") && pid_str == target_pid_str {
                    if let Some(colon_idx) = local_addr.rfind(':') {
                        let port_str = &local_addr[colon_idx + 1..];
                        if let Ok(port) = port_str.parse::<u16>() {
                            if !ports.contains(&port) {
                                ports.push(port);
                            }
                        }
                    }
                }
            }
        }

        ports.sort();
        Ok(ports)
    }

    #[cfg(not(target_os = "windows"))]
    fn find_listening_ports_unix(pid: u32) -> Result<Vec<u16>, DiscoveryError> {
        let output = Command::new("lsof")
            .args(["-iTCP", "-sTCP:LISTEN", "-P", "-n", "-a", "-p", &pid.to_string()])
            .output()
            .map_err(|e| DiscoveryError {
                kind: DiscoveryErrorKind::CommandExecutionFailed,
                message: format!("Failed to execute lsof: {}", e),
            })?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut ports = Vec::new();
        let re = Regex::new(r":(\d+)\s+\(LISTEN\)").unwrap();

        for line in stdout.lines() {
            if let Some(caps) = re.captures(line) {
                if let Some(m) = caps.get(1) {
                    if let Ok(p) = m.as_str().parse::<u16>() {
                        if !ports.contains(&p) {
                            ports.push(p);
                        }
                    }
                }
            }
        }

        ports.sort();
        Ok(ports)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_csrf_token_space() {
        let cmd = "language_server.exe --standalone --csrf_token 8a9a6acf-07cb-433a-a7df-53883d7ef7e8 --app_data_dir antigravity";
        assert_eq!(
            AntigravityDiscovery::extract_csrf_token(cmd),
            Some("8a9a6acf-07cb-433a-a7df-53883d7ef7e8".to_string())
        );
    }

    #[test]
    fn test_extract_csrf_token_equals() {
        let cmd = "language_server.exe --standalone --csrf_token=abc-123-xyz --app_data_dir antigravity";
        assert_eq!(
            AntigravityDiscovery::extract_csrf_token(cmd),
            Some("abc-123-xyz".to_string())
        );
    }

    #[test]
    fn test_parse_netstat_listening_ports() {
        let sample = "
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1234
  TCP    127.0.0.1:50028        0.0.0.0:0              LISTENING       8360
  TCP    127.0.0.1:50029        0.0.0.0:0              LISTENING       8360
  TCP    127.0.0.1:50028        127.0.0.1:50032        ESTABLISHED     8360
  TCP    [::]:135               [::]:0                 LISTENING       1234
";
        let ports = AntigravityDiscovery::parse_netstat_listening_ports(sample, 8360).unwrap();
        assert_eq!(ports, vec![50028, 50029]);
    }
}
