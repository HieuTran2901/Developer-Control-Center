pub mod commands;
pub mod error;
pub mod runtime;
pub mod security;
mod monitor;

use commands::fs_cmds::{get_app_data_dir_cmd, read_text_file_cmd, write_text_file_cmd};
use commands::runtime_cmds::{
    force_stop_process_cmd, restart_process_cmd, start_process_cmd, stop_process_cmd,
};
use commands::system::{
    get_app_version_command, get_system_info_command, open_browser_command, open_folder_command,
    ping_command, read_directory_command,
};
use commands::security_cmds::{start_security_scan_cmd, cancel_security_scan_cmd};
use runtime::registry::RuntimeRegistry;
use runtime::manager::ProcessManager;
use runtime::controller::ProcessController;
use security::engine::SecurityEngine;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let monitor_state = monitor::MonitorState::new();
    let watched_pids = monitor_state.watched_pids.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(monitor_state)
        .setup(move |app| {
            monitor::init_monitor_worker(app.handle().clone(), watched_pids);
            let registry = RuntimeRegistry::new();
            let manager = Arc::new(ProcessManager::new(registry, app.handle().clone()));
            let controller = Arc::new(ProcessController::new(manager));
            app.manage(controller);
            
            let security_engine = Arc::new(SecurityEngine::new());
            app.manage(security_engine);
            
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let app = window.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(controller) = app.try_state::<Arc<ProcessController>>() {
                        controller.manager.shutdown().await;
                    }
                    app.exit(0);
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            monitor::watch_pid_cmd,
            monitor::unwatch_pid_cmd,
            ping_command,
            get_app_version_command,
            open_browser_command,
            open_folder_command,
            read_directory_command,
            get_system_info_command,
            start_process_cmd,
            stop_process_cmd,
            force_stop_process_cmd,
            restart_process_cmd,
            get_app_data_dir_cmd,
            read_text_file_cmd,
            write_text_file_cmd,
            start_security_scan_cmd,
            cancel_security_scan_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


