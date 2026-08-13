use crate::policy::models::{PolicyDecision, PolicyEvaluationRequest, RiskLevel};

pub struct SecretPolicyRule;

impl SecretPolicyRule {
    pub fn evaluate(request: &PolicyEvaluationRequest) -> Option<PolicyDecision> {
        if let Some(cmd) = &request.command {
            let cmd_lower = cmd.to_lowercase();

            // 1. Environment Variable Dumping Attempts -> DENY
            if cmd_lower == "printenv"
                || cmd_lower == "env"
                || cmd_lower.contains("get-childitem env:")
                || cmd_lower.contains("dir env:")
                || cmd_lower.contains("echo %openai_api_key%")
                || cmd_lower.contains("echo $openai_api_key")
            {
                return Some(PolicyDecision::Deny {
                    risk_level: RiskLevel::Critical,
                    reason_code: "POLICY_DENY_SECRET_EXFILTRATION_RISK".to_string(),
                    message: "Environment variable extraction command blocked".to_string(),
                });
            }
        }

        if let Some(path) = &request.path {
            let path_lower = path.to_lowercase();

            // 2. Sensitive Credential File Access Attempts -> DENY
            if path_lower.ends_with(".env")
                || path_lower.contains("id_rsa")
                || path_lower.contains("credentials.json")
                || path_lower.contains("ai_credentials.dat")
            {
                return Some(PolicyDecision::Deny {
                    risk_level: RiskLevel::Critical,
                    reason_code: "POLICY_DENY_CREDENTIAL_FILE_ACCESS".to_string(),
                    message: format!("Access to sensitive file '{}' is prohibited", path),
                });
            }
        }

        None
    }
}
