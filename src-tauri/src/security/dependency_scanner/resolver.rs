use super::parser::RawDependency;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct ResolvedDependency {
    pub name: String,
    pub exact_version: String,
    pub is_dev: bool,
    pub unresolved: bool,
}

pub fn resolve_node_dependencies(
    manifest_deps: Vec<RawDependency>,
    lockfile_deps: Option<Vec<RawDependency>>,
) -> Vec<ResolvedDependency> {
    let mut resolved_map = HashMap::new();

    // 1. Populate with manifest dependencies as base (could be ranges like ^1.0.0)
    for dep in manifest_deps {
        resolved_map.insert(
            dep.name.clone(),
            ResolvedDependency {
                name: dep.name.clone(),
                exact_version: dep.version.clone(),
                is_dev: dep.is_dev,
                unresolved: true, // Mark as unresolved initially because manifest is usually a range
            },
        );
    }

    // 2. Override with lockfile exact versions if present
    if let Some(lock_deps) = lockfile_deps {
        for dep in lock_deps {
            let is_dev = resolved_map
                .get(&dep.name)
                .map(|d| d.is_dev)
                .unwrap_or(dep.is_dev);

            resolved_map.insert(
                dep.name.clone(),
                ResolvedDependency {
                    name: dep.name.clone(),
                    exact_version: dep.version.clone(),
                    is_dev,
                    unresolved: false, // Lockfile provides exact resolution
                },
            );
        }
    } else {
        // If no lockfile, we just use the manifest version as best effort,
        // but mark them as unresolved unless they are exact (not containing ^, ~, >, <, *)
        for (_, res) in resolved_map.iter_mut() {
            if !res.exact_version.contains('^')
                && !res.exact_version.contains('~')
                && !res.exact_version.contains('>')
                && !res.exact_version.contains('<')
                && !res.exact_version.contains('*')
            {
                res.unresolved = false;
            }
        }
    }

    resolved_map.into_values().collect()
}

pub fn resolve_maven_dependencies(manifest_deps: Vec<RawDependency>) -> Vec<ResolvedDependency> {
    let mut resolved = Vec::new();

    for dep in manifest_deps {
        let unresolved = dep.version.is_empty() || dep.version.starts_with("${");

        // At this phase, we don't fully parse maven properties, so we just pass what we have
        // or skip if totally missing/property referenced
        resolved.push(ResolvedDependency {
            name: dep.name,
            exact_version: dep.version,
            is_dev: dep.is_dev,
            unresolved,
        });
    }

    // Deduplicate
    let mut seen = HashMap::new();
    for dep in resolved {
        seen.insert(dep.name.clone(), dep);
    }

    seen.into_values().collect()
}
