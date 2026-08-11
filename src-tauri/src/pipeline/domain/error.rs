use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PipelineError {
    ValidationError(String),
    ExecutionError(String),
    NotFound(String),
    InvalidTransition(String),
}

impl std::fmt::Display for PipelineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PipelineError::ValidationError(msg) => write!(f, "Validation Error: {}", msg),
            PipelineError::ExecutionError(msg) => write!(f, "Execution Error: {}", msg),
            PipelineError::NotFound(msg) => write!(f, "Not Found: {}", msg),
            PipelineError::InvalidTransition(msg) => write!(f, "Invalid State Transition: {}", msg),
        }
    }
}

impl std::error::Error for PipelineError {}
