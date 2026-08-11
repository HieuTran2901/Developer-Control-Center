use std::sync::Arc;
use tauri::State;
use crate::pipeline::events::PipelineExecutionManager;
use crate::pipeline::domain::PipelineStatus;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionStateDto {
    pub execution_id: String,
    pub pipeline_id: String,
    pub status: PipelineStatus,
    pub start_time_ms: u64,
    pub end_time_ms: Option<u64>,
    pub is_cancelled: bool,
}

#[tauri::command]
pub async fn get_pipeline_execution_state(
    execution_id: String,
    manager: State<'_, Arc<PipelineExecutionManager>>,
) -> Result<ExecutionStateDto, String> {
    let ctx = manager.get_execution(&execution_id).ok_or_else(|| {
        format!("Execution ID '{}' not found", execution_id)
    })?;

    let end_time = *ctx.end_time_ms.lock().unwrap();

    Ok(ExecutionStateDto {
        execution_id: ctx.execution_id.clone(),
        pipeline_id: ctx.pipeline_id.clone(),
        status: ctx.get_pipeline_status(),
        start_time_ms: ctx.start_time_ms,
        end_time_ms: end_time,
        is_cancelled: ctx.is_cancelled(),
    })
}

#[tauri::command]
pub async fn list_active_executions(
    manager: State<'_, Arc<PipelineExecutionManager>>,
) -> Result<Vec<String>, String> {
    Ok(manager.list_active_executions())
}
