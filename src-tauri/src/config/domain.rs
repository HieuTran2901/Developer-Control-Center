use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCIConfig {
    pub environments: Vec<EnvironmentConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentConfig {
    pub id: String,
    pub name: String,
    pub is_production: bool,
    pub variables: Vec<EnvironmentVariable>,
    pub runtime: Option<RuntimeConfig>,
    pub build: Option<BuildConfig>,
    pub test: Option<TestConfig>,
    pub deploy: Option<DeployConfig>,
    #[serde(default)]
    pub deployment_targets: Vec<DeploymentTarget>,
    #[serde(default)]
    pub external_services: Vec<ExternalService>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum EnvironmentVariable {
    Plaintext { key: String, value: String },
    SecretRef { key: String, reference: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeConfig {
    pub image: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BuildConfig {
    pub command: String,
    pub output_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TestConfig {
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeployConfig {
    pub command: String,
    pub target_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentTarget {
    pub id: String,
    pub provider: String,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalService {
    pub id: String,
    pub service_type: String, // e.g. "database", "redis"
    pub url: String,
}
