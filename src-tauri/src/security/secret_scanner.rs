use crate::security::domain::{SecurityCategory, SecurityFinding, SecuritySeverity};
use crate::security::scanner::SecurityScanner;
use regex::Regex;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, OnceLock};
use tokio::fs::File;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};

pub struct SecretPattern {
    pub name: &'static str,
    pub regex: Regex,
    pub category: SecurityCategory,
    pub severity: SecuritySeverity,
}

pub struct CoreSecretScanner;

impl CoreSecretScanner {
    pub fn new() -> Self {
        Self
    }
}

static SECRET_PATTERNS: OnceLock<Vec<SecretPattern>> = OnceLock::new();

fn get_patterns() -> &'static Vec<SecretPattern> {
    SECRET_PATTERNS.get_or_init(|| {
        let patterns_def = vec![
            (
                "AWS Access Key",
                r"(?i)\b(AKIA|ASIA)[0-9A-Z]{16}\b",
                SecurityCategory::Secret,
                SecuritySeverity::High,
            ),
            (
                "GitHub Token",
                r"(?i)\b(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}\b",
                SecurityCategory::Secret,
                SecuritySeverity::High,
            ),
            (
                "JWT Token",
                r"eyJ[a-zA-Z0-9_-]{5,}\.eyJ[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{10,}",
                SecurityCategory::Secret,
                SecuritySeverity::Medium,
            ),
            (
                "Private Key",
                r"-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----",
                SecurityCategory::Secret,
                SecuritySeverity::Critical,
            ),
            (
                "Semantic Secret",
                r#"(?i)(api_key|secret|password|passwd|token|access_key|client_secret|encryption_key)[^:=]*[:=]\s*['"]?([^'"\s]+)['"]?"#,
                SecurityCategory::Secret,
                SecuritySeverity::High,
            ),
        ];

        patterns_def
            .into_iter()
            .filter_map(|(name, pattern_str, category, severity)| {
                match Regex::new(pattern_str) {
                    Ok(regex) => Some(SecretPattern {
                        name,
                        regex,
                        category,
                        severity,
                    }),
                    Err(err) => {
                        eprintln!("[CoreSecretScanner] Failed to compile regex for {}: {}", name, err);
                        None
                    }
                }
            })
            .collect()
    })
}

