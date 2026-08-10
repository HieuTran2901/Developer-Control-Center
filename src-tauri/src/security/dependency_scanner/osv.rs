use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use std::future::Future;
use std::pin::Pin;

pub trait VulnerabilityProvider: Send + Sync {
    fn get_vulnerabilities(
        &self,
        queries: Vec<VulnerabilityQuery>,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<VulnerabilityResult>, String>> + Send>>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VulnerabilityQuery {
    pub ecosystem: String,
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VulnerabilityResult {
    pub query: VulnerabilityQuery,
    pub vulns: Vec<OsvVulnerability>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsvVulnerability {
    pub id: String,
    pub aliases: Option<Vec<String>>,
    pub published: Option<String>,
    pub modified: Option<String>,
    pub withdrawn: Option<String>,
    pub summary: Option<String>,
    pub details: Option<String>,
    pub severity: Option<Vec<OsvSeverity>>,
    pub affected: Option<Vec<OsvAffected>>,
    pub references: Option<Vec<OsvReference>>,
    pub database_specific: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsvSeverity {
    pub r#type: String,
    pub score: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsvAffected {
    pub package: Option<OsvPackage>,
    pub ranges: Option<Vec<OsvRange>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsvRange {
    pub r#type: String,
    pub events: Vec<OsvEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsvEvent {
    pub introduced: Option<String>,
    pub fixed: Option<String>,
    pub last_affected: Option<String>,
    pub limit: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsvReference {
    pub r#type: String,
    pub url: String,
}

// Structs for interacting with OSV API
#[derive(Serialize)]
struct OsvBatchQueryPayload {
    queries: Vec<OsvQuery>,
}

#[derive(Serialize)]
struct OsvQuery {
    package: OsvPackage,
    version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsvPackage {
    pub name: String,
    pub ecosystem: String,
}

#[derive(Deserialize)]
struct OsvBatchResponse {
    results: Vec<OsvQueryResult>,
}

#[derive(Deserialize)]
struct OsvQueryResult {
    vulns: Option<Vec<OsvVulnerability>>,
}

pub struct OsvProvider {
    client: reqwest::Client,
    cache: Arc<Mutex<HashMap<String, Vec<OsvVulnerability>>>>,
}

impl OsvProvider {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(5))
                .build()
                .unwrap_or_default(),
            cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl VulnerabilityProvider for OsvProvider {
    fn get_vulnerabilities(
        &self,
        queries: Vec<VulnerabilityQuery>,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<VulnerabilityResult>, String>> + Send>> {
        let client = self.client.clone();
        let cache = Arc::clone(&self.cache);

        Box::pin(async move {
            if queries.is_empty() {
                return Ok(Vec::new());
            }

            let mut final_results = Vec::new();
            let mut missing_queries = Vec::new();

            // 1. Check cache
            {
                let cache_lock = cache.lock().await;
                for q in &queries {
                    let cache_key = format!("{}:{}:{}", q.ecosystem, q.name, q.version);
                    if let Some(vulns) = cache_lock.get(&cache_key) {
                        final_results.push(VulnerabilityResult {
                            query: q.clone(),
                            vulns: vulns.clone(),
                        });
                    } else {
                        missing_queries.push(q.clone());
                    }
                }
            }

            if missing_queries.is_empty() {
                return Ok(final_results);
            }

            // 2. Fetch from OSV (Batch API limits to 1000 per request)
            let mut osv_payload = OsvBatchQueryPayload {
                queries: Vec::new(),
            };
            for q in &missing_queries {
                let ecosystem = match q.ecosystem.to_lowercase().as_str() {
                    "npm" => "npm",
                    "maven" => "Maven",
                    _ => &q.ecosystem,
                };

                osv_payload.queries.push(OsvQuery {
                    package: OsvPackage {
                        name: q.name.clone(),
                        ecosystem: ecosystem.to_string(),
                    },
                    version: q.version.clone(),
                });
            }

            let res = match client
                .post("https://api.osv.dev/v1/querybatch")
                .json(&osv_payload)
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) => return Err(format!("Network error: {}", e)),
            };

            if !res.status().is_success() {
                return Err(format!("OSV API returned error: {}", res.status()));
            }

            let batch_response: OsvBatchResponse = match res.json().await {
                Ok(json) => json,
                Err(e) => return Err(format!("Failed to parse OSV response: {}", e)),
            };

            if batch_response.results.len() != missing_queries.len() {
                return Err("OSV response length mismatch".to_string());
            }

            // 3. Update cache and merge results
            let mut cache_lock = cache.lock().await;
            for (i, result) in batch_response.results.into_iter().enumerate() {
                let q = &missing_queries[i];
                let mut full_vulns = Vec::new();

                if let Some(vulns) = result.vulns {
                    for v in vulns {
                        // Fetch full vulnerability details since querybatch only returns id/modified
                        let vuln_url = format!("https://api.osv.dev/v1/vulns/{}", v.id);
                        if let Ok(res) = client.get(&vuln_url).send().await {
                            if let Ok(full_vuln) = res.json::<OsvVulnerability>().await {
                                full_vulns.push(full_vuln);
                            } else {
                                full_vulns.push(v);
                            }
                        } else {
                            full_vulns.push(v);
                        }
                    }
                }

                let cache_key = format!("{}:{}:{}", q.ecosystem, q.name, q.version);
                cache_lock.insert(cache_key, full_vulns.clone());

                final_results.push(VulnerabilityResult {
                    query: q.clone(),
                    vulns: full_vulns,
                });
            }

            Ok(final_results)
        })
    }
}
