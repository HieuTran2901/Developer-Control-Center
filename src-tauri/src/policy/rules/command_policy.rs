use crate::policy::approval::ApprovalStore;
use crate::policy::models::{PolicyDecision, PolicyEvaluationRequest, RiskLevel};

pub struct CommandPolicyRule;

impl CommandPolicyRule {
    pub fn evaluate(request: &PolicyEvaluationRequest) -> Option<PolicyDecision> {
        let raw_cmd = match &request.command {
            Some(c) if !c.trim().is_empty() => c.trim(),
            _ => return None,
        };

        // Combine command binary and args for text pattern checks
        let mut raw_inputs: Vec<&str> = vec![raw_cmd];
        for arg in &request.args {
            raw_inputs.push(arg.as_str());
        }

        // 1. Check Newline / Carriage Return Injection & PowerShell Subshell BEFORE any other checks
        for input in &raw_inputs {
            if input.contains('\n') || input.contains('\r') {
                return Some(PolicyDecision::Deny {
                    risk_level: RiskLevel::Critical,
                    reason_code: "POLICY_DENY_NEWLINE_INJECTION".to_string(),
                    message: "Newline or carriage return characters in command or arguments are prohibited".to_string(),
                });
            }
            if input.contains("$(") {
                return Some(PolicyDecision::Deny {
                    risk_level: RiskLevel::Critical,
                    reason_code: "POLICY_DENY_POWERSHELL_SUBSHELL".to_string(),
                    message: "PowerShell subshell invocation $(...) is prohibited".to_string(),
                });
            }
        }

        // 2. Chaining / Operator Check across raw command & args BEFORE destructive check
        let operators = ["&&", "||", ";", "|", ">", ">>", "`"];
        for input in &raw_inputs {
            for op in &operators {
                if input.contains(op) {
                    return Some(PolicyDecision::Deny {
                        risk_level: RiskLevel::High,
                        reason_code: "POLICY_DENY_COMMAND_SMUGGLING".to_string(),
                        message: format!("Chained or redirected command operator '{}' is prohibited", op),
                    });
                }
            }
        }

        let full_command_str = if request.args.is_empty() {
            raw_cmd.to_string()
        } else {
            format!("{} {}", raw_cmd, request.args.join(" "))
        };
        let cmd_lower = full_command_str.to_lowercase();

        // 3. Destructive Command Detection
        if cmd_lower.contains("rm -rf")
            || (cmd_lower.contains("remove-item") && cmd_lower.contains("-recurse"))
            || cmd_lower.contains("del /s")
            || cmd_lower.contains("rmdir /s")
            || cmd_lower.contains("format ")
            || cmd_lower.contains("diskpart")
            || cmd_lower.contains("mkfs")
        {
            return Some(PolicyDecision::Deny {
                risk_level: RiskLevel::Critical,
                reason_code: "POLICY_DENY_DESTRUCTIVE_COMMAND".to_string(),
                message: format!("Destructive command pattern detected in '{}'", full_command_str),
            });
        }

        // 4. PowerShell Encoded Command / Execution Checks
        if cmd_lower.contains("-encodedcommand")
            || cmd_lower.contains("-enc ")
            || cmd_lower.contains("-e ")
            || cmd_lower.contains("invoke-expression")
            || cmd_lower.contains("iex ")
            || cmd_lower.contains("downloadstring")
            || cmd_lower.contains("cmd.exe /c")
            || cmd_lower.contains("cmd /c")
        {
            return Some(PolicyDecision::Deny {
                risk_level: RiskLevel::Critical,
                reason_code: "POLICY_DENY_ENCODED_POWERSHELL".to_string(),
                message: "Encoded PowerShell, cmd /c, or dynamic invocation is strictly prohibited".to_string(),
            });
        }

        // 5. Safe Command Whitelist Evaluation
        let is_cargo = cmd_lower.starts_with("cargo ") || cmd_lower == "cargo";
        let is_npm = cmd_lower.starts_with("npm ") || cmd_lower == "npm";

        if is_cargo {
            if cmd_lower.contains("check") || cmd_lower.contains("test") || cmd_lower.contains("build") {
                return Some(PolicyDecision::Allow {
                    risk_level: RiskLevel::Low,
                    reason_code: "POLICY_ALLOW_SAFE_CARGO_COMMAND".to_string(),
                });
            }
        }

        if is_npm {
            if cmd_lower.contains("test") || cmd_lower.contains("run build") || cmd_lower.contains("run lint") {
                return Some(PolicyDecision::Allow {
                    risk_level: RiskLevel::Low,
                    reason_code: "POLICY_ALLOW_SAFE_NPM_COMMAND".to_string(),
                });
            }
        }

        // 6. Unrecognized Executables Require Approval with Unpredictable Nonce & SHA-256 Fingerprint
        let approval_id = ApprovalStore::generate_unpredictable_approval_id();
        let fingerprint = ApprovalStore::compute_canonical_fingerprint(
            "Command",
            request.command.as_deref(),
            &request.args,
            &request.workspace_root,
            &request.policy_version,
            request.pipeline_version,
        );
        Some(PolicyDecision::RequireApproval {
            approval_id,
            risk_level: RiskLevel::High,
            reason_code: "POLICY_REQUIRE_APPROVAL_UNRECOGNIZED_BINARY".to_string(),
            prompt: format!("Command '{}' requires human authorization", full_command_str),
            action_fingerprint: fingerprint,
            expires_at_ms: 300_000,
        })
    }
}
