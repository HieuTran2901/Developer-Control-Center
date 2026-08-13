use tauri::State;
use std::sync::Arc;
use crate::deployment::domain::{DeploymentRequest, DeploymentRecord};
use crate::deployment::orchestrator::DeploymentOrchestrator;
use crate::pipeline::domain::pipeline::PipelineDefinition;

#[tauri::command]
pub async fn create_deployment(
    request: DeploymentRequest,
    pipelines: Vec<PipelineDefinition>,
    orchestrator: State<'_, Arc<DeploymentOrchestrator>>,
) -> Result<DeploymentRecord, String> {
    orchestrator.create_deployment(request, &pipelines).await
}

#[tauri::command]
pub async fn approve_deployment(
    deployment_id: String,
    approval_id: String,
    orchestrator: State<'_, Arc<DeploymentOrchestrator>>,
) -> Result<DeploymentRecord, String> {
    orchestrator.approve_deployment(&deployment_id, &approval_id).await
}

#[tauri::command]
pub async fn execute_deployment(
    deployment_id: String,
    pipeline: PipelineDefinition,
    orchestrator: State<'_, Arc<DeploymentOrchestrator>>,
) -> Result<(), String> {
    orchestrator.execute_deployment(&deployment_id, pipeline).await
}

#[tauri::command]
pub async fn get_deployment_history(
    _orchestrator: State<'_, Arc<DeploymentOrchestrator>>, // We could expose the Store directly, but orchestrator has access, or inject Store
    store: State<'_, Arc<crate::deployment::store::DeploymentStore>>,
) -> Result<Vec<DeploymentRecord>, String> {
    store.get_all()
}

#[tauri::command]
pub async fn cancel_deployment_cmd(
    deployment_id: String,
    orchestrator: State<'_, Arc<DeploymentOrchestrator>>,
) -> Result<(), String> {
    orchestrator.cancel_deployment(&deployment_id).await
}
