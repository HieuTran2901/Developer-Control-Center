use std::sync::Arc;
use tauri::State;
use crate::pipeline::history::models::{
    PipelineHistoryEvent, PipelineHistorySummary, PipelineVersionRecord, VersionDiff,
};
use crate::pipeline::history::PipelineHistoryStore;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineDetailHistoryDto {
    pub pipeline_id: String,
    pub versions: Vec<PipelineVersionRecord>,
    pub events: Vec<PipelineHistoryEvent>,
}

#[tauri::command]
pub async fn list_pipeline_history_cmd(
    history_store: State<'_, Arc<PipelineHistoryStore>>,
) -> Result<Vec<PipelineHistorySummary>, String> {
    Ok(history_store.get_all_summaries())
}

#[tauri::command]
pub async fn get_pipeline_history_cmd(
    pipeline_id: String,
    history_store: State<'_, Arc<PipelineHistoryStore>>,
) -> Result<PipelineDetailHistoryDto, String> {
    let versions = history_store.get_versions(&pipeline_id);
    let events = history_store.get_events(&pipeline_id);

    Ok(PipelineDetailHistoryDto {
        pipeline_id,
        versions,
        events,
    })
}

#[tauri::command]
pub async fn get_pipeline_version_cmd(
    pipeline_id: String,
    version: u32,
    history_store: State<'_, Arc<PipelineHistoryStore>>,
) -> Result<PipelineVersionRecord, String> {
    history_store
        .get_version(&pipeline_id, version)
        .ok_or_else(|| format!("Version v{} not found for pipeline '{}'", version, pipeline_id))
}

#[tauri::command]
pub async fn get_pipeline_events_cmd(
    pipeline_id: String,
    history_store: State<'_, Arc<PipelineHistoryStore>>,
) -> Result<Vec<PipelineHistoryEvent>, String> {
    Ok(history_store.get_events(&pipeline_id))
}

#[tauri::command]
pub async fn compare_pipeline_versions_cmd(
    pipeline_id: String,
    v1: u32,
    v2: u32,
    history_store: State<'_, Arc<PipelineHistoryStore>>,
) -> Result<VersionDiff, String> {
    history_store.compare_versions(&pipeline_id, v1, v2)
}
