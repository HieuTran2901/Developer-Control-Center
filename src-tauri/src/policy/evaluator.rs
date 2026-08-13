use std::time::{SystemTime, UNIX_EPOCH};
use crate::policy::models::{PolicyDecision, PolicyEvaluationRequest, PolicyEvaluationResult, RiskLevel};
use crate::policy::rules::command_policy::CommandPolicyRule;
use crate::policy::rules::filesystem_policy::FilesystemPolicyRule;
use crate::policy::rules::git_policy::GitPolicyRule;
use crate::policy::rules::network_policy::NetworkPolicyRule;
use crate::policy::rules::secret_policy::SecretPolicyRule;

pub struct PolicyEvaluator;

impl PolicyEvaluator {
    pub fn evaluate(request: &PolicyEvaluationRequest) -> PolicyEvaluationResult {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        // 1. Validate request
        if request.step_id.trim().is_empty() || request.pipeline_id.trim().is_empty() {
            return PolicyEvaluationResult {
                decision: PolicyDecision::Deny {
                    risk_level: RiskLevel::Critical,
                    reason_code: "POLICY_DENY_INVALID_REQUEST".to_string(),
                    message: "Malformed or empty policy evaluation request".to_string(),
                },
                evaluated_at_ms: now_ms,
                policy_version: request.policy_version.clone(),
            };
        }

        // 2. Secret Policy Rule
        if let Some(decision) = SecretPolicyRule::evaluate(request) {
            return PolicyEvaluationResult {
                decision,
                evaluated_at_ms: now_ms,
                policy_version: request.policy_version.clone(),
            };
        }

        // 3. Filesystem Policy Rule
        if let Some(decision) = FilesystemPolicyRule::evaluate(request) {
            return PolicyEvaluationResult {
                decision,
                evaluated_at_ms: now_ms,
                policy_version: request.policy_version.clone(),
            };
        }

        // 4. Git Policy Rule
        if let Some(decision) = GitPolicyRule::evaluate(request) {
            return PolicyEvaluationResult {
                decision,
                evaluated_at_ms: now_ms,
                policy_version: request.policy_version.clone(),
            };
        }

        // 5. Command Policy Rule
        if let Some(decision) = CommandPolicyRule::evaluate(request) {
            return PolicyEvaluationResult {
                decision,
                evaluated_at_ms: now_ms,
                policy_version: request.policy_version.clone(),
            };
        }

        // 6. Network Policy Rule
        if let Some(decision) = NetworkPolicyRule::evaluate(request) {
            return PolicyEvaluationResult {
                decision,
                evaluated_at_ms: now_ms,
                policy_version: request.policy_version.clone(),
            };
        }

        // 7. Mock Step Handling -> ALLOW Low Risk
        if request.step_type == "mock" || request.step_type == "Mock" {
            return PolicyEvaluationResult {
                decision: PolicyDecision::Allow {
                    risk_level: RiskLevel::Low,
                    reason_code: "POLICY_ALLOW_SAFE_MOCK_STEP".to_string(),
                },
                evaluated_at_ms: now_ms,
                policy_version: request.policy_version.clone(),
            };
        }

        // 8. Deny-by-Default Fallback
        PolicyEvaluationResult {
            decision: PolicyDecision::Deny {
                risk_level: RiskLevel::High,
                reason_code: "POLICY_DENY_UNMATCHED_POLICY".to_string(),
                message: format!("No policy rule matched action type '{:?}' or step '{:?}'", request.action_type, request.step_type),
            },
            evaluated_at_ms: now_ms,
            policy_version: request.policy_version.clone(),
        }
    }
}
