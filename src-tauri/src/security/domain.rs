use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SecurityScanMode {
    Quick,
    GitExposure,
    Full,
}

impl Default for SecurityScanMode {
    fn default() -> Self {
        Self::Full
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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
    pub aliases: Option<Vec<String>>,
    pub details: Option<String>,
    pub references: Option<Vec<String>>,
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
    Started {
        #[serde(rename = "projectId")]
        project_id: String,
        #[serde(rename = "scanId")]
        scan_id: String,
    },
    Progress {
        #[serde(rename = "scanId")]
        scan_id: String,
        #[serde(rename = "scannedFiles")]
        scanned_files: usize,
        #[serde(rename = "currentScanner")]
        current_scanner: String,
    },
    FindingsChunk {
        #[serde(rename = "scanId")]
        scan_id: String,
        findings: Vec<SecurityFinding>,
    },
    Completed {
        #[serde(rename = "scanId")]
        scan_id: String,
        summary: SecurityScanSummary,
    },
    Failed {
        #[serde(rename = "scanId")]
        scan_id: String,
        reason: String,
    },
    Cancelled {
        #[serde(rename = "scanId")]
        scan_id: String,
    },
}
