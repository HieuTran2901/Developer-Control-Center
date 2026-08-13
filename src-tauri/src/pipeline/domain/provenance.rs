use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum VerificationStatus {
    Generated,
    Validating,
    StructurallyValid,
    SemanticallyValid,
    ConsistencyValidated,
    PolicyValidated,
    NeedsReview,
    Approved,
    Executing,
    ExecutionSucceeded,
    ExecutionFailed,
    Verified,
    Rejected,
}

impl Default for VerificationStatus {
    fn default() -> Self {
        VerificationStatus::Generated
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EvidenceType {
    Manifest,
    BuildWrapper,
    Script,
    Framework,
    ArtifactCandidate,
    Dependency,
    Toolchain,
    Unknown,
}

impl Default for EvidenceType {
    fn default() -> Self {
        EvidenceType::Unknown
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PipelineEvidence {
    pub evidence_id: String,
    pub component_path: String,
    #[serde(default)]
    pub evidence_type: EvidenceType,
    pub source_type: String, // "manifest", "wrapper", "script", "framework", "artifact_candidate", "dependency"
    pub source_path: String,
    pub observed_value: String,
    pub confidence: f32, // 0.0 to 1.0
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct PipelineStepProvenance {
    pub evidence_ids: Vec<String>,
    pub artifact_evidence_ids: Vec<String>,
    pub step_confidence: f32, // 0.0 to 1.0
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct PipelineProvenance {
    pub global_evidence: Vec<PipelineEvidence>,
    pub pipeline_confidence: f32, // 0.0 to 1.0, minimum of step confidences
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepVerificationResult {
    pub step_id: String,
    pub status: VerificationStatus,
    pub cwd: String,
    pub command: Option<String>,
    pub evidence_matched: Vec<String>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineVerificationReport {
    pub pipeline_id: String,
    pub pipeline_version: u32,
    pub verification_id: String,
    pub status: VerificationStatus,
    pub confidence: f32,
    pub verified_at: u64,
    pub components_checked: usize,
    pub steps: Vec<StepVerificationResult>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

pub struct ConfidenceCalculator;

impl ConfidenceCalculator {
    pub fn calculate(evidence: &[PipelineEvidence]) -> f32 {
        if evidence.is_empty() {
            return 0.0;
        }
        
        let mut total_weight = 0.0;
        let mut score = 0.0;
        
        for ev in evidence {
            let weight = match ev.evidence_type {
                EvidenceType::Manifest => 1.0,
                EvidenceType::BuildWrapper => 0.9,
                EvidenceType::Framework => 0.8,
                EvidenceType::ArtifactCandidate => 0.7,
                EvidenceType::Dependency => 0.6,
                EvidenceType::Script => 0.5,
                EvidenceType::Toolchain => 0.4,
                EvidenceType::Unknown => 0.1,
            };
            total_weight += weight;
            score += weight * ev.confidence;
        }
        
        if total_weight > 0.0 {
            (score / total_weight).clamp(0.0, 1.0)
        } else {
            0.0
        }
    }
}
