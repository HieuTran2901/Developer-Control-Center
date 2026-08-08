use crate::error::DesktopError;
use crate::runtime::controller::ProcessController;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn start_process_cmd(
    project_id: String,
    profile_id: String,
    command: String,
    cwd: String,
    readiness_regex: Option<String>,
    readiness_config: Option<crate::runtime::model::ReadinessStrategy>,
    runtime: State<'_, Arc<ProcessController>>,
) -> Result<(), DesktopError> {
    runtime.start(project_id, profile_id, command, cwd, readiness_regex, readiness_config).await
}

#[tauri::command]
pub async fn stop_process_cmd(
    project_id: String,
    profile_id: String,
    runtime: State<'_, Arc<ProcessController>>,
) -> Result<(), DesktopError> {
    runtime.stop(project_id, profile_id).await
}

#[tauri::command]
pub async fn force_stop_process_cmd(
    project_id: String,
    profile_id: String,
    runtime: State<'_, Arc<ProcessController>>,
) -> Result<(), DesktopError> {
    runtime.force_stop(project_id, profile_id).await
}

#[tauri::command]
pub async fn restart_process_cmd(
    project_id: String,
    profile_id: String,
    command: String,
    cwd: String,
    readiness_regex: Option<String>,
    readiness_config: Option<crate::runtime::model::ReadinessStrategy>,
    runtime: State<'_, Arc<ProcessController>>,
) -> Result<(), DesktopError> {
    runtime.restart(project_id, profile_id, command, cwd, readiness_regex, readiness_config).await
}
