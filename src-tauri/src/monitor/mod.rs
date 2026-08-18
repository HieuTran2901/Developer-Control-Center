use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use sysinfo::{Pid, System};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::RwLock;

pub mod antigravity_discovery;
pub mod antigravity_quota;
pub mod providers;
pub mod quota_discovery;
pub mod quota_oauth;
pub mod quota_polling;
pub mod quota_provider;


use antigravity_quota::{
    AntigravityQuotaClient, AntigravityQuotaSnapshot, AntigravityRuntimeDiagnostic,
};
use quota_discovery::{
    LocalUsageDiscoveryReport, QuotaDiscoveryReport, QuotaDiscoveryService,
    UsageCorrelationReport, UsageProtocolDiscoveryReport, UsageTraceReport,
};
use quota_oauth::{GoogleOAuthService, OAuthConnectionResult};
use quota_polling::{
    AccountMonitorConfig, AccountQuotaSnapshot, AccountRegistry, PollingEngineStatus,
    QuotaPollingEngine,
};
use quota_provider::{
    KeyringCredentialStorage, QuotaProviderError, QuotaProviderService,
    QuotaStatus,
};

#[derive(Clone, Serialize, Deserialize)]
pub struct ProcessMetricsDto {
    pub pid: u32,
    pub cpu: f32,
    pub memory: u64,
    pub threads: usize,
    pub uptime: u64,
    pub start_time: u64,
}

pub struct MonitorState {
    pub watched_pids: Arc<RwLock<Vec<u32>>>,
    pub polling_engine: Arc<QuotaPollingEngine>,
    pub oauth_service: Arc<GoogleOAuthService>,
}

impl MonitorState {
    pub fn new() -> Self {
        let storage = Arc::new(KeyringCredentialStorage::new());
        let provider = Arc::new(QuotaProviderService::new(storage.clone()));
        let registry = Arc::new(AccountRegistry::new(None));
        let polling_engine = Arc::new(QuotaPollingEngine::new(registry.clone(), provider, None));
        let oauth_service = Arc::new(GoogleOAuthService::new(
            storage,
            registry,
            polling_engine.clone(),
        ));

        Self {
            watched_pids: Arc::new(RwLock::new(Vec::new())),
            polling_engine,
            oauth_service,
        }
    }
}

