use serde_json::Value;

#[derive(Debug, Clone)]
pub struct RawDependency {
    pub name: String,
    pub version: String,
    pub is_dev: bool,
}

#[derive(Debug, Clone, Default)]
pub struct ManifestParseResult {
    pub dependencies: Vec<RawDependency>,
    pub ecosystem: String,
}

pub fn parse_package_json(content: &str) -> Result<ManifestParseResult, String> {
    let json: Value = serde_json::from_str(content)
        .map_err(|e| format!("Failed to parse package.json: {}", e))?;

    let mut dependencies = Vec::new();

    let parse_deps = |deps: Option<&Value>, is_dev: bool, out: &mut Vec<RawDependency>| {
        if let Some(obj) = deps.and_then(|v| v.as_object()) {
            for (k, v) in obj {
                if let Some(version) = v.as_str() {
                    out.push(RawDependency {
                        name: k.clone(),
                        version: version.to_string(),
                        is_dev,
                    });
                }
            }
        }
    };

    parse_deps(json.get("dependencies"), false, &mut dependencies);
    parse_deps(json.get("devDependencies"), true, &mut dependencies);
    parse_deps(json.get("optionalDependencies"), false, &mut dependencies);
    parse_deps(json.get("peerDependencies"), false, &mut dependencies);

    Ok(ManifestParseResult {
        dependencies,
        ecosystem: "npm".to_string(),
    })
}

pub fn parse_package_lock_json(content: &str) -> Result<ManifestParseResult, String> {
    let json: Value = serde_json::from_str(content)
        .map_err(|e| format!("Failed to parse package-lock.json: {}", e))?;

    let mut dependencies = Vec::new();

    // v2/v3 support
    if let Some(packages) = json.get("packages").and_then(|v| v.as_object()) {
        for (k, v) in packages {
            if k.is_empty() {
                continue; // Root package
            }
            
            // For v3, name is usually derived from the key (e.g. "node_modules/foo")
            let name = k.split("node_modules/").last().unwrap_or(k).to_string();
            
            if let Some(version) = v.get("version").and_then(|v| v.as_str()) {
                let is_dev = v.get("dev").and_then(|d| d.as_bool()).unwrap_or(false);
                dependencies.push(RawDependency {
                    name,
                    version: version.to_string(),
                    is_dev,
                });
            }
        }
    } else if let Some(deps) = json.get("dependencies").and_then(|v| v.as_object()) {
        // v1 support
        for (k, v) in deps {
            if let Some(version) = v.get("version").and_then(|v| v.as_str()) {
                let is_dev = v.get("dev").and_then(|d| d.as_bool()).unwrap_or(false);
                dependencies.push(RawDependency {
                    name: k.clone(),
                    version: version.to_string(),
                    is_dev,
                });
            }
        }
    }

    Ok(ManifestParseResult {
        dependencies,
        ecosystem: "npm".to_string(),
    })
}

pub fn parse_pom_xml(content: &str) -> Result<ManifestParseResult, String> {
    use quick_xml::events::Event;
    use quick_xml::Reader;

    let mut reader = Reader::from_str(content);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut dependencies = Vec::new();

    let mut in_dependency = false;
    let mut current_tag = String::new();

    let mut current_group = String::new();
    let mut current_artifact = String::new();
    let mut current_version = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if name == "dependency" {
                    in_dependency = true;
                    current_group.clear();
                    current_artifact.clear();
                    current_version.clear();
                }
                current_tag = name;
            }
            Ok(Event::Text(e)) => {
                if in_dependency {
                    let text = String::from_utf8_lossy(e.as_ref()).to_string();
                    match current_tag.as_str() {
                        "groupId" => current_group = text,
                        "artifactId" => current_artifact = text,
                        "version" => current_version = text,
                        _ => {}
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if name == "dependency" {
                    in_dependency = false;
                    
                    // Maven version could be missing (inherited or dependencyManagement)
                    if !current_group.is_empty() && !current_artifact.is_empty() {
                        dependencies.push(RawDependency {
                            name: format!("{}:{}", current_group, current_artifact),
                            version: current_version.clone(),
                            is_dev: false,
                        });
                    }
                }
                current_tag.clear();
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("XML Error at position {}: {:?}", reader.buffer_position(), e)),
            _ => (),
        }
        buf.clear();
    }

    Ok(ManifestParseResult {
        dependencies,
        ecosystem: "maven".to_string(),
    })
}
