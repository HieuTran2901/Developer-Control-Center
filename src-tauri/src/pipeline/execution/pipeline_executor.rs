use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(not(test))]
use tauri::Emitter;

use crate::ai::AIGateway;
use crate::pipeline::domain::{PipelineDefinition, PipelineError, PipelineStatus, PipelineStepType, StepConfig};
use crate::pipeline::execution::context::PipelineExecutionContext;
use crate::pipeline::execution::state_machine::{StageStatus, StepStatus};
use crate::pipeline::executor::{StepExecutor, MockStepExecutor, AiStepExecutor};
use crate::pipeline::events::{PipelineEvent, PipelineExecutionManager};
use crate::policy::{ActionType, PolicyDecision, PolicyEngine, PolicyEvaluationRequest};

pub struct PipelineExecutor {
    ai_gateway: Option<Arc<AIGateway>>,
    app_handle: Option<tauri::AppHandle>,
    manager: Arc<PipelineExecutionManager>,
    policy_engine: Arc<PolicyEngine>,
    history_store: Option<Arc<crate::pipeline::history::PipelineHistoryStore>>,
}

impl PipelineExecutor {
    pub fn new(
        ai_gateway: Option<Arc<AIGateway>>,
        app_handle: Option<tauri::AppHandle>,
        manager: Arc<PipelineExecutionManager>,
    ) -> Self {
        Self {
            ai_gateway,
            app_handle,
            manager,
            policy_engine: Arc::new(PolicyEngine::new()),
            history_store: None,
        }
    }

    pub fn with_policy_engine(mut self, policy_engine: Arc<PolicyEngine>) -> Self {
        self.policy_engine = policy_engine;
        self
    }

    pub fn with_history_store(mut self, history_store: Arc<crate::pipeline::history::PipelineHistoryStore>) -> Self {
        self.history_store = Some(history_store);
        self
    }

    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    fn emit_event(&self, _event: PipelineEvent) {
        #[cfg(not(test))]
        {
            if let Some(ref app) = self.app_handle {
                let _ = app.emit("pipeline_event", _event);
            }
        }
    }

