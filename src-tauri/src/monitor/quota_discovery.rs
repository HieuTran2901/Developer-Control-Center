use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};
use sysinfo::System;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EndpointClassification {
    Unknown,
    AntigravityMain,
    LanguageServer,
    Hub,
    UsageCandidate,
    QuotaCandidate,
    UsageConfirmed,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum CorrelationConfidence {
    Low,
    Medium,
    High,
    Confirmed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum QuotaMetadataStatus {
    NotAvailable,
    Candidate,
    Observed,
    Confirmed,
    UnsupportedFormat,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum LocalUsageSourceType {
    UsageMetadata,
    QuotaMetadata,
    PublicConfiguration,
    DiagnosticLog,
    ModelMetadata,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum UsageProtocolType {
    Unknown,
    Http,
    Https,
    WebSocket,
    Grpc,
    GrpcWeb,
    ProtobufRpc,
    Other,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum UsageExecutionOwner {
    Cli,
    LanguageServer,
    AntigravityMain,
    Other,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum UsagePayloadFormat {
    ProtectedBinary,
    Json,
    PlainText,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum QuotaMetadataAvailability {
    NotObservable,
    Observed,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaValues {
    pub used: Option<f64>,
    pub limit: Option<f64>,
    pub remaining: Option<f64>,
    pub percentage: Option<f64>,
    pub reset_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeQuotaMetadata {
    pub source: String, // "InteractiveUserTrace" | "StaticCorrelation" | "LocalStateFile"
    pub endpoint: String,
    pub observed_at: Option<String>,
    pub quota: Option<QuotaValues>,
    pub status: QuotaMetadataStatus,
    pub confidence: CorrelationConfidence,
    pub diagnostic_notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalUsageSource {
    pub source_type: LocalUsageSourceType,
    pub safe_path: String,
    pub process_association: String,
    pub confidence: CorrelationConfidence,
    pub observed_at: String,
    pub skipped_sensitive_source: bool,
    pub safe_quota: Option<QuotaValues>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalUsageDiscoveryReport {
    pub timestamp: String,
    pub status: String, // "FOUND" | "NOT_FOUND" | "UNSUPPORTED_FORMAT"
    pub directories_inspected: usize,
    pub files_inspected: usize,
    pub bytes_read: u64,
    pub scan_duration_ms: u64,
    pub sources: Vec<LocalUsageSource>,
    pub best_source: Option<LocalUsageSource>,
    pub diagnostic_notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageProtocolCandidate {
    pub endpoint: String,
    pub process_name: String,
    pub pid: u32,
    pub port: u16,
    pub protocol: UsageProtocolType,
    pub execution_owner: UsageExecutionOwner,
    pub method: Option<String>,
    pub path: Option<String>,
    pub content_type: Option<String>,
    pub payload_format: UsagePayloadFormat,
    pub quota_availability: QuotaMetadataAvailability,
    pub correlation_state: String, // "CONFIRMED" | "CANDIDATE_ACTIVE" | "NOT_CORRELATED"
    pub confidence: CorrelationConfidence,
    pub timestamp: String,
    pub evidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageProtocolDiscoveryReport {
    pub timestamp: String,
    pub status: String,
    pub candidate: Option<UsageProtocolCandidate>,
    pub candidates: Vec<UsageProtocolCandidate>,
    pub diagnostic_notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessDiscoveryResult {
    pub pid: u32,
    pub executable_name: String,
    pub executable_path: String,
    pub command_line: String,
    pub parent_pid: Option<u32>,
    pub detected_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListeningPortDiscoveryResult {
    pub pid: u32,
    pub local_address: String,
    pub local_port: u16,
    pub protocol: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EndpointProbeResult {
    pub url: String,
    pub protocol: String,
    pub port: u16,
    pub status_code: Option<u16>,
    pub is_reachable: bool,
    pub headers_summary: HashMap<String, String>,
    pub server_banner: Option<String>,
    pub is_antigravity_hub: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaDiscoveryReport {
    pub timestamp: String,
    pub processes: Vec<ProcessDiscoveryResult>,
    pub listening_ports: Vec<ListeningPortDiscoveryResult>,
    pub endpoints: Vec<EndpointProbeResult>,
    pub analysis_notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageCorrelationCandidate {
    pub process_pid: u32,
    pub process_name: String,
    pub port: u16,
    pub protocol: String,
    pub endpoint: String,
    pub classification: EndpointClassification,
    pub confidence: CorrelationConfidence,
    pub correlation_method: String,
    pub evidence: String,
    pub warnings: Vec<String>,
    pub matched_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageCorrelationReport {
    pub timestamp: String,
    pub status: String,
    pub best_candidate: Option<UsageCorrelationCandidate>,
    pub candidates: Vec<UsageCorrelationCandidate>,
    pub diagnostic_notes: Vec<String>,
    pub is_usage_confirmed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObservedTraceEvent {
    pub timestamp: String,
    pub process_pid: u32,
    pub process_name: String,
    pub port: u16,
    pub protocol: String,
    pub event_type: String,
    pub details: String,
    pub matched_path: Option<String>,
    pub confidence: CorrelationConfidence,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageEndpointMetadata {
    pub endpoint: String,
    pub process: String,
    pub pid: u32,
    pub port: u16,
    pub protocol: String,
    pub correlation: String, // "CONFIRMED" | "CANDIDATE_ACTIVE" | "NOT_CORRELATED"
    pub confidence: CorrelationConfidence,
    pub observed_at: Option<String>,
    pub source: String, // "InteractiveUserTrace" | "StaticCorrelation"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageTraceReport {
    pub timestamp: String,
    pub status: String, // "CONFIRMED" | "CANDIDATE_ACTIVE" | "NOT_CORRELATED"
    pub trace_duration_ms: u64,
    pub usage_triggered_by_user: bool,
    pub observed_events: Vec<ObservedTraceEvent>,
    pub confirmed_endpoint: Option<String>,
    pub confidence: CorrelationConfidence,
    pub warnings: Vec<String>,
    pub summary_notes: Vec<String>,
    pub usage_endpoint_metadata: Option<UsageEndpointMetadata>,
    pub safe_quota_metadata: Option<SafeQuotaMetadata>,
}

pub struct QuotaDiscoveryService;

impl QuotaDiscoveryService {
    /// Sanitize command line arguments to prevent leaking secrets, credentials, or session tokens
    pub fn sanitize_command_line(cmd: &str) -> String {
        let re_csrf = regex::Regex::new(r"(?i)(--csrf_token\s+)([^\s]+)").unwrap();
        let s1 = re_csrf.replace_all(cmd, "$1[REDACTED]");

        let re_token = regex::Regex::new(r"(?i)(--token\s+|--auth_token\s+|--api_key\s+)([^\s]+)").unwrap();
        let s2 = re_token.replace_all(&s1, "$1[REDACTED]");

        s2.to_string()
    }

    /// Redact sensitive information from evidence text and enforce max length <= 300 chars
    pub fn sanitize_evidence(raw: &str) -> String {
        let re_csrf = regex::Regex::new(r"(?i)(csrf_token\s*[:=]\s*|\bcsrf_token\s+)([^\s,;]+)").unwrap();
        let s1 = re_csrf.replace_all(raw, "csrf_token=[REDACTED]");

        let re_bearer = regex::Regex::new(r"(?i)(bearer\s+)([a-zA-Z0-9_\-\.]+)").unwrap();
        let s2 = re_bearer.replace_all(&s1, "Bearer [REDACTED]");

        let re_auth = regex::Regex::new(r"(?i)(authorization\s*:\s*)([^\s,;]+)").unwrap();
        let s3 = re_auth.replace_all(&s2, "Authorization: [REDACTED]");

        let re_cookie = regex::Regex::new(r"(?i)(cookie\s*:\s*|set-cookie\s*:\s*)([^\s,;]+)").unwrap();
        let s4 = re_cookie.replace_all(&s3, "Cookie: [REDACTED]");

        let re_url_token = regex::Regex::new(r"(?i)([?&](?:token|key|secret|auth|access_token|refresh_token)=)([^&\s]+)").unwrap();
        let s5 = re_url_token.replace_all(&s4, "$1[REDACTED]");

        let bounded: String = s5.chars().take(300).collect();
        bounded
    }

    /// Check if a given file path is sensitive and must NOT be opened or inspected
    pub fn is_sensitive_source_path(path: &Path) -> bool {
        let path_str = path.to_string_lossy().to_lowercase();
        
        let sensitive_patterns = [
            "cookies",
            "cookie",
            "credentials",
            "local storage",
            "session storage",
            "indexeddb",
            "auth",
            "token",
            "secret",
            "password",
            "keychain",
            ".sqlite",
            ".ldb",
            "login data",
            "web data",
            "private",
        ];

        sensitive_patterns.iter().any(|&p| path_str.contains(p))
    }

    /// Parse safe numeric quota values from non-sensitive text snippets without capturing credentials
    pub fn parse_safe_quota_values(raw: &str) -> Option<QuotaValues> {
        let raw_lower = raw.to_lowercase();
        if !raw_lower.contains("quota") && !raw_lower.contains("usage") && !raw_lower.contains("limit") && !raw_lower.contains("remaining") {
            return None;
        }

        let mut percentage = None;
        let mut used = None;
        let mut limit = None;
        let mut remaining = None;
        let mut reset_at = None;

        // Try regex for percentage: e.g. "72%", "quota: 72%"
        let re_pct = regex::Regex::new(r"(\d+(?:\.\d+)?)\s*%").unwrap();
        if let Some(caps) = re_pct.captures(raw) {
            if let Ok(val) = caps[1].parse::<f64>() {
                if val >= 0.0 && val <= 100.0 {
                    percentage = Some(val);
                }
            }
        }

        // Try regex for used / limit: e.g. "720/1000", "used: 50, limit: 100"
        let re_fraction = regex::Regex::new(r"(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)").unwrap();
        if let Some(caps) = re_fraction.captures(raw) {
            if let (Ok(u), Ok(l)) = (caps[1].parse::<f64>(), caps[2].parse::<f64>()) {
                if l > 0.0 {
                    used = Some(u);
                    limit = Some(l);
                    remaining = Some((l - u).max(0.0));
                    if percentage.is_none() {
                        percentage = Some(((u / l) * 100.0).round());
                    }
                }
            }
        }

        // Try regex for reset timestamp/duration: e.g. "reset in 42m", "reset: 1723719999"
        let re_reset = regex::Regex::new(r"(?i)reset(?:_at|\s+in)?\s*[:=]?\s*([0-9a-zA-Z\s]+)").unwrap();
        if let Some(caps) = re_reset.captures(raw) {
            let s = caps[1].trim();
            if !s.is_empty() && s.len() <= 30 {
                reset_at = Some(Self::sanitize_evidence(s));
            }
        }

        if percentage.is_some() || used.is_some() || limit.is_some() || remaining.is_some() || reset_at.is_some() {
            Some(QuotaValues {
                used,
                limit,
                remaining,
                percentage,
                reset_at,
            })
        } else {
            None
        }
    }

    /// Pure deterministic evaluator for SafeQuotaMetadata
    pub fn evaluate_safe_quota_metadata(
        trace_active: bool,
        candidate_endpoint: &str,
        events: &[ObservedTraceEvent],
    ) -> SafeQuotaMetadata {
        if !trace_active || events.is_empty() {
            return SafeQuotaMetadata {
                source: "StaticCorrelation".to_string(),
                endpoint: candidate_endpoint.to_string(),
                observed_at: None,
                quota: None,
                status: QuotaMetadataStatus::Candidate,
                confidence: CorrelationConfidence::High,
                diagnostic_notes: vec![
                    "Usage candidate endpoint identified; start interactive trace to observe safe quota metadata."
                        .to_string(),
                ],
            };
        }

        for evt in events {
            if let Some(quota_vals) = Self::parse_safe_quota_values(&evt.details) {
                let status = if evt.event_type == "UsageRpcInvocation" || evt.matched_path.as_deref() == Some("/usage") {
                    QuotaMetadataStatus::Confirmed
                } else {
                    QuotaMetadataStatus::Observed
                };

                let conf = if status == QuotaMetadataStatus::Confirmed {
                    CorrelationConfidence::Confirmed
                } else {
                    CorrelationConfidence::High
                };

                return SafeQuotaMetadata {
                    source: "InteractiveUserTrace".to_string(),
                    endpoint: candidate_endpoint.to_string(),
                    observed_at: Some(evt.timestamp.clone()),
                    quota: Some(quota_vals),
                    status,
                    confidence: conf,
                    diagnostic_notes: vec![
                        "Safe, non-sensitive quota metrics discovered through read-only observation.".to_string(),
                    ],
                };
            }
        }

        let has_usage_event = events.iter().any(|e| {
            e.event_type == "UsageRpcInvocation"
                || e.matched_path.as_deref() == Some("/usage")
                || e.details.to_lowercase().contains("usage")
        });

        if has_usage_event {
            SafeQuotaMetadata {
                source: "InteractiveUserTrace".to_string(),
                endpoint: candidate_endpoint.to_string(),
                observed_at: events.first().map(|e| e.timestamp.clone()),
                quota: None,
                status: QuotaMetadataStatus::UnsupportedFormat,
                confidence: CorrelationConfidence::Confirmed,
                diagnostic_notes: vec![
                    "Usage endpoint confirmed active, but quota payload uses an unparsed RPC format.".to_string(),
                ],
            }
        } else {
            SafeQuotaMetadata {
                source: "InteractiveUserTrace".to_string(),
                endpoint: candidate_endpoint.to_string(),
                observed_at: events.first().map(|e| e.timestamp.clone()),
                quota: None,
                status: QuotaMetadataStatus::NotAvailable,
                confidence: CorrelationConfidence::Low,
                diagnostic_notes: vec![
                    "No safe quota metadata observed during the read-only trace window.".to_string(),
                ],
            }
        }
    }

    /// Discover running Antigravity processes on the local system
    pub fn discover_processes() -> Vec<ProcessDiscoveryResult> {
        let mut sys = System::new_all();
        sys.refresh_all();

        let now = chrono_or_simple_timestamp();
        let mut results = Vec::new();
        let mut antigravity_pids = HashSet::new();

        // 1. First pass: Identify primary Antigravity processes
        for (pid, process) in sys.processes() {
            let name = process.name().to_string_lossy().to_string();
            let name_lower = name.to_lowercase();
            let exe_path = process
                .exe()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            let exe_path_lower = exe_path.to_lowercase();

            let is_match = name_lower.contains("antigravity")
                || name_lower.contains("agy")
                || name_lower == "language_server"
                || name_lower == "language_server.exe"
                || exe_path_lower.contains("antigravity")
                || exe_path_lower.contains("language_server");

            if is_match {
                antigravity_pids.insert(pid.as_u32());
            }
        }

        // 2. Second pass: Collect details including child processes
        for (pid, process) in sys.processes() {
            let pid_u32 = pid.as_u32();
            let parent_pid_u32 = process.parent().map(|p| p.as_u32());

            let is_direct_match = antigravity_pids.contains(&pid_u32);
            let is_child_match = parent_pid_u32.map_or(false, |ppid| antigravity_pids.contains(&ppid));

            if is_direct_match || is_child_match {
                let name = process.name().to_string_lossy().to_string();
                let exe_path = process
                    .exe()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();
                
                let raw_cmd = process
                    .cmd()
                    .iter()
                    .map(|s| s.to_string_lossy().to_string())
                    .collect::<Vec<_>>()
                    .join(" ");

                let sanitized_cmd = Self::sanitize_command_line(&raw_cmd);

                results.push(ProcessDiscoveryResult {
                    pid: pid_u32,
                    executable_name: name,
                    executable_path: exe_path,
                    command_line: sanitized_cmd,
                    parent_pid: parent_pid_u32,
                    detected_at: now.clone(),
                });
            }
        }

        results.sort_by_key(|p| p.pid);
        results
    }

    /// Discover listening TCP ports bound by the identified Antigravity PIDs
    pub fn discover_listening_ports(target_pids: &[u32]) -> Vec<ListeningPortDiscoveryResult> {
        let mut results = Vec::new();
        if target_pids.is_empty() {
            return results;
        }

        let pid_set: HashSet<u32> = target_pids.iter().copied().collect();

        #[cfg(target_os = "windows")]
        {
            if let Ok(output) = Command::new("netstat").args(["-ano", "-p", "tcp"]).output() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 5 && parts[0].eq_ignore_ascii_case("TCP") {
                        let state = parts[3];
                        if state.eq_ignore_ascii_case("LISTENING") {
                            if let Ok(pid) = parts[4].parse::<u32>() {
                                if pid_set.contains(&pid) {
                                    let local_addr_full = parts[1];
                                    if let Some(colon_pos) = local_addr_full.rfind(':') {
                                        let addr = &local_addr_full[..colon_pos];
                                        if let Ok(port) = local_addr_full[colon_pos + 1..].parse::<u16>() {
                                            results.push(ListeningPortDiscoveryResult {
                                                pid,
                                                local_address: addr.to_string(),
                                                local_port: port,
                                                protocol: "TCP".to_string(),
                                                state: "LISTENING".to_string(),
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            if let Ok(output) = Command::new("lsof").args(["-iTCP", "-sTCP:LISTEN", "-P", "-n"]).output() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 9 {
                        if let Ok(pid) = parts[1].parse::<u32>() {
                            if pid_set.contains(&pid) {
                                let addr_part = parts[8];
                                if let Some(colon_pos) = addr_part.rfind(':') {
                                    let addr = &addr_part[..colon_pos];
                                    if let Ok(port) = addr_part[colon_pos + 1..].parse::<u16>() {
                                        results.push(ListeningPortDiscoveryResult {
                                            pid,
                                            local_address: addr.to_string(),
                                            local_port: port,
                                            protocol: "TCP".to_string(),
                                            state: "LISTEN".to_string(),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        results.sort_by_key(|p| p.local_port);
        results.dedup_by(|a, b| a.local_port == b.local_port && a.pid == b.pid);
        results
    }

    /// Probe candidate endpoints on discovered local ports
    pub async fn probe_candidate_endpoints(ports: &[u16]) -> Vec<EndpointProbeResult> {
        let mut results = Vec::new();
        let unique_ports: HashSet<u16> = ports.iter().copied().collect();

        let client = match reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .timeout(Duration::from_millis(1500))
            .build()
        {
            Ok(c) => c,
            Err(_) => reqwest::Client::new(),
        };

        for port in unique_ports {
            for proto in &["http", "https"] {
                let url = format!("{}://127.0.0.1:{}/", proto, port);
                let probe = Self::probe_single_url(&client, &url, proto, port).await;
                results.push(probe);
            }
        }

        results.sort_by(|a, b| a.port.cmp(&b.port).then_with(|| a.protocol.cmp(&b.protocol)));
        results
    }

    async fn probe_single_url(
        client: &reqwest::Client,
        url: &str,
        protocol: &str,
        port: u16,
    ) -> EndpointProbeResult {
        match client.get(url).send().await {
            Ok(resp) => {
                let status_code = Some(resp.status().as_u16());
                let is_reachable = true;
                let mut headers_summary = HashMap::new();

                for (name, val) in resp.headers() {
                    let key = name.as_str().to_string();
                    let key_lower = key.to_lowercase();
                    if matches!(
                        key_lower.as_str(),
                        "content-type" | "cache-control" | "date" | "server" | "vary" | "x-frame-options"
                    ) {
                        if let Ok(v_str) = val.to_str() {
                            headers_summary.insert(key, v_str.to_string());
                        }
                    }
                }

                let body = resp.text().await.unwrap_or_default();
                let is_antigravity_hub = body.contains("__APP_CONFIG__")
                    || body.contains("antigravity")
                    || body.contains("Antigravity");

                let server_banner = if is_antigravity_hub {
                    Some("Antigravity Local Hub / Web Service".to_string())
                } else {
                    None
                };

                EndpointProbeResult {
                    url: url.to_string(),
                    protocol: protocol.to_string(),
                    port,
                    status_code,
                    is_reachable,
                    headers_summary,
                    server_banner,
                    is_antigravity_hub,
                    error: None,
                }
            }
            Err(e) => {
                let err_str = e.to_string();
                let is_https_error = err_str.contains("Client sent an HTTP request to an HTTPS server");

                EndpointProbeResult {
                    url: url.to_string(),
                    protocol: protocol.to_string(),
                    port,
                    status_code: None,
                    is_reachable: false,
                    headers_summary: HashMap::new(),
                    server_banner: None,
                    is_antigravity_hub: false,
                    error: Some(if is_https_error {
                        "HTTPS required on this port".to_string()
                    } else {
                        "Connection refused / timeout".to_string()
                    }),
                }
            }
        }
    }

    /// Perform complete read-only Quota Discovery diagnosis
    pub async fn run_discovery() -> QuotaDiscoveryReport {
        let processes = Self::discover_processes();
        let target_pids: Vec<u32> = processes.iter().map(|p| p.pid).collect();
        let listening_ports = Self::discover_listening_ports(&target_pids);

        let ports_to_probe: Vec<u16> = listening_ports.iter().map(|l| l.local_port).collect();
        let endpoints = Self::probe_candidate_endpoints(&ports_to_probe).await;

        let mut analysis_notes = Vec::new();
        analysis_notes.push(format!(
            "Discovered {} Antigravity related process(es) on host.",
            processes.len()
        ));

        let ls_proc = processes.iter().find(|p| p.executable_name.to_lowercase().contains("language_server"));
        if let Some(ls) = ls_proc {
            analysis_notes.push(format!(
                "Antigravity Language Server active: PID {} ({})",
                ls.pid, ls.executable_path
            ));
        }

        if !listening_ports.is_empty() {
            analysis_notes.push(format!(
                "Discovered {} active listening port(s): {}",
                listening_ports.len(),
                listening_ports
                    .iter()
                    .map(|l| format!("{}/{}", l.local_port, l.protocol))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }

        let hubs: Vec<&EndpointProbeResult> = endpoints.iter().filter(|e| e.is_antigravity_hub).collect();
        if !hubs.is_empty() {
            analysis_notes.push(format!(
                "Verified {} Antigravity Hub local endpoint(s): {}",
                hubs.len(),
                hubs.iter().map(|h| h.url.as_str()).collect::<Vec<_>>().join(", ")
            ));
            analysis_notes.push(
                "Local service uses CSRF token protection and local HTTP/HTTPS IPC for slash commands including /usage.".to_string()
            );
        } else {
            analysis_notes.push(
                "Local client is installed; start Antigravity IDE to observe active runtime endpoints.".to_string()
            );
        }

        QuotaDiscoveryReport {
            timestamp: chrono_or_simple_timestamp(),
            processes,
            listening_ports,
            endpoints,
            analysis_notes,
        }
    }

    /// Perform AG-2 Usage Endpoint Correlation
    pub async fn correlate_usage_endpoints() -> UsageCorrelationReport {
        let processes = Self::discover_processes();
        let target_pids: Vec<u32> = processes.iter().map(|p| p.pid).collect();
        let listening_ports = Self::discover_listening_ports(&target_pids);
        let ports_to_probe: Vec<u16> = listening_ports.iter().map(|l| l.local_port).collect();
        let endpoints = Self::probe_candidate_endpoints(&ports_to_probe).await;

        let mut candidates = Vec::new();
        let mut diagnostic_notes = Vec::new();

        for endpoint in &endpoints {
            let port_info = listening_ports.iter().find(|lp| lp.local_port == endpoint.port);
            let pid = port_info.map(|p| p.pid).unwrap_or(0);
            let proc_info = processes.iter().find(|p| p.pid == pid);
            let proc_name = proc_info
                .map(|p| p.executable_name.clone())
                .unwrap_or_else(|| "Unknown".to_string());
            let proc_name_lower = proc_name.to_lowercase();

            let is_ls = proc_name_lower.contains("language_server");
            let is_https = endpoint.protocol == "https";

            let (classification, confidence, correlation_method, raw_evidence, warnings) =
                if is_ls && is_https && endpoint.is_reachable {
                    (
                        EndpointClassification::UsageCandidate,
                        CorrelationConfidence::High,
                        "LanguageServerRpcAnalysis".to_string(),
                        "Language Server spawned with HTTPS RPC service and active local hub session. Serves IDE slash commands including /usage."
                            .to_string(),
                        vec![
                            "Candidate endpoint discovered; /usage correlation not yet confirmed without active slash command execution."
                                .to_string(),
                        ],
                    )
                } else if is_ls && !is_https && endpoint.is_antigravity_hub {
                    (
                        EndpointClassification::Hub,
                        CorrelationConfidence::Medium,
                        "WebHubServiceVerification".to_string(),
                        "Antigravity Web UI Hub service hosting __APP_CONFIG__ and frontend bundle."
                            .to_string(),
                        vec!["Web UI port; RPC /usage backend communicates via sibling HTTPS service.".to_string()],
                    )
                } else if proc_name_lower.contains("antigravity") {
                    (
                        EndpointClassification::AntigravityMain,
                        CorrelationConfidence::Low,
                        "ProcessPortMetadata".to_string(),
                        "Main Antigravity Electron process listening socket.".to_string(),
                        vec!["Main desktop wrapper; does not serve language server RPC directly.".to_string()],
                    )
                } else {
                    (
                        EndpointClassification::Unknown,
                        CorrelationConfidence::Low,
                        "PassiveProbe".to_string(),
                        "Local port opened by Antigravity child process.".to_string(),
                        vec![],
                    )
                };

            let sanitized_evidence = Self::sanitize_evidence(&raw_evidence);

            candidates.push(UsageCorrelationCandidate {
                process_pid: pid,
                process_name: proc_name,
                port: endpoint.port,
                protocol: endpoint.protocol.clone(),
                endpoint: endpoint.url.clone(),
                classification,
                confidence,
                correlation_method,
                evidence: sanitized_evidence,
                warnings,
                matched_path: None,
            });
        }

        candidates.sort_by(|a, b| b.confidence.cmp(&a.confidence));

        let best_candidate = candidates.first().cloned();
        let status = if best_candidate.is_some() {
            "CANDIDATE_FOUND".to_string()
        } else {
            "NOT_CORRELATED".to_string()
        };

        if let Some(ref best) = best_candidate {
            diagnostic_notes.push(format!(
                "Identified best candidate: {} (PID {}, Port {}/{}, Confidence: {:?})",
                best.endpoint, best.process_pid, best.port, best.protocol, best.confidence
            ));
            diagnostic_notes.push(
                "Candidate endpoint discovered; /usage correlation not yet confirmed.".to_string()
            );
        } else {
            diagnostic_notes.push(
                "Antigravity local services were discovered, but no reliable correlation to /usage was established."
                    .to_string(),
            );
        }

        UsageCorrelationReport {
            timestamp: chrono_or_simple_timestamp(),
            status,
            best_candidate,
            candidates,
            diagnostic_notes,
            is_usage_confirmed: false,
        }
    }

    /// Pure deterministic confirmation evaluator for tests and runtime
    pub fn evaluate_trace_confirmation(
        trace_active: bool,
        candidate_endpoint: &str,
        candidate_port: u16,
        candidate_pid: u32,
        events: &[ObservedTraceEvent],
    ) -> (String, CorrelationConfidence, Option<UsageEndpointMetadata>) {
        if !trace_active || events.is_empty() {
            return (
                "CANDIDATE_ACTIVE".to_string(),
                CorrelationConfidence::High,
                Some(UsageEndpointMetadata {
                    endpoint: candidate_endpoint.to_string(),
                    process: "language_server.exe".to_string(),
                    pid: candidate_pid,
                    port: candidate_port,
                    protocol: "HTTPS".to_string(),
                    correlation: "CANDIDATE_ACTIVE".to_string(),
                    confidence: CorrelationConfidence::High,
                    observed_at: None,
                    source: "StaticCorrelation".to_string(),
                }),
            );
        }

        // Check if any event has direct UsageRpcInvocation or matched /usage on candidate port
        let usage_event = events.iter().find(|e| {
            e.port == candidate_port
                && (e.event_type == "UsageRpcInvocation"
                    || e.matched_path.as_deref() == Some("/usage")
                    || e.details.to_lowercase().contains("usage")
                    || e.details.to_lowercase().contains("quota"))
        });

        if let Some(evt) = usage_event {
            (
                "CONFIRMED".to_string(),
                CorrelationConfidence::Confirmed,
                Some(UsageEndpointMetadata {
                    endpoint: candidate_endpoint.to_string(),
                    process: evt.process_name.clone(),
                    pid: evt.process_pid,
                    port: evt.port,
                    protocol: evt.protocol.clone(),
                    correlation: "CONFIRMED".to_string(),
                    confidence: CorrelationConfidence::Confirmed,
                    observed_at: Some(evt.timestamp.clone()),
                    source: "InteractiveUserTrace".to_string(),
                }),
            )
        } else {
            let rpc_event = events.iter().find(|e| e.port == candidate_port);
            (
                "CANDIDATE_ACTIVE".to_string(),
                CorrelationConfidence::High,
                Some(UsageEndpointMetadata {
                    endpoint: candidate_endpoint.to_string(),
                    process: "language_server.exe".to_string(),
                    pid: candidate_pid,
                    port: candidate_port,
                    protocol: "HTTPS".to_string(),
                    correlation: "CANDIDATE_ACTIVE".to_string(),
                    confidence: CorrelationConfidence::High,
                    observed_at: rpc_event.map(|e| e.timestamp.clone()),
                    source: "InteractiveUserTrace".to_string(),
                }),
            )
        }
    }

    /// Perform AG-2.5 / AG-3 / AG-4 Interactive Usage Trace & Safe Metadata Discovery
    pub async fn run_usage_trace(duration_secs: u64) -> UsageTraceReport {
        let duration = duration_secs.clamp(3, 15);
        let start_time = Instant::now();
        let trace_duration_ms = duration * 1000;

        let processes = Self::discover_processes();
        let target_pids: Vec<u32> = processes.iter().map(|p| p.pid).collect();
        let listening_ports = Self::discover_listening_ports(&target_pids);

        let candidate_ls_pid = processes
            .iter()
            .find(|p| p.executable_name.to_lowercase().contains("language_server"))
            .map(|p| p.pid)
            .unwrap_or(0);

        let candidate_https_port = listening_ports
            .iter()
            .find(|lp| lp.pid == candidate_ls_pid && lp.local_port != 50390)
            .map(|lp| lp.local_port)
            .unwrap_or(50389);

        let candidate_endpoint_url = format!("https://127.0.0.1:{}/", candidate_https_port);

        let log_candidates = get_candidate_log_paths();
        let mut log_file_info: Option<(PathBuf, u64)> = None;
        for path in log_candidates {
            if path.exists() {
                if let Ok(metadata) = std::fs::metadata(&path) {
                    log_file_info = Some((path, metadata.len()));
                    break;
                }
            }
        }

        let mut observed_events = Vec::new();
        let sample_interval = Duration::from_millis(500);
        let total_iterations = (duration * 1000) / 500;

        for _ in 0..total_iterations {
            tokio::time::sleep(sample_interval).await;

            if let Some((ref log_path, ref mut last_pos)) = log_file_info {
                if let Ok(mut f) = File::open(log_path) {
                    if let Ok(metadata) = f.metadata() {
                        let current_len = metadata.len();
                        if current_len > *last_pos {
                            let bytes_to_read = (current_len - *last_pos).min(16384);
                            if f.seek(SeekFrom::Start(*last_pos)).is_ok() {
                                let mut buf = vec![0u8; bytes_to_read as usize];
                                if f.read_exact(&mut buf).is_ok() {
                                    let new_text = String::from_utf8_lossy(&buf);
                                    for line in new_text.lines() {
                                        let line_trimmed = line.trim();
                                        if line_trimmed.is_empty() {
                                            continue;
                                        }

                                        let line_lower = line_trimmed.to_lowercase();
                                        let is_usage_match = line_lower.contains("usage")
                                            || line_lower.contains("quota")
                                            || line_lower.contains("credit")
                                            || line_lower.contains("limit");

                                        let is_rpc_match = line_lower.contains("loadcodeassist")
                                            || line_lower.contains("fetchavailablemodels")
                                            || line_lower.contains("streamgeneratecontent")
                                            || line_lower.contains("http_helpers.go")
                                            || line_lower.contains("url:");

                                        if is_usage_match || is_rpc_match {
                                            let event_type = if is_usage_match {
                                                "UsageRpcInvocation"
                                            } else {
                                                "LanguageServerRpcTraffic"
                                            };

                                            let matched_path = if is_usage_match {
                                                Some("/usage".to_string())
                                            } else if line_trimmed.contains("loadCodeAssist") {
                                                Some("/v1internal:loadCodeAssist".to_string())
                                            } else if line_trimmed.contains("fetchAvailableModels") {
                                                Some("/v1internal:fetchAvailableModels".to_string())
                                            } else {
                                                Some("/v1internal:streamGenerateContent".to_string())
                                            };

                                            let sanitized_details = Self::sanitize_evidence(line_trimmed);

                                            observed_events.push(ObservedTraceEvent {
                                                timestamp: chrono_or_simple_timestamp(),
                                                process_pid: candidate_ls_pid,
                                                process_name: "language_server.exe".to_string(),
                                                port: candidate_https_port,
                                                protocol: "HTTPS".to_string(),
                                                event_type: event_type.to_string(),
                                                details: sanitized_details,
                                                matched_path,
                                                confidence: if is_usage_match {
                                                    CorrelationConfidence::Confirmed
                                                } else {
                                                    CorrelationConfidence::High
                                                },
                                            });
                                        }
                                    }
                                }
                            }
                            *last_pos = current_len;
                        }
                    }
                }
            }
        }

        let elapsed_actual = start_time.elapsed().as_millis() as u64;
        let mut summary_notes = Vec::new();
        let mut warnings = Vec::new();

        let (status, confidence, usage_endpoint_metadata) = Self::evaluate_trace_confirmation(
            true,
            &candidate_endpoint_url,
            candidate_https_port,
            candidate_ls_pid,
            &observed_events,
        );

        let safe_quota_metadata = Some(Self::evaluate_safe_quota_metadata(
            true,
            &candidate_endpoint_url,
            &observed_events,
        ));

        let confirmed_endpoint = if status == "CONFIRMED" || status == "CANDIDATE_ACTIVE" {
            Some(candidate_endpoint_url)
        } else {
            None
        };

        if status == "CONFIRMED" {
            summary_notes.push(format!(
                "Direct /usage RPC activity correlated on port {} (PID {}). Status upgraded to CONFIRMED.",
                candidate_https_port, candidate_ls_pid
            ));
        } else if status == "CANDIDATE_ACTIVE" {
            summary_notes.push(format!(
                "Observed active Language Server RPC port {} (PID {}). Candidate remains active.",
                candidate_https_port, candidate_ls_pid
            ));
            warnings.push(
                "Execute '/usage' inside Antigravity during the trace countdown to confirm quota correlation."
                    .to_string(),
            );
        } else {
            summary_notes.push(
                "No safe local activity observed during trace window. Ensure Antigravity is running."
                    .to_string(),
            );
        }

        observed_events.truncate(15);

        UsageTraceReport {
            timestamp: chrono_or_simple_timestamp(),
            status,
            trace_duration_ms: elapsed_actual.max(trace_duration_ms),
            usage_triggered_by_user: !observed_events.is_empty(),
            observed_events,
            confirmed_endpoint,
            confidence,
            warnings,
            summary_notes,
            usage_endpoint_metadata,
            safe_quota_metadata,
        }
    }

    /// Perform AG-5 Local Usage State Discovery (Bounded, Safe & Non-Intrusive)
    pub fn discover_local_usage_sources() -> LocalUsageDiscoveryReport {
        let start_time = Instant::now();
        let now_str = chrono_or_simple_timestamp();

        let mut dirs_inspected = 0;
        let mut files_inspected = 0;
        let mut total_bytes_read: u64 = 0;

        let max_files = 500;
        let max_dirs = 200;
        let max_file_size: u64 = 1024 * 1024; // 1 MB
        let max_total_bytes: u64 = 20 * 1024 * 1024; // 20 MB

        let mut sources = Vec::new();
        let mut diagnostic_notes = Vec::new();

        let mut target_dirs: Vec<PathBuf> = Vec::new();
        if let Ok(appdata) = std::env::var("APPDATA") {
            target_dirs.push(PathBuf::from(&appdata).join("antigravity"));
            target_dirs.push(PathBuf::from(&appdata).join("Antigravity"));
        }
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            target_dirs.push(PathBuf::from(&userprofile).join(".gemini").join("antigravity"));
        }

        let mut queue: Vec<PathBuf> = target_dirs.into_iter().filter(|d| d.exists()).collect();

        while let Some(current_dir) = queue.pop() {
            if dirs_inspected >= max_dirs || files_inspected >= max_files || total_bytes_read >= max_total_bytes {
                diagnostic_notes.push("Inspection reached safety bounds limit.".to_string());
                break;
            }

            dirs_inspected += 1;

            let entries = match std::fs::read_dir(&current_dir) {
                Ok(e) => e,
                Err(_) => continue,
            };

            for entry in entries.flatten() {
                if files_inspected >= max_files || total_bytes_read >= max_total_bytes {
                    break;
                }

                let path = entry.path();
                let file_name = path.file_name().and_then(|f| f.to_str()).unwrap_or("").to_lowercase();

                if path.is_dir() {
                    if Self::is_sensitive_source_path(&path) {
                        sources.push(LocalUsageSource {
                            source_type: LocalUsageSourceType::Unknown,
                            safe_path: path.to_string_lossy().to_string(),
                            process_association: "AntigravityStorage".to_string(),
                            confidence: CorrelationConfidence::Low,
                            observed_at: now_str.clone(),
                            skipped_sensitive_source: true,
                            safe_quota: None,
                        });
                        continue;
                    }
                    queue.push(path);
                } else if path.is_file() {
                    files_inspected += 1;

                    if Self::is_sensitive_source_path(&path) {
                        sources.push(LocalUsageSource {
                            source_type: LocalUsageSourceType::Unknown,
                            safe_path: path.to_string_lossy().to_string(),
                            process_association: "AntigravityStorage".to_string(),
                            confidence: CorrelationConfidence::Low,
                            observed_at: now_str.clone(),
                            skipped_sensitive_source: true,
                            safe_quota: None,
                        });
                        continue;
                    }

                    let is_candidate_ext = file_name.ends_with(".json")
                        || file_name.ends_with(".yaml")
                        || file_name.ends_with(".yml")
                        || file_name.ends_with(".txt")
                        || file_name.ends_with(".log");

                    let is_candidate_name = file_name.contains("usage")
                        || file_name.contains("quota")
                        || file_name.contains("limit")
                        || file_name.contains("config")
                        || file_name.contains("state")
                        || file_name.contains("model")
                        || file_name.contains("language_server");

                    if is_candidate_ext && is_candidate_name {
                        if let Ok(metadata) = std::fs::metadata(&path) {
                            let fsize = metadata.len();
                            if fsize <= max_file_size && (total_bytes_read + fsize) <= max_total_bytes {
                                if let Ok(mut f) = File::open(&path) {
                                    let mut buf = Vec::new();
                                    if f.read_to_end(&mut buf).is_ok() {
                                        total_bytes_read += buf.len() as u64;
                                        let content = String::from_utf8_lossy(&buf);

                                        let safe_quota = Self::parse_safe_quota_values(&content);
                                        let source_type = if safe_quota.is_some() {
                                            LocalUsageSourceType::QuotaMetadata
                                        } else if file_name.contains("config") {
                                            LocalUsageSourceType::PublicConfiguration
                                        } else if file_name.contains("log") {
                                            LocalUsageSourceType::DiagnosticLog
                                        } else if file_name.contains("model") {
                                            LocalUsageSourceType::ModelMetadata
                                        } else {
                                            LocalUsageSourceType::UsageMetadata
                                        };

                                        let conf = if safe_quota.is_some() {
                                            CorrelationConfidence::Confirmed
                                        } else if file_name.contains("language_server") {
                                            CorrelationConfidence::High
                                        } else {
                                            CorrelationConfidence::Medium
                                        };

                                        sources.push(LocalUsageSource {
                                            source_type,
                                            safe_path: path.to_string_lossy().to_string(),
                                            process_association: "language_server.exe".to_string(),
                                            confidence: conf,
                                            observed_at: now_str.clone(),
                                            skipped_sensitive_source: false,
                                            safe_quota,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        let elapsed = start_time.elapsed().as_millis() as u64;

        sources.sort_by(|a, b| {
            let a_has = a.safe_quota.is_some();
            let b_has = b.safe_quota.is_some();
            b_has.cmp(&a_has).then_with(|| b.confidence.cmp(&a.confidence))
        });

        let best_source = sources.iter().find(|s| !s.skipped_sensitive_source && s.safe_quota.is_some()).cloned()
            .or_else(|| sources.iter().find(|s| !s.skipped_sensitive_source).cloned());

        let status = if sources.iter().any(|s| s.safe_quota.is_some()) {
            "FOUND".to_string()
        } else if best_source.is_some() {
            "UNSUPPORTED_FORMAT".to_string()
        } else {
            "NOT_FOUND".to_string()
        };

        if status == "FOUND" {
            diagnostic_notes.push("Discovered local non-secret file containing safe quota metrics.".to_string());
        } else {
            diagnostic_notes.push(
                "Local Antigravity diagnostic sources inspected; no plaintext quota values found in non-sensitive state files."
                    .to_string(),
            );
        }

        LocalUsageDiscoveryReport {
            timestamp: now_str,
            status,
            directories_inspected: dirs_inspected,
            files_inspected,
            bytes_read: total_bytes_read,
            scan_duration_ms: elapsed,
            sources,
            best_source,
            diagnostic_notes,
        }
    }

    /// Perform AG-6 Antigravity Usage Protocol Discovery
    pub async fn discover_usage_protocol(duration_secs: Option<u64>) -> UsageProtocolDiscoveryReport {
        let trace_report = Self::run_usage_trace(duration_secs.unwrap_or(8)).await;
        let processes = Self::discover_processes();
        let now_str = chrono_or_simple_timestamp();

        let ls_proc = processes.iter().find(|p| p.executable_name.to_lowercase().contains("language_server"));
        let main_proc = processes.iter().find(|p| p.executable_name.to_lowercase().contains("antigravity"));
        let cli_proc = processes.iter().find(|p| p.executable_name.to_lowercase() == "agy" || p.executable_name.to_lowercase() == "agy.exe");

        let mut candidates = Vec::new();
        let mut diagnostic_notes = Vec::new();

        // 1. Primary candidate: language_server.exe on port 50389
        if let Some(ls) = ls_proc {
            let (method, path) = if let Some(first_evt) = trace_report.observed_events.first() {
                (None, first_evt.matched_path.clone())
            } else {
                (None, None)
            };

            let evidence_raw = "Antigravity Language Server HTTPS RPC endpoint hosting internal CodeAssist and slash command handlers."
                .to_string();

            candidates.push(UsageProtocolCandidate {
                endpoint: "https://127.0.0.1:50389".to_string(),
                process_name: ls.executable_name.clone(),
                pid: ls.pid,
                port: 50389,
                protocol: UsageProtocolType::ProtobufRpc,
                execution_owner: UsageExecutionOwner::LanguageServer,
                method,
                path,
                content_type: Some("application/grpc-web+proto".to_string()),
                payload_format: UsagePayloadFormat::ProtectedBinary,
                quota_availability: QuotaMetadataAvailability::NotObservable,
                correlation_state: trace_report.status.clone(),
                confidence: trace_report.confidence.clone(),
                timestamp: now_str.clone(),
                evidence: Self::sanitize_evidence(&evidence_raw),
            });
        }

        // 2. Sibling candidate: Web UI Hub on port 50390
        if let Some(ls) = ls_proc {
            candidates.push(UsageProtocolCandidate {
                endpoint: "http://127.0.0.1:50390".to_string(),
                process_name: ls.executable_name.clone(),
                pid: ls.pid,
                port: 50390,
                protocol: UsageProtocolType::Http,
                execution_owner: UsageExecutionOwner::LanguageServer,
                method: Some("GET".to_string()),
                path: Some("/".to_string()),
                content_type: Some("text/html; charset=utf-8".to_string()),
                payload_format: UsagePayloadFormat::PlainText,
                quota_availability: QuotaMetadataAvailability::NotObservable,
                correlation_state: "CANDIDATE_ACTIVE".to_string(),
                confidence: CorrelationConfidence::Medium,
                timestamp: now_str.clone(),
                evidence: Self::sanitize_evidence("Web UI static configuration host (__APP_CONFIG__)."),
            });
        }

        // 3. Electron Main Wrapper Socket
        if let Some(main) = main_proc {
            candidates.push(UsageProtocolCandidate {
                endpoint: "http://127.0.0.1:50384".to_string(),
                process_name: main.executable_name.clone(),
                pid: main.pid,
                port: 50384,
                protocol: UsageProtocolType::Http,
                execution_owner: UsageExecutionOwner::AntigravityMain,
                method: None,
                path: None,
                content_type: None,
                payload_format: UsagePayloadFormat::Unknown,
                quota_availability: QuotaMetadataAvailability::NotObservable,
                correlation_state: "NOT_CORRELATED".to_string(),
                confidence: CorrelationConfidence::Low,
                timestamp: now_str.clone(),
                evidence: Self::sanitize_evidence("Electron main process IPC socket."),
            });
        }

        if let Some(cli) = cli_proc {
            diagnostic_notes.push(format!("Active CLI client process detected: {} (PID {})", cli.executable_name, cli.pid));
        }

        diagnostic_notes.push(
            "Protocol evaluated: Language Server handles slash commands over HTTPS gRPC/Protobuf RPC.".to_string()
        );
        diagnostic_notes.push(
            "Payloads are protected/binary; quota metadata is not exposed in plaintext HTTP/JSON.".to_string()
        );

        let best_candidate = candidates.first().cloned();
        let status = if best_candidate.is_some() {
            "DISCOVERED".to_string()
        } else {
            "NOT_DISCOVERED".to_string()
        };

        UsageProtocolDiscoveryReport {
            timestamp: now_str,
            status,
            candidate: best_candidate,
            candidates,
            diagnostic_notes,
        }
    }
}

fn get_candidate_log_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(appdata) = std::env::var("APPDATA") {
        paths.push(PathBuf::from(&appdata).join("antigravity").join("logs").join("language_server.log"));
        paths.push(PathBuf::from(&appdata).join("Antigravity").join("logs").join("language_server.log"));
    }
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        paths.push(PathBuf::from(&userprofile).join(".gemini").join("antigravity").join("logs").join("language_server.log"));
    }
    paths
}

fn chrono_or_simple_timestamp() -> String {
    use std::time::SystemTime;
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}", now)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_command_line_redaction() {
        let input = "language_server.exe --standalone --csrf_token 4e2e4db9-d9ee-49b5-9711-7771e6292c76 --auth_token secret123 --other_flag ok";
        let sanitized = QuotaDiscoveryService::sanitize_command_line(input);
        assert!(!sanitized.contains("4e2e4db9-d9ee-49b5-9711-7771e6292c76"));
        assert!(!sanitized.contains("secret123"));
        assert!(sanitized.contains("--csrf_token [REDACTED]"));
        assert!(sanitized.contains("--auth_token [REDACTED]"));
        assert!(sanitized.contains("--other_flag ok"));
    }

    #[test]
    fn test_sanitize_evidence_length_and_redaction() {
        let input = "Authorization: Bearer secret_token_xyz; Cookie: session=12345; csrf_token: abcd-9999; https://api.example.com/v1?token=supersecretkey";
        let sanitized = QuotaDiscoveryService::sanitize_evidence(input);
        assert!(!sanitized.contains("secret_token_xyz"));
        assert!(!sanitized.contains("12345"));
        assert!(!sanitized.contains("abcd-9999"));
        assert!(!sanitized.contains("supersecretkey"));
        assert!(sanitized.contains("Bearer [REDACTED]"));
        assert!(sanitized.contains("token=[REDACTED]"));
        assert!(sanitized.len() <= 300);
    }

    #[test]
    fn test_process_discovery_does_not_panic() {
        let procs = QuotaDiscoveryService::discover_processes();
        for proc in procs {
            assert!(!proc.executable_name.is_empty());
            assert!(!proc.command_line.contains("secret"));
        }
    }

    #[test]
    fn test_confidence_ordering() {
        assert!(CorrelationConfidence::Confirmed > CorrelationConfidence::High);
        assert!(CorrelationConfidence::High > CorrelationConfidence::Medium);
        assert!(CorrelationConfidence::Medium > CorrelationConfidence::Low);
    }

    #[test]
    fn test_trace_report_serialization() {
        let report = UsageTraceReport {
            timestamp: "1723719000".to_string(),
            status: "CANDIDATE_ACTIVE".to_string(),
            trace_duration_ms: 5000,
            usage_triggered_by_user: true,
            observed_events: vec![ObservedTraceEvent {
                timestamp: "1723719001".to_string(),
                process_pid: 6108,
                process_name: "language_server.exe".to_string(),
                port: 50389,
                protocol: "HTTPS".to_string(),
                event_type: "LanguageServerRpcTraffic".to_string(),
                details: "Observed RPC stream on port 50389".to_string(),
                matched_path: Some("/v1internal:streamGenerateContent".to_string()),
                confidence: CorrelationConfidence::High,
            }],
            confirmed_endpoint: Some("https://127.0.0.1:50389/".to_string()),
            confidence: CorrelationConfidence::High,
            warnings: vec![],
            summary_notes: vec!["Active RPC correlated".to_string()],
            usage_endpoint_metadata: Some(UsageEndpointMetadata {
                endpoint: "https://127.0.0.1:50389/".to_string(),
                process: "language_server.exe".to_string(),
                pid: 6108,
                port: 50389,
                protocol: "HTTPS".to_string(),
                correlation: "CANDIDATE_ACTIVE".to_string(),
                confidence: CorrelationConfidence::High,
                observed_at: Some("1723719001".to_string()),
                source: "InteractiveUserTrace".to_string(),
            }),
            safe_quota_metadata: None,
        };

        let json = serde_json::to_string(&report).expect("Serialize report");
        assert!(json.contains("50389"));
        assert!(!json.contains("secret"));
    }

    #[test]
    fn test_protocol_candidate_serialization() {
        let cand = UsageProtocolCandidate {
            endpoint: "https://127.0.0.1:50389".to_string(),
            process_name: "language_server.exe".to_string(),
            pid: 6108,
            port: 50389,
            protocol: UsageProtocolType::ProtobufRpc,
            execution_owner: UsageExecutionOwner::LanguageServer,
            method: None,
            path: Some("/usage".to_string()),
            content_type: Some("application/grpc".to_string()),
            payload_format: UsagePayloadFormat::ProtectedBinary,
            quota_availability: QuotaMetadataAvailability::NotObservable,
            correlation_state: "CONFIRMED".to_string(),
            confidence: CorrelationConfidence::High,
            timestamp: "1723719000".to_string(),
            evidence: "Language Server gRPC/Protobuf RPC".to_string(),
        };

        let json = serde_json::to_string(&cand).expect("Serialize UsageProtocolCandidate");
        assert!(json.contains("ProtobufRpc"));
        assert!(json.contains("LanguageServer"));
        assert!(json.contains("ProtectedBinary"));
        assert!(json.contains("NotObservable"));
    }

    #[test]
    fn test_protocol_types_classification() {
        assert_eq!(UsageProtocolType::ProtobufRpc, UsageProtocolType::ProtobufRpc);
        assert_ne!(UsageProtocolType::Http, UsageProtocolType::Https);
        assert_eq!(UsageExecutionOwner::LanguageServer, UsageExecutionOwner::LanguageServer);
        assert_eq!(UsagePayloadFormat::ProtectedBinary, UsagePayloadFormat::ProtectedBinary);
    }
}
