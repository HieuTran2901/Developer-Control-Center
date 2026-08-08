use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::fs;

use crate::security::domain::{SecurityFinding, SecuritySeverity, SecurityCategory, FindingMetadata, DependencyMetadata};
use crate::security::scanner::SecurityScanner;
use super::parser::{parse_package_json, parse_package_lock_json, parse_pom_xml};
use super::resolver::{resolve_node_dependencies, resolve_maven_dependencies};
use super::osv::{VulnerabilityProvider, VulnerabilityQuery};

pub struct DependencyScanner {
    provider: Arc<dyn VulnerabilityProvider>,
}

impl DependencyScanner {
    pub fn new(provider: Arc<dyn VulnerabilityProvider>) -> Self {
        Self { provider }
    }
}

impl SecurityScanner for DependencyScanner {
    fn scanner_id(&self) -> &'static str {
        "dependency_scanner"
    }

    fn supported_categories(&self) -> Vec<SecurityCategory> {
        vec![SecurityCategory::Dependency]
    }

    fn scan(
        &self,
        path: &Path,
        cancel_token: Arc<AtomicBool>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Vec<SecurityFinding>, String>> + Send>> {
        let path_buf = path.to_path_buf();
        let scanner_id = self.scanner_id().to_string();
        let provider = Arc::clone(&self.provider);

        Box::pin(async move {
            if cancel_token.load(Ordering::Relaxed) {
                return Ok(vec![]);
            }

            let file_name = match path_buf.file_name() {
                Some(name) => name.to_string_lossy().to_string(),
                None => return Ok(vec![]),
            };

            // Only process known manifest files
            if file_name != "package.json" && file_name != "package-lock.json" && file_name != "pom.xml" {
                return Ok(vec![]);
            }

            // For node.js, if we see package.json, we should try to find package-lock.json in the same dir
            // If we see package-lock.json directly, we can just process it.
            // Let's handle it such that if we hit package.json, we look for lockfile. If we hit package-lock.json, we skip it here (since it's processed by package.json).
            // This prevents double processing.
            if file_name == "package-lock.json" {
                return Ok(vec![]);
            }

            let content = match fs::read_to_string(&path_buf).await {
                Ok(c) => c,
                Err(_) => return Ok(vec![]), // Unreadable or binary (though manifest shouldn't be binary)
            };

            let mut resolved_deps = Vec::new();
            let mut ecosystem = String::new();

            if file_name == "package.json" {
                let manifest_res = parse_package_json(&content).unwrap_or_default();
                ecosystem = manifest_res.ecosystem.clone();
                
                // Try to read lockfile
                let lockfile_path = path_buf.with_file_name("package-lock.json");
                let lockfile_res = if let Ok(lock_content) = fs::read_to_string(&lockfile_path).await {
                    parse_package_lock_json(&lock_content).ok()
                } else {
                    None
                };

                resolved_deps = resolve_node_dependencies(manifest_res.dependencies, lockfile_res.map(|r| r.dependencies));
            } else if file_name == "pom.xml" {
                if let Ok(manifest_res) = parse_pom_xml(&content) {
                    ecosystem = manifest_res.ecosystem.clone();
                    resolved_deps = resolve_maven_dependencies(manifest_res.dependencies);
                }
            }

            if resolved_deps.is_empty() {
                return Ok(vec![]);
            }

            // Remove unresolved deps before sending to OSV
            let query_deps: Vec<_> = resolved_deps.into_iter().filter(|d| !d.unresolved).collect();

            if query_deps.is_empty() {
                return Ok(vec![]);
            }

            // Batch query OSV
            // Chunking OSV queries to 1000 items per request
            let mut findings = Vec::new();
            let path_str = path_buf.to_string_lossy().to_string();

            for chunk in query_deps.chunks(1000) {
                if cancel_token.load(Ordering::Relaxed) {
                    return Ok(vec![]);
                }

                let queries = chunk.iter().map(|d| VulnerabilityQuery {
                    ecosystem: ecosystem.clone(),
                    name: d.name.clone(),
                    version: d.exact_version.clone(),
                }).collect();

                let results = match provider.get_vulnerabilities(queries).await {
                    Ok(r) => r,
                    Err(_e) => {
                        // Graceful failure: don't crash the whole scan
                        // We could log this or emit a specific warning finding.
                        continue;
                    }
                };

                for result in results {
                    for vuln in result.vulns {
                        let id = format!("{}:{}:{}", path_str, result.query.name, vuln.id);
                        
                        let metadata = DependencyMetadata {
                            ecosystem: result.query.ecosystem.clone(),
                            package_name: result.query.name.clone(),
                            version: result.query.version.clone(),
                            vulnerability_id: Some(vuln.id.clone()),
                            fixed_version: None, // OSV parsing could extract fixed version, simplified here
                        };

                        findings.push(SecurityFinding {
                            id,
                            severity: SecuritySeverity::High, // Default to High for vulnerability, OSV detail could provide exact
                            category: SecurityCategory::Dependency,
                            title: vuln.id.clone(),
                            description: vuln.summary.clone().unwrap_or_else(|| "Dependency vulnerability detected".to_string()),
                            file_path: path_str.clone(),
                            line: None,
                            evidence: None, // RedactedEvidence not needed for standard metadata
                            remediation: Some("Update the dependency to a secure version".to_string()),
                            scanner_id: scanner_id.clone(),
                            confidence: 100, // Lockfile provides exact confidence
                            metadata: Some(FindingMetadata::Dependency(metadata)),
                        });
                    }
                }
            }

            Ok(findings)
        })
    }
}
