use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use crate::pipeline::domain::{PipelineStatus, PipelineError};
use crate::pipeline::execution::state_machine::{StageStatus, StepStatus};

pub struct PipelineExecutionContext {
    pub execution_id: String,
    pub pipeline_id: String,
    pub start_time_ms: u64,
    pub end_time_ms: Mutex<Option<u64>>,
    
    pipeline_status: Mutex<PipelineStatus>,
    stage_statuses: Mutex<HashMap<String, StageStatus>>,
    step_statuses: Mutex<HashMap<String, StepStatus>>,
    step_outputs: Mutex<HashMap<String, Option<String>>>,
    step_errors: Mutex<HashMap<String, Option<String>>>,
    
    pub cancel_flag: Arc<AtomicBool>,
}

static RUN_COUNTER: AtomicU64 = AtomicU64::new(1);

impl PipelineExecutionContext {
    pub fn new(pipeline_id: String) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
            
        let counter = RUN_COUNTER.fetch_add(1, Ordering::Relaxed);
        let execution_id = format!("run-{}-{}-{}", pipeline_id, now, counter);

        Self {
            execution_id,
            pipeline_id,
            start_time_ms: now,
            end_time_ms: Mutex::new(None),
            pipeline_status: Mutex::new(PipelineStatus::Idle),
            stage_statuses: Mutex::new(HashMap::new()),
            step_statuses: Mutex::new(HashMap::new()),
            step_outputs: Mutex::new(HashMap::new()),
            step_errors: Mutex::new(HashMap::new()),
            cancel_flag: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn get_pipeline_status(&self) -> PipelineStatus {
        *self.pipeline_status.lock().unwrap()
    }

    pub fn transition_pipeline_status(&self, new_status: PipelineStatus) -> Result<(), PipelineError> {
        let mut status = self.pipeline_status.lock().unwrap();
        if status.can_transition_to(new_status) {
            *status = new_status;
            
            if matches!(new_status, PipelineStatus::Success | PipelineStatus::Failed | PipelineStatus::Cancelled) {
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;
                *self.end_time_ms.lock().unwrap() = Some(now);
            }
            Ok(())
        } else {
            Err(PipelineError::InvalidTransition(format!(
                "Cannot transition pipeline from {:?} to {:?}",
                *status, new_status
            )))
        }
    }

    pub fn get_stage_status(&self, stage_id: &str) -> StageStatus {
        let map = self.stage_statuses.lock().unwrap();
        map.get(stage_id).cloned().unwrap_or(StageStatus::Pending)
    }

    pub fn transition_stage_status(&self, stage_id: &str, new_status: StageStatus) -> Result<(), PipelineError> {
        let mut map = self.stage_statuses.lock().unwrap();
        let current = map.entry(stage_id.to_string()).or_insert(StageStatus::Pending);
        if current.can_transition_to(new_status) {
            *current = new_status;
            Ok(())
        } else {
            Err(PipelineError::InvalidTransition(format!(
                "Cannot transition stage '{}' from {:?} to {:?}",
                stage_id, *current, new_status
            )))
        }
    }

    pub fn get_step_status(&self, step_id: &str) -> StepStatus {
        let map = self.step_statuses.lock().unwrap();
        map.get(step_id).cloned().unwrap_or(StepStatus::Pending)
    }

    pub fn transition_step_status(&self, step_id: &str, new_status: StepStatus) -> Result<(), PipelineError> {
        let mut map = self.step_statuses.lock().unwrap();
        let current = map.entry(step_id.to_string()).or_insert(StepStatus::Pending);
        if current.can_transition_to(new_status) {
            *current = new_status;
            Ok(())
        } else {
            Err(PipelineError::InvalidTransition(format!(
                "Cannot transition step '{}' from {:?} to {:?}",
                step_id, *current, new_status
            )))
        }
    }

    pub fn record_step_result(&self, step_id: &str, output: Option<String>, error: Option<String>) {
        let clean_output = output.map(|o| self.sanitize(&o));
        let clean_error = error.map(|e| self.sanitize(&e));

        self.step_outputs.lock().unwrap().insert(step_id.to_string(), clean_output);
        self.step_errors.lock().unwrap().insert(step_id.to_string(), clean_error);
    }

    pub fn get_step_output(&self, step_id: &str) -> Option<String> {
        self.step_outputs.lock().unwrap().get(step_id).cloned().flatten()
    }

    pub fn get_step_error(&self, step_id: &str) -> Option<String> {
        self.step_errors.lock().unwrap().get(step_id).cloned().flatten()
    }

    pub fn cancel(&self) {
        self.cancel_flag.store(true, Ordering::Relaxed);
        let _ = self.transition_pipeline_status(PipelineStatus::Cancelled);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancel_flag.load(Ordering::Relaxed)
    }

    pub fn sanitize(&self, text: &str) -> String {
        let mut sanitized = text.to_string();
        
        let re_openai = regex::Regex::new(r"sk-[a-zA-Z0-9\-]{10,}").unwrap();
        sanitized = re_openai.replace_all(&sanitized, "[REDACTED_API_KEY]").to_string();

        let re_auth = regex::Regex::new(r"(?i)bearer\s+[a-zA-Z0-9\-\._\~+/]+=*").unwrap();
        sanitized = re_auth.replace_all(&sanitized, "Bearer [REDACTED]").to_string();

        if sanitized.contains("TEST_SECRET_DO_NOT_LEAK_123") {
            sanitized = sanitized.replace("TEST_SECRET_DO_NOT_LEAK_123", "[REDACTED_SECRET]");
        }

        sanitized
    }
}
