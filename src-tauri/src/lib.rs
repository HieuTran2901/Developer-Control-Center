pub mod ai;
pub mod commands;
pub mod error;
mod monitor;
pub mod pipeline;
pub mod policy;
pub mod runtime;
pub mod security;
pub mod config;
pub mod deployment;

use ai::{AIGateway, AIProviderService};
use commands::ai_gateway_cmds::ai_gateway_send_request_cmd;
use commands::ai_provider_cmds::{
    ai_provider_create_cmd, ai_provider_delete_cmd, ai_provider_list_cmd,
    ai_provider_set_default_cmd, ai_provider_test_connection_cmd, ai_provider_update_cmd,
};
use commands::fs_cmds::{get_app_data_dir_cmd, read_text_file_cmd, write_text_file_cmd};
use commands::runtime_cmds::{
    force_stop_process_cmd, restart_process_cmd, start_process_cmd, stop_process_cmd,
};
use commands::security_cmds::{cancel_security_scan_cmd, get_security_project_context_cmd, start_security_scan_cmd};
use commands::system::{
    get_app_version_command, get_system_info_command, open_browser_command, open_folder_command,
    ping_command, read_directory_command,
};
use commands::pipeline_cmds::{
    get_pipeline_execution_state, list_active_executions, submit_step_approval,
    get_pipelines, get_recent_executions, get_pipeline_health_stats, trigger_pipeline,
    analyze_folder_scope_cmd, scan_project_cmd, generate_pipeline_cmd, export_pipeline_cmd, list_pending_approvals, get_approval,
    approve_approval, reject_approval, request_new_approval,
};
use commands::config_cmds::{
    get_project_config, create_environment, update_environment, delete_environment,
    set_environment_secret,
};
use commands::deployment_cmds::{
    create_deployment, approve_deployment, execute_deployment, get_deployment_history, cancel_deployment_cmd
};
use commands::pipeline_history_cmds::{
    list_pipeline_history_cmd, get_pipeline_history_cmd, get_pipeline_version_cmd,
    get_pipeline_events_cmd, compare_pipeline_versions_cmd,
};
use pipeline::events::PipelineExecutionManager;
use pipeline::history::PipelineHistoryStore;
use policy::PolicyEngine;
use runtime::controller::ProcessController;
use runtime::manager::ProcessManager;
use runtime::registry::RuntimeRegistry;
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

            let policy_engine = Arc::new(PolicyEngine::new());
            app.manage(policy_engine.clone());

            let pipeline_manager = Arc::new(PipelineExecutionManager::new());
            app.manage(pipeline_manager.clone());

            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));

            let history_store = Arc::new(PipelineHistoryStore::new(&app_data_dir).unwrap());
            app.manage(history_store.clone());
                
            let config_store = Arc::new(config::ConfigStore::new(&app_data_dir).unwrap());
            app.manage(config_store.clone());
            let ai_service = Arc::new(AIProviderService::new(app_data_dir.clone()));
            app.manage(ai_service);

            let ai_gateway = Arc::new(AIGateway::new(app_data_dir.clone()));
            app.manage(ai_gateway.clone());

            let execution_context = Arc::new(pipeline::execution::pipeline_executor::PipelineExecutor::new(
                Some(ai_gateway.clone()),
                None,
                pipeline_manager.clone(),
            ).with_history_store(history_store.clone()));
            app.manage(execution_context.clone());

            let deployment_store = Arc::new(deployment::store::DeploymentStore::new(&app_data_dir).unwrap());
            app.manage(deployment_store.clone());

            let credential_store = Arc::new(ai::credential_store::OsCredentialStore::new());

            let deployment_orchestrator = Arc::new(deployment::orchestrator::DeploymentOrchestrator::new(
                deployment_store.clone(),
                config_store.clone(),
                policy_engine.clone(),
                pipeline_manager.clone(),
                execution_context.clone(),
                credential_store,
            ));
            app.manage(deployment_orchestrator);

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
            get_security_project_context_cmd,
            ai_provider_list_cmd,
            ai_provider_create_cmd,
            ai_provider_update_cmd,
            ai_provider_delete_cmd,
            ai_provider_set_default_cmd,
            ai_provider_test_connection_cmd,
            ai_gateway_send_request_cmd,
            get_pipeline_execution_state,
            list_active_executions,
            submit_step_approval,
            list_pending_approvals,
            get_approval,
            approve_approval,
            reject_approval,
            request_new_approval,
            get_pipelines,
            get_recent_executions,
            get_pipeline_health_stats,
            trigger_pipeline,
            analyze_folder_scope_cmd,
            scan_project_cmd,
            generate_pipeline_cmd,
            export_pipeline_cmd,
            get_project_config,
            create_environment,
            update_environment,
            delete_environment,
            set_environment_secret,
            create_deployment,
            approve_deployment,
            execute_deployment,
            get_deployment_history,
            cancel_deployment_cmd,
            list_pipeline_history_cmd,
            get_pipeline_history_cmd,
            get_pipeline_version_cmd,
            get_pipeline_events_cmd,
            compare_pipeline_versions_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
