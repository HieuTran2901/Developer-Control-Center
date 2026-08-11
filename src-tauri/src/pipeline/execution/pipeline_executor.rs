use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(not(test))]
use tauri::Emitter;

use crate::ai::AIGateway;
use crate::pipeline::domain::{PipelineDefinition, PipelineError, PipelineStatus, PipelineStepType};
use crate::pipeline::execution::context::PipelineExecutionContext;
use crate::pipeline::execution::state_machine::{StageStatus, StepStatus};
use crate::pipeline::executor::{StepExecutor, MockStepExecutor, AiStepExecutor};
use crate::pipeline::events::{PipelineEvent, PipelineExecutionManager};

pub struct PipelineExecutor {
    ai_gateway: Option<Arc<AIGateway>>,
    #[cfg(not(test))]
    app_handle: Option<tauri::AppHandle>,
    #[cfg(test)]
    app_handle: Option<()>,
    manager: Arc<PipelineExecutionManager>,
}

impl PipelineExecutor {
    #[cfg(not(test))]
    pub fn new(
        ai_gateway: Option<Arc<AIGateway>>,
        app_handle: Option<tauri::AppHandle>,
        manager: Arc<PipelineExecutionManager>,
    ) -> Self {
        Self {
            ai_gateway,
            app_handle,
            manager,
        }
    }

    #[cfg(test)]
    pub fn new(
        ai_gateway: Option<Arc<AIGateway>>,
        app_handle: Option<()>,
        manager: Arc<PipelineExecutionManager>,
    ) -> Self {
        Self {
            ai_gateway,
            app_handle,
            manager,
        }
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

        context.transition_pipeline_status(PipelineStatus::Queued)?;
        
        let seq = self.manager.next_sequence_number(&context.execution_id);
        self.emit_event(PipelineEvent::PipelineStarted {
            execution_id: context.execution_id.clone(),
            pipeline_id: context.pipeline_id.clone(),
            timestamp: context.start_time_ms,
            sequence_number: seq,
        });

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
                stage_id: failed_stage_id,
                step_id: failed_step_id,
                timestamp: Self::now_ms(),
                sequence_number: seq,
            });
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
        }

        self.manager.mark_completed(&context.execution_id);
        Ok(context)
    }
}
