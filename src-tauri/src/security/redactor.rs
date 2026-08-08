use crate::security::domain::RedactedEvidence;
use regex::Regex;
use std::sync::OnceLock;

pub trait SecurityRedactor: Send + Sync {
    /// Redacts sensitive information from the evidence string before it is emitted.
    fn redact(&self, evidence: &str) -> RedactedEvidence;
}

pub struct DefaultRedactor;

impl DefaultRedactor {
    pub fn new() -> Self {
        Self
    }
}

static REDACT_PATTERNS: OnceLock<Vec<Regex>> = OnceLock::new();

impl SecurityRedactor for DefaultRedactor {
    fn redact(&self, evidence: &str) -> RedactedEvidence {
        let patterns = REDACT_PATTERNS.get_or_init(|| {
            vec![
                // Basic API Key / Token masking pattern
                Regex::new(r"(?i)(key|token|secret|password|passwd|pwd|sk_live)[\w\-\.=]{5,}([a-zA-Z0-9_-]{4})").unwrap(),
            ]
        });

        let mut redacted = evidence.to_string();
        
        for re in patterns {
            redacted = re.replace_all(&redacted, "$1********$2").to_string();
        }

        RedactedEvidence(redacted)
    }
}
