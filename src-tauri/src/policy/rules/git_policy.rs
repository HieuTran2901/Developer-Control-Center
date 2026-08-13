use crate::policy::approval::ApprovalStore;
use crate::policy::models::{ActionType, PolicyDecision, PolicyEvaluationRequest, RiskLevel};

pub struct GitPolicyRule;

impl GitPolicyRule {
    pub fn evaluate(request: &PolicyEvaluationRequest) -> Option<PolicyDecision> {
        if request.action_type != ActionType::Git {
            let is_git_cmd = request.command.as_deref().map_or(false, |c| c.trim().starts_with("git "));
            if !is_git_cmd {
                return None;
            }
        }

        let cmd_str = match &request.command {
            Some(c) => c.trim(),
            None => return None,
        };

        let cmd_lower = cmd_str.to_lowercase();

        // 1. Destructive Git Commands -> DENY
        if cmd_lower.contains("push --force")
            || cmd_lower.contains("push -f")
            || cmd_lower.contains("reset --hard")
            || cmd_lower.contains("clean -fd")
            || cmd_lower.contains("clean -f")
        {
            return Some(PolicyDecision::Deny {
                risk_level: RiskLevel::Critical,
                reason_code: "POLICY_DENY_DESTRUCTIVE_GIT_OPERATION".to_string(),
                message: format!("Destructive Git command '{}' is prohibited", cmd_str),
            });
        }

        // 2. Read-Only Commands -> ALLOW
        if cmd_lower.contains("git status")
            || cmd_lower.contains("git diff")
            || cmd_lower.contains("git log")
            || cmd_lower.contains("git branch")
            || cmd_lower.contains("git show")
        {
            return Some(PolicyDecision::Allow {
                risk_level: RiskLevel::Low,
                reason_code: "POLICY_ALLOW_GIT_READONLY".to_string(),
            });
        }

        // 3. Mutating / Remote Git Commands -> REQUIRE_APPROVAL
        if cmd_lower.contains("git add")
            || cmd_lower.contains("git commit")
            || cmd_lower.contains("git push")
            || cmd_lower.contains("git pull")
            || cmd_lower.contains("git fetch")
            || cmd_lower.contains("git checkout")
        {
            let approval_id = ApprovalStore::generate_unpredictable_approval_id();
            let fingerprint = ApprovalStore::compute_canonical_fingerprint(
                "Git",
                request.command.as_deref(),
                &request.args,
                &request.workspace_root,
                &request.policy_version,
                request.pipeline_version,
            );
            return Some(PolicyDecision::RequireApproval {
                approval_id,
                risk_level: RiskLevel::High,
                reason_code: "POLICY_REQUIRE_APPROVAL_GIT_MUTATION".to_string(),
                prompt: format!("Git command '{}' requires approval", cmd_str),
                action_fingerprint: fingerprint,
                expires_at_ms: 300_000,
            });
        }

        None
    }
}