impl SecurityScanner for CoreSecretScanner {
    fn scanner_id(&self) -> &'static str {
        "core_secret_scanner"
    }

    fn supported_categories(&self) -> Vec<SecurityCategory> {
        vec![SecurityCategory::Secret]
    }

    fn scan(
        &self,
        path: &Path,
        cancel_token: Arc<AtomicBool>,
    ) -> std::pin::Pin<
        Box<dyn std::future::Future<Output = Result<Vec<SecurityFinding>, String>> + Send>,
    > {
        let path_buf = path.to_path_buf();
        let scanner_id = self.scanner_id().to_string();

        Box::pin(async move {
            // First check if cancelled
            if cancel_token.load(Ordering::Relaxed) {
                return Ok(vec![]);
            }
            
            // Check file size (1MB limit for secrets)
            if let Ok(metadata) = tokio::fs::metadata(&path_buf).await {
                if metadata.len() > 1024 * 1024 {
                    return Ok(vec![]);
                }
            } else {
                return Ok(vec![]);
            }

            let mut file = match File::open(&path_buf).await {
                Ok(f) => f,
                Err(_) => return Ok(vec![]),
            };

            // Check if binary (first 1024 bytes)
            let mut buf = [0u8; 1024];
            let n = file.read(&mut buf).await.unwrap_or(0);
            if buf[..n].contains(&0) {
                // Binary file detected, skip
                return Ok(vec![]);
            }

            // Rewind or re-open file for reading line by line
            let file = match File::open(&path_buf).await {
                Ok(f) => f,
                Err(_) => return Ok(vec![]),
            };

            let reader = BufReader::new(file);
            let mut lines = reader.lines();
            
            let patterns = get_patterns();
            let mut findings = Vec::new();

            // Basic context analysis: if the file is in a test folder or ends with .test.ts, we lower confidence
            let path_str = path_buf.to_string_lossy().to_string();
            let is_test = path_str.contains("test") || path_str.contains("fixture");

            let mut line_idx = 0;
            while let Ok(Some(line_str)) = lines.next_line().await {
                if cancel_token.load(Ordering::Relaxed) {
                    return Ok(vec![]);
                }

                for pattern in patterns {
                    if let Some(caps) = pattern.regex.captures(&line_str) {
                        let mut confidence: u8 = 90;
                        let mut severity = pattern.severity.clone();

                        if pattern.name == "Semantic Secret" {
                            if let Some(val_match) = caps.get(2) {
                                let val = val_match.as_str().to_lowercase();
                                if val.is_empty()
                                    || val.contains("test")
                                    || val.contains("example")
                                    || val.contains("dummy")
                                    || val.contains("placeholder")
                                    || val.contains("changeme")
                                    || val.contains("change_me")
                                    || val.contains("your_key")
                                    || val.contains("your-secret")
                                    || val.starts_with('<')
                                    || val == "null"
                                    || val == "undefined"
                                {
                                    severity = SecuritySeverity::Info;
                                    confidence = 30;
                                } else if val.len() < 8 {
                                    severity = SecuritySeverity::Low;
                                    confidence = 40;
                                }
                            }
                        }

                        if is_test {
                            confidence = confidence.saturating_sub(40);
                            if severity == SecuritySeverity::High || severity == SecuritySeverity::Critical {
                                severity = SecuritySeverity::Low;
                            }
                        }

                        // Generate unique ID based on path, line, and detector
                        let id = format!("{}:{}:{}", path_str, line_idx + 1, pattern.name);

                        let match_range = caps.get(0).map(|m| (m.start(), m.end()));
                        let raw_evidence = crate::security::evidence::extract_bounded_evidence(
                            &line_str,
                            match_range,
                            crate::security::evidence::DEFAULT_MAX_EVIDENCE_LENGTH,
                        );

                        findings.push(SecurityFinding {
                            id,
                            severity,
                            category: pattern.category.clone(),
                            title: pattern.name.to_string(),
                            description: format!("Detected possible {}", pattern.name),
                            file_path: path_str.clone(),
                            line: Some(line_idx + 1),
                            // We pass the bounded line to evidence, Engine will redact and bound it
                            evidence: Some(crate::security::domain::RedactedEvidence(raw_evidence)),
                            remediation: Some(
                                "Remove secret or move to secure environment variable".to_string(),
                            ),
                            scanner_id: scanner_id.clone(),
                            confidence,
                            metadata: None,
                        });
                    }
                }
                
                line_idx += 1;
            }

            Ok(findings)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_regex_initialization_no_panic() {
        let patterns = get_patterns();
        assert!(!patterns.is_empty());
        assert!(patterns.iter().any(|p| p.name == "Semantic Secret"));
    }

    #[test]
    fn test_semantic_secret_positive_and_false_positive() {
        let patterns = get_patterns();
        let semantic = patterns.iter().find(|p| p.name == "Semantic Secret").unwrap();

        // Positive match
        let caps = semantic.regex.captures("API_KEY=prod_live_secret_key_12345");
        assert!(caps.is_some());
        assert_eq!(caps.unwrap().get(2).unwrap().as_str(), "prod_live_secret_key_12345");

        // Quoted match
        let caps_quoted = semantic.regex.captures("SECRET=\"my_super_secret_value\"");
        assert!(caps_quoted.is_some());
        assert_eq!(caps_quoted.unwrap().get(2).unwrap().as_str(), "my_super_secret_value");

        // False positive check (handled via severity/confidence adjustment logic)
        let caps_dummy = semantic.regex.captures("PASSWORD=changeme");
        assert!(caps_dummy.is_some());
        assert_eq!(caps_dummy.unwrap().get(2).unwrap().as_str(), "changeme");
    }

    #[test]
    fn test_all_detector_patterns() {
        let patterns = get_patterns();

        // AWS
        let aws = patterns.iter().find(|p| p.name == "AWS Access Key").unwrap();
        assert!(aws.regex.is_match("AKIAIOSFODNN7EXAMPLE"));

        // GitHub Token
        let gh = patterns.iter().find(|p| p.name == "GitHub Token").unwrap();
        assert!(gh.regex.is_match("ghp_123456789012345678901234567890123456"));

        // JWT
        let jwt = patterns.iter().find(|p| p.name == "JWT Token").unwrap();
        assert!(jwt.regex.is_match("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"));

        // Private Key
        let pk = patterns.iter().find(|p| p.name == "Private Key").unwrap();
        assert!(pk.regex.is_match("-----BEGIN RSA PRIVATE KEY-----"));
    }

    #[tokio::test]
    async fn test_minified_line_bounded_evidence() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("bundle.js");

        let prefix = "console.log(1);".repeat(1000); // 15,000 chars
        let secret = "const API_KEY=\"sk_live_12345678901234567890\";";
        let suffix = "console.log(2);".repeat(1000); // 15,000 chars
        let long_line = format!("{}{}{}", prefix, secret, suffix);
        tokio::fs::write(&file_path, &long_line).await.unwrap();

        let scanner = CoreSecretScanner::new();
        let cancel_token = Arc::new(AtomicBool::new(false));
        let findings = scanner.scan(&file_path, cancel_token).await.unwrap();

        assert!(!findings.is_empty());
        let finding = &findings[0];
        let ev = finding.evidence.as_ref().unwrap();
        assert!(ev.0.chars().count() <= crate::security::evidence::DEFAULT_MAX_EVIDENCE_LENGTH);
        assert!(ev.0.contains("API_KEY="));
    }
}


