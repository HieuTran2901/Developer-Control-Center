use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StageStatus {
    Pending,
    Running,
    Success,
    Failed,
    Cancelled,
}

impl StageStatus {
    pub fn can_transition_to(&self, new_status: StageStatus) -> bool {
        match (self, new_status) {
            (a, b) if *a == b => true,
            (StageStatus::Pending, StageStatus::Running) => true,
            (StageStatus::Pending, StageStatus::Cancelled) => true,
            (StageStatus::Running, StageStatus::Success) => true,
            (StageStatus::Running, StageStatus::Failed) => true,
            (StageStatus::Running, StageStatus::Cancelled) => true,
            _ => false,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StepStatus {
    Pending,
    Running,
    Success,
    Failed,
    Cancelled,
}

impl StepStatus {
    pub fn can_transition_to(&self, new_status: StepStatus) -> bool {
        match (self, new_status) {
            (a, b) if *a == b => true,
            (StepStatus::Pending, StepStatus::Running) => true,
            (StepStatus::Pending, StepStatus::Cancelled) => true,
            (StepStatus::Running, StepStatus::Success) => true,
            (StepStatus::Running, StepStatus::Failed) => true,
            (StepStatus::Running, StepStatus::Cancelled) => true,
            _ => false,
        }
    }
}