// AG-9.18 Local Antigravity Quota Commands
#[tauri::command]
pub async fn get_antigravity_local_quota_cmd() -> Result<AntigravityQuotaSnapshot, String> {
    let client = AntigravityQuotaClient::new();
    client.fetch_quota().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn verify_antigravity_quota_runtime_cmd() -> Result<AntigravityRuntimeDiagnostic, String> {
    let client = AntigravityQuotaClient::new();
    Ok(client.run_diagnostic().await)
}

// AG-1 to AG-6 Commands
#[tauri::command]
pub async fn discover_antigravity_quota_endpoints_cmd() -> Result<QuotaDiscoveryReport, String> {
    Ok(QuotaDiscoveryService::run_discovery().await)
}

#[tauri::command]
pub async fn correlate_antigravity_usage_cmd() -> Result<UsageCorrelationReport, String> {
    Ok(QuotaDiscoveryService::correlate_usage_endpoints().await)
}

#[tauri::command]
pub async fn start_usage_trace_cmd(duration_secs: Option<u64>) -> Result<UsageTraceReport, String> {
    Ok(QuotaDiscoveryService::run_usage_trace(duration_secs.unwrap_or(8)).await)
}

#[tauri::command]
pub async fn discover_local_usage_sources_cmd() -> Result<LocalUsageDiscoveryReport, String> {
    Ok(QuotaDiscoveryService::discover_local_usage_sources())
}

#[tauri::command]
pub async fn discover_usage_protocol_cmd(
    duration_secs: Option<u64>,
) -> Result<UsageProtocolDiscoveryReport, String> {
    Ok(QuotaDiscoveryService::discover_usage_protocol(duration_secs).await)
}

#[tauri::command]
pub async fn get_antigravity_account_quota_cmd(
    account_id: Option<String>,
    provider: Option<String>,
    expected_email: Option<String>,
    force_refresh: Option<bool>,
) -> Result<QuotaStatus, QuotaProviderError> {
    let storage = Arc::new(KeyringCredentialStorage::new());
    let service = QuotaProviderService::new(storage);
    let id = account_id.unwrap_or_else(|| "default".to_string());
    let provider_id = provider
        .as_deref()
        .map(quota_provider::QuotaProviderId::from_str_loose)
        .unwrap_or(quota_provider::QuotaProviderId::Antigravity);

    service
        .get_account_quota(
            provider_id,
            &id,
            expected_email.as_deref(),
            force_refresh.unwrap_or(false),
        )
        .await
}

#[tauri::command]
pub async fn verify_antigravity_quota_path_cmd(
    account_id: Option<String>,
    provider: Option<String>,
) -> Result<quota_provider::QuotaVerificationDiagnostic, String> {
    let storage = Arc::new(KeyringCredentialStorage::new());
    let service = QuotaProviderService::new(storage);
    let id = account_id.unwrap_or_else(|| "default".to_string());
    let provider_id = provider
        .as_deref()
        .map(quota_provider::QuotaProviderId::from_str_loose)
        .unwrap_or(quota_provider::QuotaProviderId::Antigravity);

    Ok(service.verify_account_quota_path(provider_id, &id).await)
}



// AG-7 & AG-8 Multi-Account Quota Commands
#[tauri::command]
pub async fn quota_list_accounts_cmd(
    state: State<'_, MonitorState>,
) -> Result<Vec<AccountMonitorConfig>, String> {
    Ok(state.polling_engine.list_registry_accounts().await)
}

#[tauri::command]
pub async fn quota_register_account_cmd(
    config: AccountMonitorConfig,
    state: State<'_, MonitorState>,
) -> Result<(), String> {
    state.polling_engine.register_account(config).await
}

#[tauri::command]
pub async fn quota_remove_account_cmd(
    account_id: String,
    state: State<'_, MonitorState>,
) -> Result<bool, String> {
    state.polling_engine.remove_account(&account_id).await
}

#[tauri::command]
pub async fn quota_set_account_enabled_cmd(
    account_id: String,
    enabled: bool,
    state: State<'_, MonitorState>,
) -> Result<bool, String> {
    state.polling_engine.set_account_enabled(&account_id, enabled).await
}

#[tauri::command]
pub async fn quota_rename_account_cmd(
    account_id: String,
    display_name: Option<String>,
    state: State<'_, MonitorState>,
) -> Result<bool, String> {
    state.polling_engine.rename_account(&account_id, display_name).await
}

#[tauri::command]
pub async fn quota_get_account_state_cmd(
    account_id: String,
    state: State<'_, MonitorState>,
) -> Result<Option<AccountQuotaSnapshot>, String> {
    Ok(state.polling_engine.get_account_state(&account_id).await)
}

#[tauri::command]
pub async fn quota_get_all_states_cmd(
    state: State<'_, MonitorState>,
) -> Result<Vec<AccountQuotaSnapshot>, String> {
    Ok(state.polling_engine.get_all_states().await)
}

#[tauri::command]
pub async fn quota_refresh_account_cmd(
    account_id: String,
    state: State<'_, MonitorState>,
) -> Result<AccountQuotaSnapshot, String> {
    state.polling_engine.refresh_account_now(&account_id).await
}

#[tauri::command]
pub async fn quota_refresh_all_cmd(
    state: State<'_, MonitorState>,
) -> Result<Vec<AccountQuotaSnapshot>, String> {
    state.polling_engine.refresh_all_now().await
}

#[tauri::command]
pub async fn quota_get_polling_status_cmd(
    state: State<'_, MonitorState>,
) -> Result<PollingEngineStatus, String> {
    Ok(state.polling_engine.get_status().await)
}

#[tauri::command]
pub async fn quota_start_monitoring_cmd(
    state: State<'_, MonitorState>,
) -> Result<(), String> {
    state.polling_engine.start().await
}

#[tauri::command]
pub async fn quota_stop_monitoring_cmd(
    state: State<'_, MonitorState>,
) -> Result<(), String> {
    state.polling_engine.stop().await
}

#[tauri::command]
pub async fn quota_get_refresh_settings_cmd(
    state: State<'_, MonitorState>,
) -> Result<quota_polling::QuotaRefreshSettings, String> {
    Ok(state.polling_engine.get_refresh_settings().await)
}

#[tauri::command]
pub async fn quota_update_refresh_settings_cmd(
    settings: quota_polling::QuotaRefreshSettings,
    state: State<'_, MonitorState>,
) -> Result<(), String> {
    state.polling_engine.update_refresh_settings(settings).await
}


#[tauri::command]
pub async fn quota_set_account_auto_connect_cmd(
    account_id: String,
    auto_connect: bool,
    state: State<'_, MonitorState>,
) -> Result<bool, String> {
    state.polling_engine.set_account_auto_connect(&account_id, auto_connect).await
}

#[tauri::command]
pub async fn quota_reconnect_startup_accounts_cmd(
    state: State<'_, MonitorState>,
) -> Result<Vec<AccountQuotaSnapshot>, String> {
    Ok(state.polling_engine.reconnect_startup_accounts().await)
}

#[tauri::command]
pub async fn quota_connect_antigravity_account_cmd(
    account_id: String,
    state: State<'_, MonitorState>,
) -> Result<AccountQuotaSnapshot, String> {
    // 1. Get existing account config
    let account = state
        .polling_engine
        .get_account_config(&account_id)
        .await
        .ok_or_else(|| format!("Account {} not found", account_id))?;

    // 2. Set provider to Antigravity explicitly in registry
    let mut updated_config = account.clone();
    updated_config.provider = Some(quota_provider::QuotaProviderId::Antigravity);
    updated_config.updated_at = quota_provider::current_unix_timestamp().to_string();
    let _ = state.polling_engine.update_account_config(updated_config).await;

    // 3. Immediately trigger refresh through Antigravity provider
    state.polling_engine.refresh_account_now(&account_id).await
}

#[tauri::command]
pub async fn quota_connect_google_account_cmd(
    account_id: String,
    allow_email_update: Option<bool>,
    state: State<'_, MonitorState>,
) -> Result<OAuthConnectionResult, String> {
    state
        .oauth_service
        .start_oauth_flow(&account_id, allow_email_update.unwrap_or(false))
        .await
}

#[tauri::command]
pub async fn quota_disconnect_google_account_cmd(
    account_id: String,
    state: State<'_, MonitorState>,
) -> Result<bool, String> {
    state.oauth_service.disconnect_account(&account_id).await
}

#[tauri::command]
pub async fn quota_get_google_connection_status_cmd(
    account_id: String,
    state: State<'_, MonitorState>,
) -> Result<bool, String> {
    Ok(state.oauth_service.get_connection_status(&account_id))
}

#[tauri::command]
pub async fn verify_antigravity_oauth_configuration_cmd() -> Result<quota_oauth::AntigravityOAuthVerificationResult, String> {
    Ok(quota_oauth::get_antigravity_oauth_verification())
}

// Process Watch Commands
#[tauri::command]
pub async fn watch_pid_cmd(pid: u32, state: State<'_, MonitorState>) -> Result<(), String> {
    let mut pids = state.watched_pids.write().await;
    if !pids.contains(&pid) {
        pids.push(pid);
    }
    Ok(())
}

#[tauri::command]
pub async fn unwatch_pid_cmd(pid: u32, state: State<'_, MonitorState>) -> Result<(), String> {
    let mut pids = state.watched_pids.write().await;
    pids.retain(|&p| p != pid);
    Ok(())
}

pub fn init_monitor_worker(app_handle: AppHandle, watched_pids: Arc<RwLock<Vec<u32>>>) {
    tauri::async_runtime::spawn(async move {
        let mut sys = System::new_all();

        loop {
            tokio::time::sleep(Duration::from_millis(1000)).await;

            let pids_to_check = {
                let pids = watched_pids.read().await;
                pids.clone()
            };

            if pids_to_check.is_empty() {
                continue;
            }

            sys.refresh_all();

            for &pid in &pids_to_check {
                let sys_pid = Pid::from_u32(pid);
                if let Some(process) = sys.process(sys_pid) {
                    let metrics = ProcessMetricsDto {
                        pid,
                        cpu: process.cpu_usage(),
                        memory: process.memory(),
                        threads: process.tasks().map(|t| t.len()).unwrap_or(0),
                        uptime: process.run_time(),
                        start_time: process.start_time(),
                    };

                    let _ = app_handle.emit("process-metrics", metrics);
                }
            }
        }
    });
}
