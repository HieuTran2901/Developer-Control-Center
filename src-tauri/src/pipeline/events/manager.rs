use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use crate::pipeline::execution::context::PipelineExecutionContext;
use crate::pipeline::domain::PipelineStatus;

pub struct PipelineExecutionManager {
    executions: Mutex<HashMap<String, Arc<PipelineExecutionContext>>>,
    sequences: Mutex<HashMap<String, Arc<AtomicU32>>>,
    completed_runs: Mutex<VecDeque<String>>,
    max_completed: usize,
}

impl PipelineExecutionManager {
    pub fn new() -> Self {
        Self {
            executions: Mutex::new(HashMap::new()),
            sequences: Mutex::new(HashMap::new()),
            completed_runs: Mutex::new(VecDeque::new()),
            max_completed: 50,
        }
    }

    pub fn register_execution(&self, ctx: Arc<PipelineExecutionContext>) {
        let exec_id = ctx.execution_id.clone();
        
        let mut executions = self.executions.lock().unwrap();
        executions.insert(exec_id.clone(), ctx);
        
        let mut sequences = self.sequences.lock().unwrap();
        sequences.insert(exec_id, Arc::new(AtomicU32::new(0)));
    }

    pub fn get_execution(&self, execution_id: &str) -> Option<Arc<PipelineExecutionContext>> {
        let executions = self.executions.lock().unwrap();
        executions.get(execution_id).cloned()
    }

    pub fn next_sequence_number(&self, execution_id: &str) -> u32 {
        let sequences = self.sequences.lock().unwrap();
        if let Some(counter) = sequences.get(execution_id) {
            counter.fetch_add(1, Ordering::Relaxed) + 1
        } else {
            1
        }
    }

    pub fn mark_completed(&self, execution_id: &str) {
        let mut completed = self.completed_runs.lock().unwrap();
        completed.push_back(execution_id.to_string());

        if completed.len() > self.max_completed {
            if let Some(evict_id) = completed.pop_front() {
                let mut executions = self.executions.lock().unwrap();
                executions.remove(&evict_id);
                
                let mut sequences = self.sequences.lock().unwrap();
                sequences.remove(&evict_id);
            }
        }
    }

    pub fn list_active_executions(&self) -> Vec<String> {
        let executions = self.executions.lock().unwrap();
        let mut active = Vec::new();
        for (id, ctx) in executions.iter() {
            let status = ctx.get_pipeline_status();
            if matches!(status, PipelineStatus::Idle | PipelineStatus::Queued | PipelineStatus::Running) {
                active.push(id.clone());
            }
        }
        active
    }
}
