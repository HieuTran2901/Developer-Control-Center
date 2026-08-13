use crate::error::DesktopError;
use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfoResponse {
    pub os: String,
    pub arch: String,
    pub hostname: String,
    pub username: String,
    pub total_memory: u64,
}

#[tauri::command]
pub fn ping_command() -> String {
    "pong".to_string()
}

#[tauri::command]
pub fn get_app_version_command(app_handle: tauri::AppHandle) -> String {
    app_handle.package_info().version.to_string()
}

#[tauri::command]
pub fn open_browser_command(url: String) -> Result<(), DesktopError> {
    // using open crate or tauri plugin opener, but we can just use std::process for now or tauri_plugin_opener
    #[cfg(target_os = "windows")]
    let res = Command::new("cmd").args(["/C", "start", &url]).spawn();

    #[cfg(target_os = "macos")]
    let res = Command::new("open").arg(&url).spawn();

    #[cfg(target_os = "linux")]
    let res = Command::new("xdg-open").arg(&url).spawn();

    match res {
        Ok(_) => Ok(()),
        Err(e) => Err(DesktopError {
            kind: "UnknownError".to_string(),
            message: e.to_string(),
        }),
    }
}

#[tauri::command]
pub fn open_folder_command(path: String) -> Result<(), DesktopError> {
    let target_path = std::path::Path::new(&path);
    let abs_path = if target_path.is_relative() {
        std::env::current_dir().unwrap_or_default().join(target_path)
    } else {
        target_path.to_path_buf()
    };

    let canonical_path = std::fs::canonicalize(&abs_path).unwrap_or(abs_path);
    let clean_str = crate::commands::pipeline_cmds::clean_path_string(&canonical_path);

    #[cfg(target_os = "windows")]
    let res = Command::new("explorer").arg(&clean_str).spawn();

    #[cfg(target_os = "macos")]
    let res = Command::new("open").arg(&clean_str).spawn();

    #[cfg(target_os = "linux")]
    let res = Command::new("xdg-open").arg(&clean_str).spawn();

    match res {
        Ok(_) => Ok(()),
        Err(e) => Err(DesktopError {
            kind: "UnknownError".to_string(),
            message: e.to_string(),
        }),
    }
}

#[tauri::command]
pub fn read_directory_command(path: String) -> Result<Vec<String>, DesktopError> {
    match std::fs::read_dir(&path) {
        Ok(entries) => {
            let mut file_names = Vec::new();
            for entry in entries {
                if let Ok(entry) = entry {
                    if let Ok(name) = entry.file_name().into_string() {
                        file_names.push(name);
                    }
                }
            }
            Ok(file_names)
        }
        Err(e) => Err(DesktopError {
            kind: "PermissionError".to_string(),
            message: e.to_string(),
        }),
    }
}

#[tauri::command]
pub fn get_system_info_command() -> SystemInfoResponse {
    SystemInfoResponse {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        hostname: "Rust-PC".to_string(), // Can be improved with sysinfo crate later
        username: "CurrentUser".to_string(),
        total_memory: 16 * 1024 * 1024 * 1024,
    }
}
