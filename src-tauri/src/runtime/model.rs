use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ProcessState {
    Idle,
    Starting,
    Running,
    Stopping,
    Stopped,
    Restarting,
    Failed,
    Exited,
    Crashed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ReadinessState {
    Unknown,
    Waiting,
    Ready,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ReadinessStrategy {
    None,
    #[serde(rename = "log_pattern")]
    LogPattern { pattern: String },
    Port { port: u16 },
    Http { path: Option<String> }, // path or url
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessModel {
    pub id: String,
    pub project_id: String,
    pub profile_id: String,
    pub pid: Option<u32>,
    pub parent_pid: Option<u32>,
    pub command: String,
    pub args: Option<Vec<String>>,
    pub working_directory: String,
    pub status: ProcessState,
    pub readiness: ReadinessState,
    pub start_time: Option<u64>,
    pub stop_time: Option<u64>,
    pub exit_code: Option<i32>,
}
