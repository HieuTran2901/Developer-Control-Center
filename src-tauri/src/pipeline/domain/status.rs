use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PipelineStatus {
    Idle,
    Queued,
    Running,
    Success,
    Failed,
    Cancelled,
    Skipped,
}

impl PipelineStatus {
    pub fn can_transition_to(&self, new_status: PipelineStatus) -> bool {
        match (self, new_status) {
            // Self-transitions are safely ignored or allowed based on implementation, 
            // but normally we don't transition to the exact same state. We'll allow it for idempotency.
            (a, b) if *a == b => true,
            
            (PipelineStatus::Idle, PipelineStatus::Queued) => true,
            (PipelineStatus::Idle, PipelineStatus::Cancelled) => true,

            (PipelineStatus::Queued, PipelineStatus::Running) => true,
            (PipelineStatus::Queued, PipelineStatus::Cancelled) => true,

            (PipelineStatus::Running, PipelineStatus::Success) => true,
            (PipelineStatus::Running, PipelineStatus::Failed) => true,
            (PipelineStatus::Running, PipelineStatus::Cancelled) => true,

            // Terminal states cannot transition to Running (unless via explicit retry, which is handled externally by resetting to Idle/Queued).
            (PipelineStatus::Success, _) => false,
            (PipelineStatus::Failed, _) => false,
            (PipelineStatus::Cancelled, _) => false,
            (PipelineStatus::Skipped, _) => false,

            _ => false,
        }
    }
}
