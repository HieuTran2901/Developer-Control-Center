use std::path::{Path, PathBuf};
use crate::policy::approval::ApprovalStore;
use crate::policy::models::{ActionType, PolicyDecision, PolicyEvaluationRequest, RiskLevel};

/// Filesystem Policy Rule
/// Enforces workspace boundary safety using canonicalized paths to defeat symlink,
/// Windows Junction, UNC path, and relative traversal escapes.
///
/// TOCTOU Limitation Note:
/// Path canonicalization is performed at Policy evaluation time. If an attacker or external process
/// replaces a workspace file or directory with a symlink/junction AFTER policy evaluation but BEFORE
/// StepExecutor executes the disk operation, a Time-of-Check to Time-of-Use (TOCTOU) race window exists.
/// Mitigation: Workspace subtrees must be locked or monitored during active pipeline step execution.
pub struct FilesystemPolicyRule;

impl FilesystemPolicyRule {
    pub fn verify_workspace_boundary(workspace_root: &str, path_str: &str) -> Result<bool, String> {
        let root_str = if workspace_root.trim().is_empty() { "." } else { workspace_root.trim() };
        let root = Path::new(root_str);

        // Canonicalize workspace root
        let canonical_root = match std::fs::canonicalize(root) {
            Ok(p) => p,
            Err(_) => root.to_path_buf(),
        };

        let raw_target = Path::new(path_str);
        let full_target = if raw_target.is_relative() {
            root.join(raw_target)
        } else {
            raw_target.to_path_buf()
        };

        // Canonicalize target path or walk up to nearest existing ancestor directory
        let canonical_target = if full_target.exists() {
            match std::fs::canonicalize(&full_target) {
                Ok(p) => p,
                Err(e) => return Err(format!("Canonicalization failed for path '{}': {}", path_str, e)),
            }
        } else {
            // Find nearest existing ancestor directory
            let mut nearest_existing = None;
            let mut curr = full_target.parent();
            let mut sub_components = Vec::new();

            if let Some(file_name) = full_target.file_name() {
                sub_components.push(file_name);
            }

            while let Some(parent) = curr {
                if parent.exists() {
                    nearest_existing = Some(parent);
                    break;
                } else {
                    if let Some(name) = parent.file_name() {
                        sub_components.push(name);
                    }
                    curr = parent.parent();
                }
            }

            match nearest_existing {
                Some(existing_path) => {
                    let canonical_ancestor = match std::fs::canonicalize(existing_path) {
                        Ok(p) => p,
                        Err(e) => return Err(format!("Canonicalization failed for existing ancestor of '{}': {}", path_str, e)),
                    };

                    let mut result = canonical_ancestor;
                    for component in sub_components.into_iter().rev() {
                        result = result.join(component);
                    }
                    result
                }
                None => return Err(format!("No existing ancestor directory found for path '{}'", path_str)),
            }
        };

        Ok(canonical_target.starts_with(canonical_root))
    }

    pub fn evaluate(request: &PolicyEvaluationRequest) -> Option<PolicyDecision> {
        let path_str = match &request.path {
            Some(p) if !p.trim().is_empty() => p.trim(),
            _ => return None,
        };

        // 1. Relative Traversal Check
        if path_str.contains("..") || path_str.contains("../") || path_str.contains("..\\") {
            return Some(PolicyDecision::Deny {
                risk_level: RiskLevel::Critical,
                reason_code: "POLICY_DENY_PATH_TRAVERSAL".to_string(),
                message: format!("Relative path traversal detected in '{}'", path_str),
            });
        }

        // 2. UNC Path Check
        if path_str.starts_with(r"\\") || path_str.starts_with("//") {
            return Some(PolicyDecision::Deny {
                risk_level: RiskLevel::Critical,
                reason_code: "POLICY_DENY_UNC_PATH".to_string(),
                message: "UNC network paths are prohibited".to_string(),
            });
        }

        let target_path = PathBuf::from(path_str);
        let workspace_path = PathBuf::from(&request.workspace_root);

        // 3. String & Component Workspace Boundary Check
        if target_path.is_absolute() && !target_path.starts_with(&workspace_path) {
            return Some(PolicyDecision::Deny {
                risk_level: RiskLevel::High,
                reason_code: "POLICY_DENY_PATH_OUTSIDE_WORKSPACE".to_string(),
                message: format!("Path '{}' is outside workspace root '{}'", path_str, request.workspace_root),
            });
        }

        // 4. Canonicalization Boundary Check (Defeats Symlinks & Junctions)
        match Self::verify_workspace_boundary(&request.workspace_root, path_str) {
            Ok(true) => {}
            Ok(false) => {
                return Some(PolicyDecision::Deny {
                    risk_level: RiskLevel::Critical,
                    reason_code: "POLICY_DENY_CANONICAL_PATH_OUTSIDE_WORKSPACE".to_string(),
                    message: format!("Canonical path for '{}' escapes canonical workspace root", path_str),
                });
            }
            Err(err_msg) => {
                return Some(PolicyDecision::Deny {
                    risk_level: RiskLevel::High,
                    reason_code: "POLICY_DENY_CANONICALIZATION_FAILED".to_string(),
                    message: err_msg,
                });
            }
        }

        // 5. Action Specific Evaluation
        match request.action_type {
            ActionType::FileDelete => {
                let approval_id = ApprovalStore::generate_unpredictable_approval_id();
                let fingerprint = ApprovalStore::compute_canonical_fingerprint(
                    "FileDelete",
                    None,
                    &[],
                    &request.workspace_root,
                    &request.policy_version,
                    request.pipeline_version,
                );
                Some(PolicyDecision::RequireApproval {
                    approval_id,
                    risk_level: RiskLevel::High,
                    reason_code: "POLICY_REQUIRE_APPROVAL_FILE_DELETE".to_string(),
                    prompt: format!("Deletion of path '{}' requires authorization", path_str),
                    action_fingerprint: fingerprint,
                    expires_at_ms: 300_000,
                })
            }
            ActionType::FileRead | ActionType::FileWrite | ActionType::ExportPipeline => {
                Some(PolicyDecision::Allow {
                    risk_level: RiskLevel::Low,
                    reason_code: "POLICY_ALLOW_WORKSPACE_FILE_ACCESS".to_string(),
                })
            }
            _ => None,
        }
    }
}
