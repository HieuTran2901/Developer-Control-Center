use tauri::State;
use std::sync::Arc;
use crate::config::ConfigStore;
use crate::config::domain::{ProjectCIConfig, EnvironmentConfig, EnvironmentVariable};
use crate::policy::PolicyEngine;
use crate::ai::credential_store::{OsCredentialStore, CredentialStoreTrait};

#[tauri::command]
pub async fn get_project_config(
    store: State<'_, Arc<ConfigStore>>,
) -> Result<ProjectCIConfig, String> {
    Ok(store.get_config())
}

#[tauri::command]
pub async fn create_environment(
    env: EnvironmentConfig,
    store: State<'_, Arc<ConfigStore>>,
) -> Result<(), String> {
    let mut config = store.get_config();
    if config.environments.iter().any(|e| e.id == env.id || e.name == env.name) {
        return Err("Environment with same ID or Name already exists".into());
    }
    
    // Validations could go here (e.g. check duplicate variables)
    
    config.environments.push(env);
    store.save_config(config).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_environment(
    env: EnvironmentConfig,
    store: State<'_, Arc<ConfigStore>>,
    policy_engine: State<'_, Arc<PolicyEngine>>,
) -> Result<(), String> {
    let mut config = store.get_config();
    
    let existing_idx = config.environments.iter().position(|e| e.id == env.id)
        .ok_or_else(|| "Environment not found".to_string())?;
        
    let existing = &config.environments[existing_idx];
    
    if existing.is_production {
        let request = crate::policy::models::PolicyEvaluationRequest {
            execution_id: format!("env-update-{}", env.id),
            pipeline_id: "".into(),
            pipeline_version: None,
            stage_id: "".into(),
            step_id: "".into(),
            step_type: "".into(),
            environment_id: None,
            platform: None,
            action_type: crate::policy::models::ActionType::EnvironmentMutation,
            command: None,
            args: vec![],
            cwd: None,
            path: None,
            url: None,
            workspace_root: "".into(),
            policy_version: crate::policy::CURRENT_POLICY_VERSION.into(),
        };
        
        let result = policy_engine.evaluate(&request);
        match result.decision {
            crate::policy::models::PolicyDecision::Allow { .. } => {}
            crate::policy::models::PolicyDecision::RequireApproval { approval_id, prompt, .. } => {
                // In a full implementation, we'd register the approval and return the ID.
                return Err(format!("APPROVAL_REQUIRED:{}::{}", approval_id, prompt));
            }
            crate::policy::models::PolicyDecision::Deny { message, .. } => {
                return Err(format!("Policy Engine Denied: {}", message));
            }
        }
    }
    
    config.environments[existing_idx] = env;
    store.save_config(config).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_environment(
    env_id: String,
    store: State<'_, Arc<ConfigStore>>,
    policy_engine: State<'_, Arc<PolicyEngine>>,
) -> Result<(), String> {
    let mut config = store.get_config();
    
    let existing = config.environments.iter().find(|e| e.id == env_id)
        .ok_or_else(|| "Environment not found".to_string())?;
        
    if existing.is_production {
        let request = crate::policy::models::PolicyEvaluationRequest {
            execution_id: format!("env-delete-{}", env_id),
            pipeline_id: "".into(),
            pipeline_version: None,
            stage_id: "".into(),
            step_id: "".into(),
            step_type: "".into(),
            environment_id: None,
            platform: None,
            action_type: crate::policy::models::ActionType::EnvironmentMutation,
            command: None,
            args: vec![],
            cwd: None,
            path: None,
            url: None,
            workspace_root: "".into(),
            policy_version: crate::policy::CURRENT_POLICY_VERSION.into(),
        };
        
        let result = policy_engine.evaluate(&request);
        match result.decision {
            crate::policy::models::PolicyDecision::Allow { .. } => {}
            crate::policy::models::PolicyDecision::RequireApproval { approval_id, prompt, .. } => {
                return Err(format!("APPROVAL_REQUIRED:{}::{}", approval_id, prompt));
            }
            crate::policy::models::PolicyDecision::Deny { message, .. } => {
                return Err(format!("Policy Engine Denied: {}", message));
            }
        }
    }
    
    config.environments.retain(|e| e.id != env_id);
    store.save_config(config).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn set_environment_secret(
    env_id: String,
    key: String,
    plaintext_secret: String,
    store: State<'_, Arc<ConfigStore>>,
) -> Result<String, String> {
    let mut config = store.get_config();
    
    let env = config.environments.iter_mut().find(|e| e.id == env_id)
        .ok_or_else(|| "Environment not found".to_string())?;
        
    let secret_id = format!("env:{}:{}", env_id, key);
    
    // Save to OS Keyring immediately
    let cred_store = OsCredentialStore::new();
    cred_store.save_secret(&secret_id, &plaintext_secret).map_err(|e| e.to_string())?;
    
    let reference = format!("secret://{}", secret_id);
    
    // Remove existing if any
    env.variables.retain(|v| {
        match v {
            EnvironmentVariable::Plaintext { key: k, .. } => k != &key,
            EnvironmentVariable::SecretRef { key: k, .. } => k != &key,
        }
    });
    
    env.variables.push(EnvironmentVariable::SecretRef {
        key: key.clone(),
        reference: reference.clone(),
    });
    
    store.save_config(config).map_err(|e| e.to_string())?;
    
    Ok(reference)
}
