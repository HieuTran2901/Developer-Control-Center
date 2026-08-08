use crate::security::domain::{SecurityCategory, SecurityFinding, SecuritySeverity};
use crate::security::scanner::SecurityScanner;
use regex::Regex;
use std::fs::File;
use std::io::{Read, BufReader, BufRead};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, OnceLock};

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
        vec![
            SecretPattern {
                name: "AWS Access Key",
                regex: Regex::new(r"(?i)\b(AKIA|ASIA)[0-9A-Z]{16}\b").unwrap(),
                category: SecurityCategory::Secret,
                severity: SecuritySeverity::High,
            },
            SecretPattern {
                name: "GitHub Token",
                regex: Regex::new(r"(?i)\b(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}\b").unwrap(),
                category: SecurityCategory::Secret,
                severity: SecuritySeverity::High,
            },
            SecretPattern {
                name: "JWT Token",
                regex: Regex::new(r"eyJ[a-zA-Z0-9_-]{5,}\.eyJ[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{10,}").unwrap(),
                category: SecurityCategory::Secret,
                severity: SecuritySeverity::Medium,
            },
            SecretPattern {
                name: "Private Key",
                regex: Regex::new(r"-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----").unwrap(),
                category: SecurityCategory::Secret,
                severity: SecuritySeverity::Critical,
            },
        ]
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
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Vec<SecurityFinding>, String>> + Send>> {
        let path_buf = path.to_path_buf();
        let scanner_id = self.scanner_id().to_string();
        
        Box::pin(async move {
            // First check if cancelled
            if cancel_token.load(Ordering::Relaxed) {
                return Ok(vec![]);
            }

            let mut file = match File::open(&path_buf) {
                Ok(f) => f,
                Err(_) => return Ok(vec![]),
            };

            // Check if binary (first 1024 bytes)
            let mut buf = [0u8; 1024];
            let n = file.read(&mut buf).unwrap_or(0);
            if buf[..n].contains(&0) {
                // Binary file detected, skip
                return Ok(vec![]);
            }

            // Rewind or re-open file for reading line by line
            let file = match File::open(&path_buf) {
                Ok(f) => f,
                Err(_) => return Ok(vec![]),
            };

            let reader = BufReader::new(file);
            let patterns = get_patterns();
            let mut findings = Vec::new();
            
            // Basic context analysis: if the file is in a test folder or ends with .test.ts, we lower confidence
            let path_str = path_buf.to_string_lossy().to_string();
            let is_test = path_str.contains("test") || path_str.contains("fixture");

            for (line_idx, line_res) in reader.lines().enumerate() {
                if cancel_token.load(Ordering::Relaxed) {
                    return Ok(vec![]);
                }
                
                let line_str = match line_res {
                    Ok(l) => l,
                    Err(_) => break, // EOF or read error (e.g., unexpected binary sequence)
                };

                for pattern in patterns {
                    if pattern.regex.is_match(&line_str) {
                        let mut confidence = 90;
                        let mut severity = pattern.severity.clone();

                        if is_test {
                            confidence -= 40;
                            // Downgrade severity for test files
                            severity = SecuritySeverity::Low;
                        }

                        // Generate unique ID based on path, line, and detector
                        let id = format!("{}:{}:{}", path_str, line_idx + 1, pattern.name);
                        
                        findings.push(SecurityFinding {
                            id,
                            severity,
                            category: pattern.category.clone(),
                            title: pattern.name.to_string(),
                            description: format!("Detected possible {}", pattern.name),
                            file_path: path_str.clone(),
                            line: Some(line_idx + 1),
                            // We pass the raw line to evidence, Engine will redact it
                            evidence: Some(crate::security::domain::RedactedEvidence(line_str.trim().to_string())),
                            remediation: Some("Remove secret or move to secure environment variable".to_string()),
                            scanner_id: scanner_id.clone(),
                            confidence,
                            metadata: None,
                        });
                    }
                }
            }

            Ok(findings)
        })
    }
}
