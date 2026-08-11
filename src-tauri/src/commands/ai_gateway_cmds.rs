use crate::ai::gateway::{AIGateway, AIError, AIRequest, AIResponse};
use crate::error::DesktopError;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

fn get_ai_gateway(app: &AppHandle) -> Result<Arc<AIGateway>, DesktopError> {
    if let Some(gateway) = app.try_state::<Arc<AIGateway>>() {
        Ok(gateway.inner().clone())
    } else {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("."));
        let gateway = Arc::new(AIGateway::new(app_data_dir));
        app.manage(gateway.clone());
        Ok(gateway)
    }
}

#[tauri::command]
pub async fn ai_gateway_send_request_cmd(
    app: AppHandle,
    request: AIRequest,
) -> Result<AIResponse, AIError> {
    let gateway = get_ai_gateway(&app).map_err(|e| AIError::Internal(e.message))?;
    gateway.send_request(request).await
}