    pub async fn execute(&self, pipeline: &PipelineDefinition) -> Result<Arc<PipelineExecutionContext>, PipelineError> {
        let context = Arc::new(PipelineExecutionContext::new(pipeline.id.clone()));
        
        self.manager.register_execution(context.clone());

        if let Err(err) = crate::pipeline::domain::validate_pipeline(pipeline) {
            let _ = context.transition_pipeline_status(PipelineStatus::Failed);
            
            let seq = self.manager.next_sequence_number(&context.execution_id);
            self.emit_event(PipelineEvent::PipelineFailed {
                execution_id: context.execution_id.clone(),
                error_code: "VALIDATION_FAILED".into(),
                error_message: context.sanitize(&format!("{}", err)),
                stage_id: None,
                step_id: None,
                timestamp: Self::now_ms(),
                sequence_number: seq,
            });
            self.manager.mark_completed(&context.execution_id);
            return Err(err);
        }

        if pipeline.verification_status != crate::pipeline::domain::provenance::VerificationStatus::Verified {
            let _ = context.transition_pipeline_status(PipelineStatus::Failed);
            
            let seq = self.manager.next_sequence_number(&context.execution_id);
            self.emit_event(PipelineEvent::PipelineFailed {
                execution_id: context.execution_id.clone(),
                error_code: "VERIFICATION_FAILED".into(),
                error_message: "Pipeline is not in VERIFIED status".into(),
                stage_id: None,
                step_id: None,
                timestamp: Self::now_ms(),
                sequence_number: seq,
            });
            self.manager.mark_completed(&context.execution_id);
            return Err(PipelineError::ExecutionError("Pipeline must be VERIFIED before execution".into()));
        }

        context.transition_pipeline_status(PipelineStatus::Queued)?;
        
        let seq = self.manager.next_sequence_number(&context.execution_id);
        self.emit_event(PipelineEvent::PipelineStarted {
            execution_id: context.execution_id.clone(),
            pipeline_id: context.pipeline_id.clone(),
            timestamp: context.start_time_ms,
            sequence_number: seq,
        });

        if let Some(ref store) = self.history_store {
            let _ = store.record_event(crate::pipeline::history::PipelineHistoryEvent {
                event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                sequence_number: 0,
                pipeline_id: context.pipeline_id.clone(),
                pipeline_version: pipeline.version,
                event_type: "PIPELINE_EXECUTION_STARTED".to_string(),
                actor: crate::pipeline::history::AuditActor::Executor,
                timestamp_ms: context.start_time_ms,
                stage_id: None,
                step_id: None,
                approval_id: None,
                execution_id: Some(context.execution_id.clone()),
                command_fingerprint: None,
                previous_state: Some("QUEUED".to_string()),
                new_state: Some("RUNNING".to_string()),
                reason_code: None,
                reason: None,
                policy_code: None,
                summary: format!("Execution '{}' started", context.execution_id),
                metadata: std::collections::HashMap::new(),
            });
        }

        if context.is_cancelled() {
            let seq = self.manager.next_sequence_number(&context.execution_id);
            self.emit_event(PipelineEvent::PipelineCancelled {
                execution_id: context.execution_id.clone(),
                reason: "Cancelled before start".into(),
                timestamp: Self::now_ms(),
                sequence_number: seq,
            });
            self.manager.mark_completed(&context.execution_id);
            return Ok(context);
        }
        
        context.transition_pipeline_status(PipelineStatus::Running)?;

        let mut sorted_stages = pipeline.stages.clone();
        sorted_stages.sort_by_key(|s| s.order);

        let mut pipeline_failed = false;
        let mut failed_stage_id = None;
        let mut failed_step_id = None;
        let mut fail_message = String::new();

        for (stage_idx, stage) in sorted_stages.iter().enumerate() {
            if context.is_cancelled() {
                let _ = context.transition_stage_status(&stage.id, StageStatus::Cancelled);
                break;
            }

            let seq = self.manager.next_sequence_number(&context.execution_id);
            self.emit_event(PipelineEvent::StageStarted {
                execution_id: context.execution_id.clone(),
                stage_id: stage.id.clone(),
                stage_index: stage_idx,
                timestamp: Self::now_ms(),
                sequence_number: seq,
            });

            context.transition_stage_status(&stage.id, StageStatus::Running)?;

            let mut sorted_steps = stage.steps.clone();
            sorted_steps.sort_by_key(|s| s.order);

            let mut stage_failed = false;

            for (step_idx, step) in sorted_steps.iter().enumerate() {
                if context.is_cancelled() {
                    let _ = context.transition_step_status(&step.id, StepStatus::Cancelled);
                    continue;
                }

                let seq = self.manager.next_sequence_number(&context.execution_id);
                self.emit_event(PipelineEvent::StepStarted {
                    execution_id: context.execution_id.clone(),
                    stage_id: stage.id.clone(),
                    step_id: step.id.clone(),
                    step_index: step_idx,
                    timestamp: Self::now_ms(),
                    sequence_number: seq,
                });

                context.transition_step_status(&step.id, StepStatus::Running)?;

                // --- Policy Engine Guard Evaluation ---
                let (cmd, cmd_args, path, url, action_type) = match &step.config {
                    StepConfig::Command { command, args, cwd } => (Some(command.clone()), args.clone(), cwd.clone(), None, ActionType::Command),
                    StepConfig::Artifact { path, .. } => (None, vec![], Some(path.clone()), None, ActionType::FileRead),
                    StepConfig::Http { url, .. } => (None, vec![], None, Some(url.clone()), ActionType::Network),
                    _ => (None, vec![], None, None, ActionType::Unknown),
                };

                let eval_req = PolicyEvaluationRequest {
                    execution_id: context.execution_id.clone(),
                    pipeline_id: context.pipeline_id.clone(),
                    pipeline_version: Some(pipeline.version),
                    stage_id: stage.id.clone(),
                    step_id: step.id.clone(),
                    step_type: format!("{:?}", step.step_type),
                    environment_id: None,
                    platform: None,
                    action_type,
                    command: cmd,
                    args: cmd_args,
                    cwd: None,
                    path,
                    url,
                    workspace_root: r"E:\Github project\Developer-Control-Center".to_string(),
                    policy_version: self.policy_engine.policy_version().to_string(),
                };

                let eval_res = self.policy_engine.evaluate(&eval_req);

                let seq = self.manager.next_sequence_number(&context.execution_id);
                self.emit_event(PipelineEvent::PolicyEvaluated {
                    execution_id: context.execution_id.clone(),
                    step_id: step.id.clone(),
                    decision: format!("{:?}", eval_res.decision),
                    risk_level: "LOW".to_string(),
                    reason_code: "EVALUATED".to_string(),
                    timestamp: Self::now_ms(),
                    sequence_number: seq,
                });

                match eval_res.decision {
                    PolicyDecision::Allow { .. } => {}
                    PolicyDecision::Deny { reason_code, message, .. } => {
                        stage_failed = true;
                        pipeline_failed = true;
                        failed_stage_id = Some(stage.id.clone());
                        failed_step_id = Some(step.id.clone());
                        fail_message = format!("Policy Denied: {} - {}", reason_code, message);

                        context.record_step_result(&step.id, None, Some(fail_message.clone()));
                        let _ = context.transition_step_status(&step.id, StepStatus::Failed);

                        let seq = self.manager.next_sequence_number(&context.execution_id);
                        self.emit_event(PipelineEvent::PolicyDenied {
                            execution_id: context.execution_id.clone(),
                            step_id: step.id.clone(),
                            reason_code: reason_code.clone(),
                            message: message.clone(),
                            timestamp: Self::now_ms(),
                            sequence_number: seq,
                        });

                        let seq = self.manager.next_sequence_number(&context.execution_id);
                        self.emit_event(PipelineEvent::StepCompleted {
                            execution_id: context.execution_id.clone(),
                            stage_id: stage.id.clone(),
                            step_id: step.id.clone(),
                            status: "FAILED".into(),
                            duration_ms: 0,
                            timestamp: Self::now_ms(),
                            sequence_number: seq,
                        });

                        break;
                    }
                    PolicyDecision::RequireApproval { approval_id, action_fingerprint, prompt, risk_level, reason_code, .. } => {
                        let store = self.policy_engine.approval_store();
                        let risk_level_str = format!("{:?}", risk_level);
                        let cmd_val = eval_req.command.clone();
                        let args_val = eval_req.args.clone();
                        let act_type_str = format!("{:?}", eval_req.action_type);

                        let ttl_ms = crate::policy::approval::ApprovalStore::get_ttl_for_risk_level(&risk_level_str);

                        // PHASE 6: Before registering a new runtime approval, check if we already have 
                        // a valid approved token from "generation-preview" that perfectly matches this exact 
                        // pipeline_version and canonical action fingerprint.
                        if let Ok(true) = store.consume_existing_approval(
                            &Some(context.pipeline_id.clone()),
                            Some(pipeline.version),
                            &step.id,
                            &action_fingerprint,
                        ) {
                            // Successfully consumed an existing approval from the preview phase!
                            // We can bypass generating a new one.
                            if let Some(ref hstore) = self.history_store {
                                let _ = hstore.record_event(crate::pipeline::history::PipelineHistoryEvent {
                                    event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                                    sequence_number: 0,
                                    pipeline_id: context.pipeline_id.clone(),
                                    pipeline_version: pipeline.version,
                                    event_type: "APPROVAL_CONSUMED_FROM_PREVIEW".to_string(),
                                    actor: crate::pipeline::history::AuditActor::Executor,
                                    timestamp_ms: Self::now_ms(),
                                    stage_id: Some(stage.id.clone()),
                                    step_id: Some(step.id.clone()),
                                    approval_id: None,
                                    execution_id: Some(context.execution_id.clone()),
                                    command_fingerprint: Some(action_fingerprint.clone()),
                                    previous_state: Some("APPROVED".to_string()),
                                    new_state: Some("CONSUMED".to_string()),
                                    reason_code: Some("PREVIEW_CONSUMPTION".to_string()),
                                    reason: Some("Approval token from preview generation verified and consumed for execution".to_string()),
                                    policy_code: None,
                                    summary: format!("Preview approval consumed for step '{}'", step.id),
                                    metadata: std::collections::HashMap::new(),
                                });
                            }
                            continue; // Skip the rest of the loop, step is approved!
                        }

                        store.register_approval_detailed(
                            approval_id.clone(),
                            context.execution_id.clone(),
                            Some(context.pipeline_id.clone()),
                            Some(pipeline.version),
                            step.id.clone(),
                            Some(step.name.clone()),
                            act_type_str,
                            cmd_val,
                            args_val,
                            risk_level_str.clone(),
                            reason_code.clone(),
                            prompt.clone(),
                            action_fingerprint.clone(),
                            ttl_ms,
                        );

                        let seq = self.manager.next_sequence_number(&context.execution_id);
                        self.emit_event(PipelineEvent::PolicyApprovalRequired {
                            execution_id: context.execution_id.clone(),
                            step_id: step.id.clone(),
                            approval_id: approval_id.clone(),
                            action_fingerprint: action_fingerprint.clone(),
                            prompt,
                            timestamp: Self::now_ms(),
                            sequence_number: seq,
                        });

                        let mut approved = false;
                        let start_wait = Self::now_ms();
                        let notify = store.notify();
                        loop {
                            if context.is_cancelled() {
                                break;
                            }
                            if Self::now_ms() - start_wait > ttl_ms {
                                if let Some(ref hstore) = self.history_store {
                                    let _ = hstore.record_event(crate::pipeline::history::PipelineHistoryEvent {
                                        event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                                        sequence_number: 0,
                                        pipeline_id: context.pipeline_id.clone(),
                                        pipeline_version: pipeline.version,
                                        event_type: "APPROVAL_EXPIRED".to_string(),
                                        actor: crate::pipeline::history::AuditActor::System,
                                        timestamp_ms: Self::now_ms(),
                                        stage_id: Some(stage.id.clone()),
                                        step_id: Some(step.id.clone()),
                                        approval_id: Some(approval_id.clone()),
                                        execution_id: Some(context.execution_id.clone()),
                                        command_fingerprint: Some(action_fingerprint.clone()),
                                        previous_state: Some("PENDING".to_string()),
                                        new_state: Some("EXPIRED".to_string()),
                                        reason_code: Some("TTL_EXPIRED".to_string()),
                                        reason: Some("Approval TTL timed out".to_string()),
                                        policy_code: None,
                                        summary: format!("Approval token '{}' expired after TTL timeout", approval_id),
                                        metadata: std::collections::HashMap::new(),
                                    });
                                }
                                break;
                            }

                            if let Ok(ver) = store.verify_and_consume(&approval_id, &context.execution_id, &step.id, &action_fingerprint) {
                                approved = ver;
                                if ver {
                                    if let Some(ref hstore) = self.history_store {
                                        let _ = hstore.record_event(crate::pipeline::history::PipelineHistoryEvent {
                                            event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                                            sequence_number: 0,
                                            pipeline_id: context.pipeline_id.clone(),
                                            pipeline_version: pipeline.version,
                                            event_type: "APPROVAL_CONSUMED".to_string(),
                                            actor: crate::pipeline::history::AuditActor::Executor,
                                            timestamp_ms: Self::now_ms(),
                                            stage_id: Some(stage.id.clone()),
                                            step_id: Some(step.id.clone()),
                                            approval_id: Some(approval_id.clone()),
                                            execution_id: Some(context.execution_id.clone()),
                                            command_fingerprint: Some(action_fingerprint.clone()),
                                            previous_state: Some("APPROVED".to_string()),
                                            new_state: Some("CONSUMED".to_string()),
                                            reason_code: Some("EXECUTION_CONSUMPTION".to_string()),
                                            reason: Some("Approval token verified and consumed for execution".to_string()),
                                            policy_code: None,
                                            summary: format!("Approval token '{}' consumed for step '{}'", approval_id, step.id),
                                            metadata: std::collections::HashMap::new(),
                                        });
                                    }
                                }
                                break;
                            }

                            tokio::select! {
                                _ = notify.notified() => {}
                                _ = tokio::time::sleep(tokio::time::Duration::from_millis(100)) => {}
                            }
                        }

                        if approved {
                            // Re-run PolicyEngine on the current step/request to confirm it still permits execution
                            let re_eval = self.policy_engine.evaluate(&eval_req);
                            match re_eval.decision {
                                PolicyDecision::Allow { .. } => {
                                    // Allowed, continue execution
                                }
                                PolicyDecision::RequireApproval { approval_id: ref_app_id, .. } if ref_app_id == approval_id => {
                                    // Allowed by this approval, continue execution
                                }
                                _ => {
                                    stage_failed = true;
                                    pipeline_failed = true;
                                    failed_stage_id = Some(stage.id.clone());
                                    failed_step_id = Some(step.id.clone());
                                    fail_message = "Execution blocked: Policy changed after approval and now denies this action".to_string();
                                    
                                    context.record_step_result(&step.id, None, Some(fail_message.clone()));
                                    let _ = context.transition_step_status(&step.id, StepStatus::Failed);
                                    
                                    let seq = self.manager.next_sequence_number(&context.execution_id);
                                    self.emit_event(PipelineEvent::PolicyDenied {
                                        execution_id: context.execution_id.clone(),
                                        step_id: step.id.clone(),
                                        reason_code: "POLICY_CHANGED_AFTER_APPROVAL".to_string(),
                                        message: fail_message.clone(),
                                        timestamp: Self::now_ms(),
                                        sequence_number: seq,
                                    });
                                    break;
                                }
                            }
                        }

                        if !approved {
                            stage_failed = true;
                            pipeline_failed = true;
                            failed_stage_id = Some(stage.id.clone());
                            failed_step_id = Some(step.id.clone());
                            fail_message = format!("Policy Approval Rejected or Expired for step '{}'", step.id);

                            context.record_step_result(&step.id, None, Some(fail_message.clone()));
                            let _ = context.transition_step_status(&step.id, StepStatus::Failed);

                            let seq = self.manager.next_sequence_number(&context.execution_id);
                            self.emit_event(PipelineEvent::PolicyDenied {
                                execution_id: context.execution_id.clone(),
                                step_id: step.id.clone(),
                                reason_code: "POLICY_APPROVAL_FAILED".to_string(),
                                message: fail_message.clone(),
                                timestamp: Self::now_ms(),
                                sequence_number: seq,
                            });

                            let seq = self.manager.next_sequence_number(&context.execution_id);
                            self.emit_event(PipelineEvent::StepCompleted {
                                execution_id: context.execution_id.clone(),
                                stage_id: stage.id.clone(),
                                step_id: step.id.clone(),
                                status: "FAILED".into(),
                                duration_ms: 0,
                                timestamp: Self::now_ms(),
                                sequence_number: seq,
                            });

                            break;
                        }

                        let seq = self.manager.next_sequence_number(&context.execution_id);
                        self.emit_event(PipelineEvent::PolicyApproved {
                            execution_id: context.execution_id.clone(),
                            step_id: step.id.clone(),
                            approval_id,
                            timestamp: Self::now_ms(),
                            sequence_number: seq,
                        });
                    }
                }

                let result = match step.step_type {
                    PipelineStepType::Mock => {
                        let exec = MockStepExecutor;
                        exec.execute(step, None, context.cancel_flag.clone()).await
                    }
                    PipelineStepType::AiAgent | PipelineStepType::Prompt => {
                        let exec = AiStepExecutor;
                        exec.execute(step, self.ai_gateway.as_ref(), context.cancel_flag.clone()).await
                    }
                    _ => {
                        Err(PipelineError::ValidationError(format!(
                            "Step type '{:?}' is not implemented in this phase",
                            step.step_type
                        )))
                    }
                };

                match result {
                    Ok(step_result) => {
                        context.record_step_result(&step.id, step_result.output.clone(), step_result.error.clone());
                        
                        let step_status = match step_result.status {
                            PipelineStatus::Success => StepStatus::Success,
                            PipelineStatus::Failed => {
                                stage_failed = true;
                                pipeline_failed = true;
                                failed_stage_id = Some(stage.id.clone());
                                failed_step_id = Some(step.id.clone());
                                fail_message = step_result.error.clone().unwrap_or_else(|| "Unknown step execution failure".into());
                                StepStatus::Failed
                            }
                            PipelineStatus::Cancelled => StepStatus::Cancelled,
                            _ => StepStatus::Failed,
                        };
                        
                        let _ = context.transition_step_status(&step.id, step_status);

                        let seq = self.manager.next_sequence_number(&context.execution_id);
                        self.emit_event(PipelineEvent::StepCompleted {
                            execution_id: context.execution_id.clone(),
                            stage_id: stage.id.clone(),
                            step_id: step.id.clone(),
                            status: format!("{:?}", step_status).to_uppercase(),
                            duration_ms: step_result.duration_ms,
                            timestamp: Self::now_ms(),
                            sequence_number: seq,
                        });
                    }
                    Err(err) => {
                        stage_failed = true;
                        pipeline_failed = true;
                        failed_stage_id = Some(stage.id.clone());
                        failed_step_id = Some(step.id.clone());
                        fail_message = format!("{}", err);

                        context.record_step_result(&step.id, None, Some(format!("{}", err)));
                        let _ = context.transition_step_status(&step.id, StepStatus::Failed);

                        let seq = self.manager.next_sequence_number(&context.execution_id);
                        self.emit_event(PipelineEvent::StepCompleted {
                            execution_id: context.execution_id.clone(),
                            stage_id: stage.id.clone(),
                            step_id: step.id.clone(),
                            status: "FAILED".into(),
                            duration_ms: 0,
                            timestamp: Self::now_ms(),
                            sequence_number: seq,
                        });
                    }
                }

                if stage_failed {
                    break;
                }
            }

            let stage_status = if context.is_cancelled() {
                StageStatus::Cancelled
            } else if stage_failed {
                StageStatus::Failed
            } else {
                StageStatus::Success
            };

            let _ = context.transition_stage_status(&stage.id, stage_status);

            let seq = self.manager.next_sequence_number(&context.execution_id);
            self.emit_event(PipelineEvent::StageCompleted {
                execution_id: context.execution_id.clone(),
                stage_id: stage.id.clone(),
                stage_index: stage_idx,
                status: format!("{:?}", stage_status).to_uppercase(),
                timestamp: Self::now_ms(),
                sequence_number: seq,
            });

            if stage_failed {
                let _ = context.transition_pipeline_status(PipelineStatus::Failed);
                
                let seq = self.manager.next_sequence_number(&context.execution_id);
                self.emit_event(PipelineEvent::PipelineFailed {
                    execution_id: context.execution_id.clone(),
                    error_code: "STEP_EXECUTION_FAILED".into(),
                    error_message: context.sanitize(&fail_message),
                    stage_id: failed_stage_id,
                    step_id: failed_step_id,
                    timestamp: Self::now_ms(),
                    sequence_number: seq,
                });
                self.manager.mark_completed(&context.execution_id);
                return Ok(context);
            }
        }

        if context.is_cancelled() {
            let _ = context.transition_pipeline_status(PipelineStatus::Cancelled);
            
            let seq = self.manager.next_sequence_number(&context.execution_id);
            self.emit_event(PipelineEvent::PipelineCancelled {
                execution_id: context.execution_id.clone(),
                reason: "User requested cancellation".into(),
                timestamp: Self::now_ms(),
                sequence_number: seq,
            });
        } else if pipeline_failed {
            let _ = context.transition_pipeline_status(PipelineStatus::Failed);
            
            let seq = self.manager.next_sequence_number(&context.execution_id);
            self.emit_event(PipelineEvent::PipelineFailed {
                execution_id: context.execution_id.clone(),
                error_code: "PIPELINE_EXECUTION_FAILED".into(),
                error_message: context.sanitize(&fail_message),
                stage_id: failed_stage_id.clone(),
                step_id: failed_step_id.clone(),
                timestamp: Self::now_ms(),
                sequence_number: seq,
            });

            if let Some(ref store) = self.history_store {
                let _ = store.record_event(crate::pipeline::history::PipelineHistoryEvent {
                    event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                    sequence_number: 0,
                    pipeline_id: context.pipeline_id.clone(),
                    pipeline_version: pipeline.version,
                    event_type: "PIPELINE_EXECUTION_FAILED".to_string(),
                    actor: crate::pipeline::history::AuditActor::Executor,
                    timestamp_ms: Self::now_ms(),
                    stage_id: failed_stage_id.clone(),
                    step_id: failed_step_id.clone(),
                    approval_id: None,
                    execution_id: Some(context.execution_id.clone()),
                    command_fingerprint: None,
                    previous_state: Some("RUNNING".to_string()),
                    new_state: Some("FAILED".to_string()),
                    reason_code: Some("EXECUTION_FAILED".to_string()),
                    reason: Some(fail_message.clone()),
                    policy_code: None,
                    summary: format!("Execution '{}' failed: {}", context.execution_id, fail_message),
                    metadata: std::collections::HashMap::new(),
                });
            }
        } else {
            let _ = context.transition_pipeline_status(PipelineStatus::Success);
            
            let seq = self.manager.next_sequence_number(&context.execution_id);
            self.emit_event(PipelineEvent::PipelineCompleted {
                execution_id: context.execution_id.clone(),
                status: "SUCCESS".into(),
                duration_ms: Self::now_ms() - context.start_time_ms,
                timestamp: Self::now_ms(),
                sequence_number: seq,
            });

            if let Some(ref store) = self.history_store {
                let _ = store.record_event(crate::pipeline::history::PipelineHistoryEvent {
                    event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                    sequence_number: 0,
                    pipeline_id: context.pipeline_id.clone(),
                    pipeline_version: pipeline.version,
                    event_type: "PIPELINE_EXECUTION_COMPLETED".to_string(),
                    actor: crate::pipeline::history::AuditActor::Executor,
                    timestamp_ms: Self::now_ms(),
                    stage_id: None,
                    step_id: None,
                    approval_id: None,
                    execution_id: Some(context.execution_id.clone()),
                    command_fingerprint: None,
                    previous_state: Some("RUNNING".to_string()),
                    new_state: Some("COMPLETED".to_string()),
                    reason_code: Some("SUCCESS".to_string()),
                    reason: None,
                    policy_code: None,
                    summary: format!("Execution '{}' completed successfully", context.execution_id),
                    metadata: std::collections::HashMap::new(),
                });
            }
        }

        self.manager.mark_completed(&context.execution_id);
        Ok(context)
    }
}
