use std::sync::Arc;
use tauri::{AppHandle, State, command};
use crate::security::engine::SecurityEngine;

#[command]
pub async fn start_security_scan_cmd(
    project_id: String,
    root_path: String,
    engine: State<'_, Arc<SecurityEngine>>,
    app: AppHandle,
) -> Result<String, String> {
    engine.start_scan(project_id, root_path, app).await
}

#[command]
pub async fn cancel_security_scan_cmd(
    scan_id: String,
    engine: State<'_, Arc<SecurityEngine>>,
) -> Result<(), String> {
    engine.cancel_scan(&scan_id).await
}
