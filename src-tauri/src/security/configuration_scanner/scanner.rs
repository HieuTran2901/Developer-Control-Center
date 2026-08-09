use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use crate::security::domain::{SecurityFinding, SecurityCategory};
use crate::security::scanner::SecurityScanner;

pub struct ConfigurationScanner {}

impl ConfigurationScanner {
    pub fn new() -> Self {
        Self {}
    }
}

impl SecurityScanner for ConfigurationScanner {
    fn scanner_id(&self) -> &'static str {
        "configuration_scanner"
    }

    fn supported_categories(&self) -> Vec<SecurityCategory> {
        vec![SecurityCategory::Configuration, SecurityCategory::Environment]
    }

    fn scan(
        &self,
        path: &Path,
        cancel_token: Arc<AtomicBool>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Vec<SecurityFinding>, String>> + Send>> {
        let path_buf = path.to_path_buf();
        let rules = super::rules::get_default_rules();

        Box::pin(async move {
            if cancel_token.load(std::sync::atomic::Ordering::Relaxed) {
                return Ok(vec![]);
            }

            let ext = path_buf.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
            if ext != "json" && ext != "yml" && ext != "yaml" {
                return Ok(vec![]);
            }

            // Check file size (5MB limit)
            if let Ok(metadata) = tokio::fs::metadata(&path_buf).await {
                if metadata.len() > 5 * 1024 * 1024 {
                    return Ok(vec![]); // Skip files larger than 5MB
                }
            } else {
                return Ok(vec![]); // Cannot read metadata
            }

            let content = match tokio::fs::read_to_string(&path_buf).await {
                Ok(c) => c,
                Err(_) => return Ok(vec![]),
            };

            if cancel_token.load(std::sync::atomic::Ordering::Relaxed) {
                return Ok(vec![]);
            }

            let parsed: serde_yaml::Value = match serde_yaml::from_str(&content) {
                Ok(v) => v,
                Err(_) => return Ok(vec![]), // Ignore malformed or unparseable files
            };

            let path_str = path_buf.to_string_lossy().to_string();
            let mut findings = Vec::new();

            for rule in rules {
                if let Some(finding) = rule.check(&path_str, &parsed) {
                    findings.push(finding);
                }
            }

            Ok(findings)
        })
    }
}
