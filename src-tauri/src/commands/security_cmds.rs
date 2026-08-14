use crate::security::engine::SecurityEngine;
use std::sync::Arc;
use tauri::{command, AppHandle, State};

use crate::security::domain::SecurityScanMode;
use crate::security::project_context::SecurityProjectContext;
use std::path::Path;

#[command]
pub async fn start_security_scan_cmd(
    project_id: String,
    root_path: String,
    mode: Option<SecurityScanMode>,
    engine: State<'_, Arc<SecurityEngine>>,
    app: AppHandle,
) -> Result<String, String> {
    engine.start_scan(project_id, root_path, mode.unwrap_or(SecurityScanMode::Full), app).await
}

#[command]
pub async fn cancel_security_scan_cmd(
    scan_id: String,
    engine: State<'_, Arc<SecurityEngine>>,
) -> Result<(), String> {
    engine.cancel_scan(&scan_id).await
}

#[command]
pub async fn get_security_project_context_cmd(
    project_id: String,
    root_path: String,
) -> Result<SecurityProjectContext, String> {
    let root = Path::new(&root_path);
    if !root.exists() {
        return Err("Project root directory does not exist".to_string());
    }
    Ok(SecurityProjectContext::from_root_path(project_id, root))
}

