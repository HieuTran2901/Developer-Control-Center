use crate::error::DesktopError;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn get_app_data_dir_cmd(app_handle: AppHandle) -> Result<String, DesktopError> {
    app_handle
        .path()
        .app_data_dir()
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|e| DesktopError {
            kind: "PathError".into(),
            message: e.to_string(),
        })
}

#[tauri::command]
pub async fn read_text_file_cmd(path: String) -> Result<String, DesktopError> {
    fs::read_to_string(path).map_err(|e| DesktopError {
        kind: "IOError".into(),
        message: e.to_string(),
    })
}

#[tauri::command]
pub async fn write_text_file_cmd(path: String, content: String) -> Result<(), DesktopError> {
    // Ensure parent dir exists
    let path_buf = PathBuf::from(&path);
    if let Some(parent) = path_buf.parent() {
        if !parent.exists() {
            let _ = fs::create_dir_all(parent);
        }
    }

    fs::write(path, content).map_err(|e| DesktopError {
        kind: "IOError".into(),
        message: e.to_string(),
    })
}
