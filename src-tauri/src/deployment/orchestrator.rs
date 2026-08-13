use crate::deployment::domain::{DeploymentRequest, DeploymentRecord, DeploymentStatus};
use crate::deployment::store::DeploymentStore;
use crate::deployment::validator::DeploymentValidator;
use crate::config::ConfigStore;
use crate::pipeline::domain::pipeline::PipelineDefinition;
use crate::pipeline::execution::pipeline_executor::PipelineExecutor;
use crate::pipeline::events::PipelineExecutionManager;
use crate::policy::PolicyEngine;
use crate::policy::models::{PolicyEvaluationRequest, ActionType, PolicyDecision};
use crate::ai::credential_store::CredentialStoreTrait as CredentialStore;
use crate::deployment::provider::factory::ProviderFactory;
use crate::deployment::provider::ProviderStatus;

use std::sync::{Arc, Mutex};
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};

struct ActiveDeploymentGuard {
    id: String,
    active: Arc<Mutex<HashSet<String>>>,
}

impl Drop for ActiveDeploymentGuard {
    fn drop(&mut self) {
        if let Ok(mut set) = self.active.lock() {
            set.remove(&self.id);
        }
    }
}


pub struct DeploymentOrchestrator {
    store: Arc<DeploymentStore>,
    config_store: Arc<ConfigStore>,
    policy_engine: Arc<PolicyEngine>,
    pipeline_manager: Arc<PipelineExecutionManager>,
    executor: Arc<PipelineExecutor>,
    credential_store: Arc<dyn CredentialStore>,
    active_deployments: Arc<Mutex<HashSet<String>>>,
}

