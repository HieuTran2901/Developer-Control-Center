use std::fs;
use std::future::Future;
use std::path::Path;
use std::pin::Pin;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::task;

use crate::security::domain::{
    RedactedEvidence, SecurityCategory, SecurityFinding, SecuritySeverity,
};
use crate::security::scanner::SecurityScanner;
use regex::Regex;

pub struct GitSecurityScanner {
    url_regex: Regex,
}

impl GitSecurityScanner {
    pub fn new() -> Self {
        let url_regex = Regex::new(r"(?i)^\s*url\s*=\s*(https?://)([^@/\s]+)@(\S+)")
            .unwrap_or_else(|e| {
                eprintln!("[GitSecurityScanner] Failed to compile regex: {}", e);
                Regex::new(r"a^").unwrap() // match-nothing fallback regex
            });
        Self { url_regex }
    }
}

impl SecurityScanner for GitSecurityScanner {
    fn scanner_id(&self) -> &'static str {
        "git_scanner"
    }

    fn supported_categories(&self) -> Vec<SecurityCategory> {
        vec![SecurityCategory::Git]
    }

    fn scan(
        &self,
        path: &Path,
        cancel_token: Arc<AtomicBool>,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<SecurityFinding>, String>> + Send>> {
        // We only care about .git/config files
        if !path.ends_with(".git/config") && !path.ends_with(".git\\config") {
            return Box::pin(async { Ok(Vec::new()) });
        }

        let path_buf = path.to_path_buf();
        let path_str = path.to_string_lossy().into_owned();
        let url_regex = self.url_regex.clone();

        Box::pin(async move {
            let mut findings = Vec::new();

            // Offload file reading to blocking thread
            let content = match task::spawn_blocking(move || {
                // Pre-check file size to avoid OOM (e.g. max 5MB)
                if let Ok(metadata) = fs::metadata(&path_buf) {
                    if metadata.len() > 5 * 1024 * 1024 {
                        return Err("File too large".to_string());
                    }
                }

                fs::read_to_string(&path_buf).map_err(|e| e.to_string())
            })
            .await
            {
                Ok(Ok(c)) => c,
                _ => return Ok(Vec::new()), // Fail gracefully
            };

            if cancel_token.load(Ordering::Relaxed) {
                return Ok(Vec::new());
            }

            for (line_num, line) in content.lines().enumerate() {
                if cancel_token.load(Ordering::Relaxed) {
                    break;
                }

                if let Some(captures) = url_regex.captures(line) {
                    let schema = captures.get(1).map_or("", |m| m.as_str());
                    let _credentials = captures.get(2).map_or("", |m| m.as_str());
                    let rest = captures.get(3).map_or("", |m| m.as_str());

                    let redacted_url = format!("{}REDACTED@{}", schema, rest);

                    findings.push(SecurityFinding {
                        id: format!("git_remote_cred_{}_{}", path_str, line_num + 1),
                        title: "Git Remote Contains Embedded Credentials".to_string(),
                        description: "A Git remote URL appears to contain embedded authentication credentials. Credentials should be stored using a secure credential manager rather than committed to repository configuration.".to_string(),
                        severity: SecuritySeverity::High,
                        category: SecurityCategory::Git,
                        file_path: path_str.clone(),
                        line: Some(line_num + 1),
                        evidence: Some(RedactedEvidence(redacted_url)),
                        remediation: Some("Remove credentials from .git/config and use an external credential helper or SSH keys.".to_string()),
                        scanner_id: "git_scanner".to_string(),
                        confidence: 90,
                        metadata: None,
                    });
                }
            }

            Ok(findings)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[tokio::test]
    async fn test_git_security_scanner() {
        let dir_name = format!(
            "git_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()
        );
        let dir = std::env::temp_dir().join(dir_name);
        fs::create_dir_all(&dir).unwrap();
        let git_dir = dir.join(".git");
        fs::create_dir(&git_dir).unwrap();
        let config_path = git_dir.join("config");

        let config_content = r#"[core]
    repositoryformatversion = 0
    filemode = true
    bare = false
    logallrefupdates = true
[remote "origin"]
    url = https://username:password@github.com/org/repo.git
    fetch = +refs/heads/*:refs/remotes/origin/*"#;
        fs::write(&config_path, config_content).unwrap();

        let scanner = GitSecurityScanner::new();
        let token = Arc::new(AtomicBool::new(false));
        let findings = scanner.scan(&config_path, token).await.unwrap();

        assert_eq!(findings.len(), 1);
        let finding = &findings[0];
        assert_eq!(finding.category, SecurityCategory::Git);
        assert_eq!(finding.severity, SecuritySeverity::High);

        // Assert credential is redacted
        let redacted_url = finding.evidence.as_ref().unwrap().0.clone();
        assert_eq!(redacted_url, "https://REDACTED@github.com/org/repo.git");

        fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn test_git_security_scanner_clean() {
        let dir_name = format!(
            "git_test_clean_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()
        );
        let dir = std::env::temp_dir().join(dir_name);
        fs::create_dir_all(&dir).unwrap();
        let git_dir = dir.join(".git");
        fs::create_dir(&git_dir).unwrap();
        let config_path = git_dir.join("config");

        let config_content = r#"[core]
    repositoryformatversion = 0
[remote "origin"]
    url = https://github.com/org/repo.git"#;
        fs::write(&config_path, config_content).unwrap();

        let scanner = GitSecurityScanner::new();
        let token = Arc::new(AtomicBool::new(false));
        let findings = scanner.scan(&config_path, token).await.unwrap();

        assert_eq!(findings.len(), 0);

        fs::remove_dir_all(&dir).unwrap();
    }
}
