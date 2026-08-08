use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SecuritySeverity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SecurityCategory {
    Dependency,
    Secret,
    Configuration,
    Environment,
    Git,
    Permission,
    FileExposure,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SecurityScanStatus {
    Idle,
    Scanning,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactedEvidence(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum FindingMetadata {
    Dependency(DependencyMetadata),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyMetadata {
    pub ecosystem: String,
    pub package_name: String,
    pub version: String,
    pub vulnerability_id: Option<String>,
    pub fixed_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityFinding {
    pub id: String,
    pub severity: SecuritySeverity,
    pub category: SecurityCategory,
    pub title: String,
    pub description: String,
    pub file_path: String,
    pub line: Option<usize>,
    pub evidence: Option<RedactedEvidence>,
    pub remediation: Option<String>,
    pub scanner_id: String,
    pub confidence: u8, // 0 to 100
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<FindingMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SecurityScanSummary {
    pub total_findings: usize,
    pub critical: usize,
    pub high: usize,
    pub medium: usize,
    pub low: usize,
    pub info: usize,
    pub scan_duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum SecurityScanEvent {
    Started { project_id: String, scan_id: String },
    Progress { scan_id: String, scanned_files: usize, current_scanner: String },
    FindingsChunk { scan_id: String, findings: Vec<SecurityFinding> },
    Completed { scan_id: String, summary: SecurityScanSummary },
    Failed { scan_id: String, reason: String },
    Cancelled { scan_id: String },
}