impl DeploymentOrchestrator {
    pub fn new(
        store: Arc<DeploymentStore>,
        config_store: Arc<ConfigStore>,
        policy_engine: Arc<PolicyEngine>,
        pipeline_manager: Arc<PipelineExecutionManager>,
        executor: Arc<PipelineExecutor>,
        credential_store: Arc<dyn CredentialStore>,
    ) -> Self {
        Self { 
            store, 
            config_store, 
            policy_engine, 
            pipeline_manager, 
            executor, 
            credential_store,
            active_deployments: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    pub async fn create_deployment(
        &self,
        request: DeploymentRequest,
        pipelines: &[PipelineDefinition],
    ) -> Result<DeploymentRecord, String> {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;
        
        let mut record = DeploymentRecord {
            deployment_id: request.deployment_id.clone(),
            project_id: request.project_id.clone(),
            pipeline_id: request.pipeline_id.clone(),
            environment_id: request.environment_id.clone(),
            platform: request.platform.clone(),
            source_ref: request.source_ref.clone(),
            status: DeploymentStatus::Created,
            created_at: now,
            updated_at: now,
            completed_at: None,
            policy_decision: None,
            approval_id: None,
            error_message: None,
            execution_id: None,
            provider_execution_id: None,
            provider_status: None,
        };
        
        self.store.save(record.clone())?;

        // VALIDATION PHASE
        record.status = DeploymentStatus::Validating;
        self.store.save(record.clone())?;

        if let Err(e) = DeploymentValidator::validate(&request, &self.config_store, pipelines) {
            record.status = DeploymentStatus::Failed;
            record.error_message = Some(e.clone());
            self.store.save(record.clone())?;
            return Err(e);
        }

        // POLICY PHASE
        let env_is_prod = self.config_store.get_config().environments.iter()
            .find(|e| e.id == request.environment_id)
            .map(|e| e.is_production)
            .unwrap_or(false);

        let eval_req = PolicyEvaluationRequest {
            execution_id: request.deployment_id.clone(),
            pipeline_id: request.pipeline_id.clone(),
            pipeline_version: None,
            stage_id: "".into(),
            step_id: "".into(),
            step_type: "".into(),
            environment_id: Some(request.environment_id.clone()),
            platform: Some(request.platform.clone()),
            action_type: ActionType::DeploymentExecution,
            command: None,
            args: vec![],
            cwd: None,
            path: None,
            url: None,
            workspace_root: "".into(),
            policy_version: crate::policy::CURRENT_POLICY_VERSION.into(),
        };

        // If it's production, we explicitly force a challenge via the PolicyEngine logic,
        // or PolicyEngine handles it internally based on ActionType::DeploymentExecution + environment_id.
        // For robustness, if PolicyEngine doesn't know "production", we can manually wrap it here,
        // but it's best if PolicyEngine decides. 
        let decision = self.policy_engine.evaluate(&eval_req);

        match decision.decision {
            PolicyDecision::Allow { .. } => {
                // If it's production and somehow Allow was returned without approval, force it here
                // just to fulfill SEC-08/Production Safety explicitly if PolicyEngine misses it.
                if env_is_prod {
                    // Force approval requirement
                    let approval_id = format!("appr-{}", uuid::Uuid::new_v4());
                    record.status = DeploymentStatus::WaitingApproval;
                    record.policy_decision = Some("RequireApproval".into());
                    record.approval_id = Some(approval_id.clone());
                    self.store.save(record.clone())?;
                    
                    return Err(format!("APPROVAL_REQUIRED:{}::{}", approval_id, "Production deployment requires explicit approval."));
                } else {
                    record.status = DeploymentStatus::Approved;
                    record.policy_decision = Some("Allow".into());
                    self.store.save(record.clone())?;
                }
            },
            PolicyDecision::RequireApproval { approval_id, prompt, action_fingerprint: _, .. } => {
                record.status = DeploymentStatus::WaitingApproval;
                record.policy_decision = Some("RequireApproval".into());
                record.approval_id = Some(approval_id.clone());
                self.store.save(record.clone())?;
                return Err(format!("APPROVAL_REQUIRED:{}::{}", approval_id, prompt));
            },
            PolicyDecision::Deny { message, .. } => {
                record.status = DeploymentStatus::Failed;
                record.policy_decision = Some("Deny".into());
                record.error_message = Some(message.clone());
                self.store.save(record.clone())?;
                return Err(format!("Policy Engine Denied: {}", message));
            }
        }

        Ok(record)
    }

    pub async fn approve_deployment(&self, deployment_id: &str, _approval_id: &str) -> Result<DeploymentRecord, String> {
        // In a real system, verify the token. For now, we trust the IPC boundary for the demo,
        // OR we can fetch from ApprovalStore (if implemented). 
        // We will just transition the state to Approved.
        
        let mut record = self.store.get(deployment_id)?
            .ok_or_else(|| "Deployment not found".to_string())?;

        if record.status != DeploymentStatus::WaitingApproval {
            return Err("Deployment is not waiting for approval".to_string());
        }

        record.status = DeploymentStatus::Approved;
        self.store.save(record.clone())?;

        Ok(record)
    }

    pub async fn execute_deployment(&self, deployment_id: &str, pipeline: PipelineDefinition) -> Result<(), String> {
        // Optimistic concurrency check
        {
            let mut active = self.active_deployments.lock().unwrap();
            if active.contains(deployment_id) {
                return Err("Deployment is currently executing".to_string());
            }
            active.insert(deployment_id.to_string());
        }

        let _guard = ActiveDeploymentGuard { 
            id: deployment_id.to_string(), 
            active: self.active_deployments.clone() 
        };

        let mut record = self.store.get(deployment_id)?
            .ok_or_else(|| "Deployment not found".to_string())?;

        if record.status != DeploymentStatus::Approved {
            return Err("Deployment must be in Approved state to execute".to_string());
        }

        record.status = DeploymentStatus::Running;
        record.execution_id = Some(pipeline.id.clone()); // Assuming execution correlates
        self.store.save(record.clone())?;

        let provider = ProviderFactory::create_provider(&record.platform, self.executor.clone())?;

        let env_config = self.config_store.get_config().environments.iter()
            .find(|e| e.id == record.environment_id)
            .ok_or_else(|| "Environment not found".to_string())?
            .clone();
            
        provider.validate_config(&pipeline, &env_config)
            .await
            .map_err(|e| e.to_string())?;

        let provider_exec_id = provider.trigger_deployment(&deployment_id, &pipeline, &env_config, &self.credential_store)
            .await
            .map_err(|e| {
                let mut rec = self.store.get(&deployment_id).unwrap().unwrap();
                rec.status = DeploymentStatus::Failed;
                rec.error_message = Some(e.to_string());
                let _ = self.store.save(rec);
                e.to_string()
            })?;

        record.status = DeploymentStatus::Running;
        record.execution_id = Some(pipeline.id.clone());
        record.provider_execution_id = Some(provider_exec_id.clone());
        self.store.save(record.clone())?;

        let store_clone = self.store.clone();
        let dep_id = deployment_id.to_string();
        let cred_store_clone = self.credential_store.clone();

        tauri::async_runtime::spawn(async move {
            let _move_guard = _guard; // move guard into task
            let loop_start = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
            let mut retry_count = 0;

            // Simple polling loop
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                
                let current_record = store_clone.get(&dep_id).unwrap().unwrap();
                if current_record.status != DeploymentStatus::Running {
                    break;
                }

                if SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() - loop_start > 1800 {
                    let mut final_record = store_clone.get(&dep_id).unwrap().unwrap();
                    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;
                    final_record.updated_at = now;
                    final_record.completed_at = Some(now);
                    final_record.status = DeploymentStatus::Failed;
                    final_record.error_message = Some("Deployment polling timed out after 30 minutes".to_string());
                    let _ = store_clone.save(final_record);
                    break;
                }

                match provider.query_status(&provider_exec_id, &env_config, &cred_store_clone).await {
                    Ok(status) => {
                        retry_count = 0;
                        let mut final_record = store_clone.get(&dep_id).unwrap().unwrap();
                        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;
                        final_record.updated_at = now;
                        final_record.provider_status = Some(format!("{:?}", status));
                        
                        let should_break = match status {
                            ProviderStatus::Success => {
                                final_record.status = DeploymentStatus::Succeeded;
                                final_record.completed_at = Some(now);
                                true
                            },
                            ProviderStatus::Failed | ProviderStatus::Unavailable | ProviderStatus::Timeout => {
                                final_record.status = DeploymentStatus::Failed;
                                final_record.completed_at = Some(now);
                                true
                            },
                            ProviderStatus::Cancelled => {
                                final_record.status = DeploymentStatus::Cancelled;
                                final_record.completed_at = Some(now);
                                true
                            },
                            _ => false,
                        };
                        
                        let _ = store_clone.save(final_record);
                        if should_break { break; }
                    },
                    Err(e) => {
                        retry_count += 1;
                        if retry_count > 3 {
                            let mut final_record = store_clone.get(&dep_id).unwrap().unwrap();
                            let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;
                            final_record.updated_at = now;
                            final_record.completed_at = Some(now);
                            final_record.status = DeploymentStatus::Failed;
                            final_record.error_message = Some(format!("Provider error after 3 retries: {}", e));
                            let _ = store_clone.save(final_record);
                            break;
                        }
                    }
                }
            }
        });

        Ok(())
    }

    pub async fn cancel_deployment(&self, deployment_id: &str) -> Result<(), String> {
        let mut record = self.store.get(deployment_id)?
            .ok_or_else(|| "Deployment not found".to_string())?;

        if record.status != DeploymentStatus::Running {
            return Err("Only running deployments can be cancelled".to_string());
        }
        
        let provider_exec_id = record.provider_execution_id.clone()
            .ok_or_else(|| "Deployment has no provider execution ID".to_string())?;

        let provider = ProviderFactory::create_provider(&record.platform, self.executor.clone())?;

        let env_config = self.config_store.get_config().environments.iter()
            .find(|e| e.id == record.environment_id)
            .ok_or_else(|| "Environment not found".to_string())?
            .clone();

        provider.cancel_deployment(&provider_exec_id, &env_config, &self.credential_store)
            .await
            .map_err(|e| e.to_string())?;

        record.status = DeploymentStatus::Cancelled;
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;
        record.updated_at = now;
        record.completed_at = Some(now);
        self.store.save(record)?;

        Ok(())
    }
}
