use crate::ai::models::{AIProviderConfig, CreateAIProviderInput, UpdateAIProviderInput};
use crate::ai::AIProviderService;
use crate::error::DesktopError;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

fn get_ai_service(app: &AppHandle) -> Result<Arc<AIProviderService>, DesktopError> {
    if let Some(service) = app.try_state::<Arc<AIProviderService>>() {
        Ok(service.inner().clone())
    } else {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("."));
        let service = Arc::new(AIProviderService::new(app_data_dir));
        app.manage(service.clone());
        Ok(service)
    }
}

#[tauri::command]
pub async fn ai_provider_list_cmd(
    app: AppHandle,
) -> Result<Vec<AIProviderConfig>, DesktopError> {
    let service = get_ai_service(&app)?;
    Ok(service.list())
}

#[tauri::command]
pub async fn ai_provider_create_cmd(
    app: AppHandle,
    input: CreateAIProviderInput,
) -> Result<AIProviderConfig, DesktopError> {
    let service = get_ai_service(&app)?;
    service.create(input)
}

#[tauri::command]
pub async fn ai_provider_update_cmd(
    app: AppHandle,
    input: UpdateAIProviderInput,
) -> Result<AIProviderConfig, DesktopError> {
    let service = get_ai_service(&app)?;
    service.update(input)
}

#[tauri::command]
pub async fn ai_provider_delete_cmd(
    app: AppHandle,
    id: String,
) -> Result<(), DesktopError> {
    let service = get_ai_service(&app)?;
    service.delete(&id)
}

#[tauri::command]
pub async fn ai_provider_set_default_cmd(
    app: AppHandle,
    id: String,
) -> Result<AIProviderConfig, DesktopError> {
    let service = get_ai_service(&app)?;
    service.set_default(&id)
}

#[tauri::command]
pub async fn ai_provider_test_connection_cmd(
    app: AppHandle,
    id: String,
) -> Result<AIProviderConfig, DesktopError> {
    let service = get_ai_service(&app)?;
    service.test_connection(&id).await
}
