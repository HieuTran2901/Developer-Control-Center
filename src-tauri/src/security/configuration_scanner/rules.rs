use crate::security::domain::{SecurityCategory, SecurityFinding, SecuritySeverity};
use serde_yaml::Value;

pub trait ConfigRule: Send + Sync {
    fn check(&self, file_path: &str, config: &Value) -> Option<SecurityFinding>;
}

pub struct DebugModeRule;

impl ConfigRule for DebugModeRule {
    fn check(&self, file_path: &str, config: &Value) -> Option<SecurityFinding> {
        // Recursive search for `debug: true`
        if search_for_kv(config, "debug", &Value::Bool(true)) {
            Some(SecurityFinding {
                id: format!("{}:debug_mode", file_path),
                severity: SecuritySeverity::High,
                category: SecurityCategory::Configuration,
                title: "Debug Mode Enabled".to_string(),
                description: "The application is configured to run in debug mode, which can leak sensitive information.".to_string(),
                file_path: file_path.to_string(),
                line: None,
                evidence: None,
                remediation: Some("Set debug to false in production environments.".to_string()),
                scanner_id: "configuration_scanner".to_string(),
                confidence: 90,
                metadata: None,
            })
        } else {
            None
        }
    }
}

pub struct PermissiveCorsRule;

impl ConfigRule for PermissiveCorsRule {
    fn check(&self, file_path: &str, config: &Value) -> Option<SecurityFinding> {
        if search_for_kv(config, "cors", &Value::String("*".to_string()))
            || search_for_kv(
                config,
                "Access-Control-Allow-Origin",
                &Value::String("*".to_string()),
            )
        {
            Some(SecurityFinding {
                id: format!("{}:permissive_cors", file_path),
                severity: SecuritySeverity::Medium,
                category: SecurityCategory::Configuration,
                title: "Permissive CORS Policy".to_string(),
                description: "CORS is configured to allow any origin (*), which can lead to cross-origin attacks.".to_string(),
                file_path: file_path.to_string(),
                line: None,
                evidence: None,
                remediation: Some("Restrict CORS origins to known, trusted domains.".to_string()),
                scanner_id: "configuration_scanner".to_string(),
                confidence: 80,
                metadata: None,
            })
        } else {
            None
        }
    }
}

/// Helper function to recursively search for a specific key-value pair in a YAML/JSON tree.
fn search_for_kv(value: &Value, target_key: &str, target_val: &Value) -> bool {
    match value {
        Value::Mapping(map) => {
            for (k, v) in map {
                if let Value::String(s) = k {
                    // Check if key matches case-insensitively for common config keys, but exact match is fine
                    if s.eq_ignore_ascii_case(target_key) && v == target_val {
                        return true;
                    }
                }
                if search_for_kv(v, target_key, target_val) {
                    return true;
                }
            }
            false
        }
        Value::Sequence(seq) => {
            for v in seq {
                if search_for_kv(v, target_key, target_val) {
                    return true;
                }
            }
            false
        }
        _ => false,
    }
}

pub fn get_default_rules() -> Vec<Box<dyn ConfigRule>> {
    vec![Box::new(DebugModeRule), Box::new(PermissiveCorsRule)]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_debug_mode_rule() {
        let yaml_str = "debug: true\nserver: ok";
        let config: Value = serde_yaml::from_str(yaml_str).unwrap();
        let rule = DebugModeRule;
        let finding = rule.check("test.yml", &config);
        assert!(finding.is_some());
        assert_eq!(finding.unwrap().title, "Debug Mode Enabled");
    }

    #[test]
    fn test_permissive_cors_rule() {
        let yaml_str = "cors: '*'\n";
        let config: Value = serde_yaml::from_str(yaml_str).unwrap();
        let rule = PermissiveCorsRule;
        let finding = rule.check("test.yml", &config);
        assert!(finding.is_some());
    }

    #[test]
    fn test_debug_mode_nested() {
        let yaml_str = "server:\n  settings:\n    debug: true\n";
        let config: Value = serde_yaml::from_str(yaml_str).unwrap();
        let rule = DebugModeRule;
        let finding = rule.check("test.yml", &config);
        assert!(finding.is_some());
    }
}
