use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::fs;

use super::osv::{OsvVulnerability, VulnerabilityProvider, VulnerabilityQuery};
use super::parser::{parse_package_json, parse_package_lock_json, parse_pom_xml};
use super::resolver::{resolve_maven_dependencies, resolve_node_dependencies};
use crate::security::domain::{
    DependencyMetadata, FindingMetadata, SecurityCategory, SecurityFinding, SecuritySeverity,
};
use crate::security::scanner::SecurityScanner;

fn compare_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let parse = |v: &str| -> Vec<u64> {
        v.split(|c: char| !c.is_ascii_digit())
            .filter_map(|s| s.parse::<u64>().ok())
            .collect()
    };
    
    let a_parts = parse(a);
    let b_parts = parse(b);
    
    let len = std::cmp::max(a_parts.len(), b_parts.len());
    for i in 0..len {
        let a_num = a_parts.get(i).copied().unwrap_or(0);
        let b_num = b_parts.get(i).copied().unwrap_or(0);
        match a_num.cmp(&b_num) {
            std::cmp::Ordering::Equal => continue,
            other => return other,
        }
    }
    std::cmp::Ordering::Equal
}

fn extract_fixed_version(vuln: &OsvVulnerability, query_name: &str, query_version: &str) -> Option<String> {
    if let Some(affected_list) = &vuln.affected {
        for affected in affected_list {
            if let Some(pkg) = &affected.package {
                if pkg.name != query_name {
                    continue;
                }
            }
            if let Some(ranges) = &affected.ranges {
                for range in ranges {
                    if range.r#type == "ECOSYSTEM" || range.r#type == "SEMVER" {
                        let mut is_affected = false;
                        for event in &range.events {
                            if let Some(introduced) = &event.introduced {
                                if compare_versions(query_version, introduced) != std::cmp::Ordering::Less {
                                    is_affected = true;
                                }
                            } else if let Some(fixed) = &event.fixed {
                                if is_affected {
                                    if compare_versions(query_version, fixed) == std::cmp::Ordering::Less {
                                        return Some(fixed.clone());
                                    } else {
                                        is_affected = false;
                                    }
                                }
                            } else if let Some(last_affected) = &event.last_affected {
                                if is_affected {
                                    if compare_versions(query_version, last_affected) == std::cmp::Ordering::Greater {
                                        is_affected = false;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

fn extract_severity(vuln: &OsvVulnerability) -> SecuritySeverity {
    // 1. Try standard OSV severity array
    if let Some(_severities) = &vuln.severity {
        // Note: In OSV, CVSS vectors are provided in `score`, not pre-calculated text ratings.
        // Full CVSS parsing is excluded here to avoid heavy dependencies.
        // However, if some ecosystem provides a pre-calculated rating here, we could catch it.
    }

    // 2. Try trusted database-specific severity
    if let Some(db_specific) = &vuln.database_specific {
        if let Some(sev) = db_specific.get("severity").and_then(|s| s.as_str()) {
            return match sev.to_uppercase().as_str() {
                "CRITICAL" => SecuritySeverity::Critical,
                "HIGH" => SecuritySeverity::High,
                "MODERATE" | "MEDIUM" => SecuritySeverity::Medium,
                "LOW" => SecuritySeverity::Low,
                _ => SecuritySeverity::Info,
            };
        }
    }
    
    // 3. Safe fallback: we cannot claim High if we do not know.
    // The existing SecuritySeverity enum lacks "Unknown". "Info" is the safest semantic mapping.
    SecuritySeverity::Info
}

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
    ) -> std::pin::Pin<
        Box<dyn std::future::Future<Output = Result<Vec<SecurityFinding>, String>> + Send>,
    > {
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
            if file_name != "package.json"
                && file_name != "package-lock.json"
                && file_name != "pom.xml"
            {
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
                let lockfile_res =
                    if let Ok(lock_content) = fs::read_to_string(&lockfile_path).await {
                        parse_package_lock_json(&lock_content).ok()
                    } else {
                        None
                    };

                resolved_deps = resolve_node_dependencies(
                    manifest_res.dependencies,
                    lockfile_res.map(|r| r.dependencies),
                );
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
            let query_deps: Vec<_> = resolved_deps
                .into_iter()
                .filter(|d| !d.unresolved)
                .collect();

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

                let queries = chunk
                    .iter()
                    .map(|d| VulnerabilityQuery {
                        ecosystem: ecosystem.clone(),
                        name: d.name.clone(),
                        version: d.exact_version.clone(),
                    })
                    .collect();

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

                        let fixed_version = extract_fixed_version(&vuln, &result.query.name, &result.query.version);
                        let severity = extract_severity(&vuln);

                        let mut references = None;
                        if let Some(refs) = &vuln.references {
                            let urls: Vec<String> = refs.iter().map(|r| r.url.clone()).collect();
                            if !urls.is_empty() {
                                references = Some(urls);
                            }
                        }

                        let metadata = DependencyMetadata {
                            ecosystem: result.query.ecosystem.clone(),
                            package_name: result.query.name.clone(),
                            version: result.query.version.clone(),
                            vulnerability_id: Some(vuln.id.clone()),
                            fixed_version: fixed_version.clone(),
                            aliases: vuln.aliases.clone(),
                            details: vuln.details.clone(),
                            references,
                        };

                        let remediation = if let Some(fw) = &fixed_version {
                            Some(format!("Upgrade to version {} or later.", fw))
                        } else {
                            Some("Review the advisory and upgrade to a patched version when available.".to_string())
                        };

                        findings.push(SecurityFinding {
                            id,
                            severity,
                            category: SecurityCategory::Dependency,
                            title: vuln.id.clone(),
                            description: vuln
                                .summary
                                .clone()
                                .unwrap_or_else(|| "Dependency vulnerability detected".to_string()),
                            file_path: path_str.clone(),
                            line: None,
                            evidence: None,
                            remediation,
                            scanner_id: scanner_id.clone(),
                            confidence: 100,
                            metadata: Some(FindingMetadata::Dependency(metadata)),
                        });
                    }
                }
            }

            Ok(findings)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::security::dependency_scanner::osv::{
        OsvAffected, OsvEvent, OsvPackage, OsvRange, OsvVulnerability,
    };
    use serde_json::json;

    #[test]
    fn test_extract_severity() {
        let vuln_critical = OsvVulnerability {
            id: "GHSA-1".to_string(),
            aliases: None, published: None, modified: None, withdrawn: None, summary: None, details: None, severity: None, affected: None, references: None,
            database_specific: Some(json!({"severity": "CRITICAL"})),
        };
        assert_eq!(extract_severity(&vuln_critical), SecuritySeverity::Critical);

        let vuln_missing = OsvVulnerability {
            id: "GHSA-2".to_string(),
            aliases: None, published: None, modified: None, withdrawn: None, summary: None, details: None, severity: None, affected: None, references: None,
            database_specific: None,
        };
        // Expect Info instead of High to avoid falsely claiming high severity for unknown vulnerabilities
        assert_eq!(extract_severity(&vuln_missing), SecuritySeverity::Info);
    }

    #[test]
    fn test_extract_fixed_version_complex() {
        let vuln = OsvVulnerability {
            id: "GHSA-1".to_string(),
            aliases: None, published: None, modified: None, withdrawn: None, summary: None, details: None, severity: None, references: None, database_specific: None,
            affected: Some(vec![
                OsvAffected {
                    package: Some(OsvPackage { name: "test-pkg".to_string(), ecosystem: "npm".to_string() }),
                    ranges: Some(vec![
                        OsvRange {
                            r#type: "SEMVER".to_string(),
                            events: vec![
                                OsvEvent { introduced: Some("0".to_string()), fixed: None, last_affected: None, limit: None },
                                OsvEvent { introduced: None, fixed: Some("1.2.3".to_string()), last_affected: None, limit: None },
                                OsvEvent { introduced: Some("2.0.0".to_string()), fixed: None, last_affected: None, limit: None },
                                OsvEvent { introduced: None, fixed: Some("2.3.4".to_string()), last_affected: None, limit: None },
                            ]
                        }
                    ])
                }
            ]),
        };
        // 1.1.0 is affected by first range -> fixed in 1.2.3
        assert_eq!(extract_fixed_version(&vuln, "test-pkg", "1.1.0"), Some("1.2.3".to_string()));
        // 1.5.0 is unaffected (between 1.2.3 and 2.0.0) -> returns None
        assert_eq!(extract_fixed_version(&vuln, "test-pkg", "1.5.0"), None);
        // 2.1.0 is affected by second range -> fixed in 2.3.4
        assert_eq!(extract_fixed_version(&vuln, "test-pkg", "2.1.0"), Some("2.3.4".to_string()));
        // 2.5.0 is unaffected -> None
        assert_eq!(extract_fixed_version(&vuln, "test-pkg", "2.5.0"), None);
        // Mismatching package
        assert_eq!(extract_fixed_version(&vuln, "other-pkg", "1.1.0"), None);
    }
}
