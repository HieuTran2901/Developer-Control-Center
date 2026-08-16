use crate::security::engine::SecurityEngine;
use std::sync::Arc;
use tauri::{command, AppHandle, State};

use crate::security::domain::SecurityScanMode;
use crate::security::project_context::SecurityProjectContext;
use crate::security::scan_planner::{SecurityScanPlan, SecurityScanPlanner};
use std::path::Path;

#[command]
pub async fn start_security_scan_cmd(
    project_id: String,
    root_path: String,
    mode: Option<SecurityScanMode>,
    engine: State<'_, Arc<SecurityEngine>>,
    app: AppHandle,
) -> Result<String, String> {
    let scan_mode = mode.unwrap_or(SecurityScanMode::Full);
    let root = Path::new(&root_path);
    let plan = if root.exists() {
        let context = SecurityProjectContext::from_root_path(project_id.clone(), root);
        Some(SecurityScanPlanner::plan(&context, scan_mode))
    } else {
        None
    };
    engine.start_scan(project_id, root_path, scan_mode, plan, app).await
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

#[command]
pub async fn get_security_scan_plan_cmd(
    project_id: String,
    root_path: String,
    mode: Option<SecurityScanMode>,
) -> Result<SecurityScanPlan, String> {
    let root = Path::new(&root_path);
    if !root.exists() {
        return Err("Project root directory does not exist".to_string());
    }
    let context = SecurityProjectContext::from_root_path(project_id, root);
    let plan = SecurityScanPlanner::plan(&context, mode.unwrap_or(SecurityScanMode::Full));
    Ok(plan)
}


