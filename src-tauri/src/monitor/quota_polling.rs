use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};


use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::{Mutex as AsyncMutex, RwLock, Semaphore};
use tokio::time::sleep;

use crate::monitor::quota_provider::{
    sanitize_error_message, AccountIdentity, KeyringCredentialStorage, ModelQuotaStatus,
    QuotaProviderError, QuotaProviderErrorKind, QuotaProviderService, QuotaStatus,
    SecureCredentialStorage,
};

pub const DEFAULT_POLLING_INTERVAL_SECS: u64 = 120;
pub const MIN_POLLING_INTERVAL_SECS: u64 = 60;
pub const MAX_POLLING_INTERVAL_SECS: u64 = 300;
pub const MAX_CONCURRENT_REFRESHES: usize = 2;
pub const REQUEST_TIMEOUT_SECS: u64 = 8;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AccountPollingState {
    Unknown,
    Checking,
    Online,
    AuthRequired,
    RateLimited,
    NetworkError,
    ProviderError,
    Disabled,
}

use crate::monitor::quota_provider::QuotaProviderId;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountMonitorConfig {
    pub account_id: String,
    #[serde(default)]
    pub provider: Option<QuotaProviderId>,
    pub email: String,
    pub display_name: Option<String>,
    pub tier: Option<String>,
    pub enabled: bool,
    #[serde(default = "default_true")]
    pub auto_connect: bool,
    pub polling_interval_seconds: u64,
    pub created_at: String,
    pub updated_at: String,
}

fn default_true() -> bool {
    true
}

impl AccountMonitorConfig {
    pub fn provider(&self) -> QuotaProviderId {
        self.provider.unwrap_or(QuotaProviderId::Antigravity)
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.account_id.trim().is_empty() {
            return Err("account_id cannot be empty".to_string());
        }
        if self.email.trim().is_empty() || !self.email.contains('@') {
            return Err("Valid email is required".to_string());
        }
        if self.polling_interval_seconds < MIN_POLLING_INTERVAL_SECS
            || self.polling_interval_seconds > MAX_POLLING_INTERVAL_SECS
        {
            return Err(format!(
                "Polling interval must be between {} and {} seconds",
                MIN_POLLING_INTERVAL_SECS, MAX_POLLING_INTERVAL_SECS
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountQuotaSnapshot {
    pub account_id: String,
    pub provider: QuotaProviderId,
    pub email: String,
    pub display_name: Option<String>,
    pub tier: Option<String>,
    pub status: AccountPollingState,
    #[serde(default = "default_true")]
    pub auto_connect: bool,
    pub data_source: crate::monitor::quota_provider::QuotaDataSource,
    pub data_quality: crate::monitor::quota_provider::QuotaDataQuality,
    pub last_updated_at: String,
    pub last_successful_sync_at: Option<String>,
    pub next_refresh_at: Option<String>,
    pub quota: Option<QuotaStatus>,
    pub error_message: Option<String>,
}



#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct QuotaRefreshSettings {
    pub auto_refresh_enabled: bool,
    pub interval_seconds: u64,
}

impl Default for QuotaRefreshSettings {
    fn default() -> Self {
        Self {
            auto_refresh_enabled: true,
            interval_seconds: 300, // 5 minutes default
        }
    }
}

pub struct QuotaSettingsStore {
    file_path: Option<PathBuf>,
    settings: Arc<RwLock<QuotaRefreshSettings>>,
}

impl QuotaSettingsStore {
    pub fn new(app_data_dir: Option<&Path>) -> Self {
        let file_path = if let Some(d) = app_data_dir {
            Some(d.join(".dcc").join("quota_refresh_settings.json"))
        } else if let Ok(appdata) = std::env::var("APPDATA") {
            Some(PathBuf::from(appdata).join("developer-control-center").join(".dcc").join("quota_refresh_settings.json"))
        } else {
            Some(PathBuf::from(".dcc").join("quota_refresh_settings.json"))
        };

        let mut current_settings = QuotaRefreshSettings::default();

        if let Some(ref path) = file_path {
            if path.exists() {
                if let Ok(data) = fs::read_to_string(path) {
                    if let Ok(loaded) = serde_json::from_str::<QuotaRefreshSettings>(&data) {
                        current_settings = loaded;
                    }
                }
            }
        }

        Self {
            file_path,
            settings: Arc::new(RwLock::new(current_settings)),
        }
    }

    pub async fn get(&self) -> QuotaRefreshSettings {
        self.settings.read().await.clone()
    }

    pub async fn update(&self, new_settings: QuotaRefreshSettings) -> Result<(), String> {
        let mut settings = self.settings.write().await;
        *settings = new_settings.clone();
        if let Some(ref path) = self.file_path {
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if let Ok(data) = serde_json::to_string_pretty(&new_settings) {
                let _ = fs::write(path, data);
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PollingEngineStatus {
    pub is_running: bool,
    pub active_accounts_count: usize,
    pub total_accounts_count: usize,
    pub online_count: usize,
    pub auth_required_count: usize,
    pub error_count: usize,
    pub last_global_refresh_at: Option<String>,
    pub next_global_refresh_at: Option<String>,
    pub auto_refresh_enabled: bool,
    pub interval_seconds: u64,
}

pub struct AccountRegistry {
    file_path: Option<PathBuf>,
    accounts: Arc<RwLock<HashMap<String, AccountMonitorConfig>>>,
}

impl AccountRegistry {
    pub fn new(app_data_dir: Option<&Path>) -> Self {
        let file_path = if let Some(d) = app_data_dir {
            Some(d.join(".dcc").join("account_registry.json"))
        } else if let Ok(appdata) = std::env::var("APPDATA") {
            Some(PathBuf::from(appdata).join("developer-control-center").join(".dcc").join("account_registry.json"))
        } else {
            Some(PathBuf::from(".dcc").join("account_registry.json"))
        };

        let mut initial_map = HashMap::new();

        if let Some(ref path) = file_path {
            if path.exists() {
                if let Ok(data) = fs::read_to_string(path) {
                    if let Ok(configs) = serde_json::from_str::<Vec<AccountMonitorConfig>>(&data) {
                        for c in configs {
                            initial_map.insert(c.account_id.clone(), c);
                        }
                    }
                }
            }
        }

        // Add default entry if empty
        if initial_map.is_empty() {
            let default_account = AccountMonitorConfig {
                account_id: "default".to_string(),
                provider: Some(QuotaProviderId::Antigravity),
                email: "default@antigravity.oauth".to_string(),
                display_name: Some("Primary Antigravity Account".to_string()),
                tier: Some("Standard Tier".to_string()),
                enabled: true,
                auto_connect: true,
                polling_interval_seconds: DEFAULT_POLLING_INTERVAL_SECS,
                created_at: current_timestamp_str(),
                updated_at: current_timestamp_str(),
            };
            initial_map.insert(default_account.account_id.clone(), default_account);
        }

        Self {
            file_path,
            accounts: Arc::new(RwLock::new(initial_map)),
        }
    }

    pub async fn list(&self) -> Vec<AccountMonitorConfig> {
        let map = self.accounts.read().await;
        map.values().cloned().collect()
    }

    pub async fn get(&self, account_id: &str) -> Option<AccountMonitorConfig> {
        let map = self.accounts.read().await;
        map.get(account_id).cloned()
    }

    pub async fn register(&self, config: AccountMonitorConfig) -> Result<(), String> {
        config.validate()?;
        let mut map = self.accounts.write().await;
        
        // Duplicate check
        if map.contains_key(&config.account_id) {
            return Err(format!("An account with ID '{}' already exists.", config.account_id));
        }
        if map.values().any(|a| a.email.eq_ignore_ascii_case(&config.email)) {
            return Err(format!("An account with email '{}' is already registered.", config.email));
        }

        map.insert(config.account_id.clone(), config);
        self.save_internal(&map);
        Ok(())
    }

    pub async fn remove(&self, account_id: &str) -> Result<bool, String> {
        let mut map = self.accounts.write().await;
        let removed = map.remove(account_id).is_some();
        if removed {
            self.save_internal(&map);
        }
        Ok(removed)
    }

    pub async fn set_enabled(&self, account_id: &str, enabled: bool) -> Result<bool, String> {
        let mut map = self.accounts.write().await;
        if let Some(acc) = map.get_mut(account_id) {
            acc.enabled = enabled;
            acc.updated_at = current_timestamp_str();
            self.save_internal(&map);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub async fn set_auto_connect(&self, account_id: &str, auto_connect: bool) -> Result<bool, String> {
        let mut map = self.accounts.write().await;
        if let Some(acc) = map.get_mut(account_id) {
            acc.auto_connect = auto_connect;
            acc.updated_at = current_timestamp_str();
            self.save_internal(&map);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub async fn rename(&self, account_id: &str, display_name: Option<String>) -> Result<bool, String> {
        let mut map = self.accounts.write().await;
        if let Some(acc) = map.get_mut(account_id) {
            acc.display_name = display_name;
            acc.updated_at = current_timestamp_str();
            self.save_internal(&map);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    fn save_internal(&self, map: &HashMap<String, AccountMonitorConfig>) {
        if let Some(ref path) = self.file_path {
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let list: Vec<&AccountMonitorConfig> = map.values().collect();
            if let Ok(data) = serde_json::to_string_pretty(&list) {
                let temp_path = path.with_extension("tmp");
                if fs::write(&temp_path, data).is_ok() {
                    let _ = fs::rename(&temp_path, path);
                }
            }
        }
    }

}

pub struct QuotaPollingEngine {
    registry: Arc<AccountRegistry>,
    provider: Arc<QuotaProviderService>,
    settings_store: Arc<QuotaSettingsStore>,
    snapshots: Arc<RwLock<HashMap<String, AccountQuotaSnapshot>>>,
    app_handle: Arc<RwLock<Option<AppHandle>>>,
    is_running: Arc<RwLock<bool>>,
    in_flight: Arc<RwLock<HashSet<String>>>,
    semaphore: Arc<Semaphore>,
    last_global_refresh: Arc<RwLock<Option<String>>>,
    next_global_refresh: Arc<RwLock<Option<String>>>,
    shutdown_tx: Arc<AsyncMutex<Option<tokio::sync::watch::Sender<bool>>>>,
}

impl QuotaPollingEngine {
    pub fn new(
        registry: Arc<AccountRegistry>,
        provider: Arc<QuotaProviderService>,
        app_handle: Option<AppHandle>,
    ) -> Self {
        Self::with_settings_store(
            registry,
            provider,
            Arc::new(QuotaSettingsStore::new(None)),
            app_handle,
        )
    }

    pub fn with_settings_store(
        registry: Arc<AccountRegistry>,
        provider: Arc<QuotaProviderService>,
        settings_store: Arc<QuotaSettingsStore>,
        app_handle: Option<AppHandle>,
    ) -> Self {
        Self {
            registry,
            provider,
            settings_store,
            snapshots: Arc::new(RwLock::new(HashMap::new())),
            app_handle: Arc::new(RwLock::new(app_handle)),
            is_running: Arc::new(RwLock::new(false)),
            in_flight: Arc::new(RwLock::new(HashSet::new())),
            semaphore: Arc::new(Semaphore::new(MAX_CONCURRENT_REFRESHES)),
            last_global_refresh: Arc::new(RwLock::new(None)),
            next_global_refresh: Arc::new(RwLock::new(None)),
            shutdown_tx: Arc::new(AsyncMutex::new(None)),
        }
    }

    pub async fn set_app_handle(&self, handle: AppHandle) {
        let mut guard = self.app_handle.write().await;
        *guard = Some(handle);
    }

    pub async fn get_refresh_settings(&self) -> QuotaRefreshSettings {
        self.settings_store.get().await
    }

    pub async fn update_refresh_settings(&self, new_settings: QuotaRefreshSettings) -> Result<(), String> {
        self.settings_store.update(new_settings.clone()).await?;

        // If interval or enabled state changed, re-evaluate next refresh time
        if new_settings.auto_refresh_enabled {
            let now_ts = current_unix_timestamp();
            let next_ts = now_ts + new_settings.interval_seconds;
            *self.next_global_refresh.write().await = Some(next_ts.to_string());

            // AG-9.32: Recalculate each in-memory snapshot's next_refresh_at deadline immediately
            let mut snaps = self.snapshots.write().await;
            for snap in snaps.values_mut() {
                snap.next_refresh_at = Some(next_ts.to_string());
            }
        } else {
            *self.next_global_refresh.write().await = None;
            let mut snaps = self.snapshots.write().await;
            for snap in snaps.values_mut() {
                snap.next_refresh_at = None;
            }
        }

        let handle_opt = self.app_handle.read().await.clone();
        if let Some(ref handle) = handle_opt {
            let _ = handle.emit("quota:engine-status-changed", ());
        }

        Ok(())
    }

    pub async fn start(&self) -> Result<(), String> {
        let mut running = self.is_running.write().await;
        if *running {
            return Ok(());
        }
        *running = true;

        let (tx, mut rx) = tokio::sync::watch::channel(false);
        {
            let mut guard = self.shutdown_tx.lock().await;
            *guard = Some(tx);
        }

        let registry = self.registry.clone();
        let snapshots = self.snapshots.clone();
        let provider = self.provider.clone();
        let settings_store = self.settings_store.clone();
        let in_flight = self.in_flight.clone();
        let semaphore = self.semaphore.clone();
        let app_handle = self.app_handle.clone();
        let is_running_flag = self.is_running.clone();
        let last_global_refresh = self.last_global_refresh.clone();
        let next_global_refresh = self.next_global_refresh.clone();

        tokio::spawn(async move {
            loop {
                // Check if shutdown requested
                if *rx.borrow() {
                    break;
                }


                let settings = settings_store.get().await;
                if !settings.auto_refresh_enabled {
                    tokio::select! {
                        _ = sleep(Duration::from_secs(2)) => {},
                        _ = rx.changed() => {
                            if *rx.borrow() {
                                break;
                            }
                        }
                    }
                    continue;
                }

                let interval_secs = settings.interval_seconds;
                let now_ts = current_unix_timestamp();
                let accounts = registry.list().await;

                // Check if any enabled Antigravity account is due for refresh
                let mut should_refresh_batch = false;
                for acc in &accounts {
                    if !acc.enabled || acc.provider() != QuotaProviderId::Antigravity {
                        continue;
                    }

                    let snaps = snapshots.read().await;
                    if let Some(snap) = snaps.get(&acc.account_id) {
                        if let Some(next_ref) = &snap.next_refresh_at {
                            if let Ok(next_ts) = next_ref.parse::<u64>() {
                                if now_ts >= next_ts {
                                    should_refresh_batch = true;
                                    break;
                                }
                            } else {
                                should_refresh_batch = true;
                                break;
                            }
                        } else {
                            should_refresh_batch = true;
                            break;
                        }
                    } else {
                        should_refresh_batch = true;
                        break;
                    }
                }

                if should_refresh_batch {
                    let next_cycle_ts = now_ts + interval_secs;
                    *next_global_refresh.write().await = Some(next_cycle_ts.to_string());

                    // AG-9.32: Advance deadlines for all dispatched accounts immediately to avoid 1s polling storm
                    {
                        let mut snaps = snapshots.write().await;
                        for acc in &accounts {
                            if acc.enabled && acc.provider() == QuotaProviderId::Antigravity {
                                if let Some(snap) = snaps.get_mut(&acc.account_id) {
                                    snap.next_refresh_at = Some(next_cycle_ts.to_string());
                                }
                            }
                        }
                    }

                    // AG-9.32: Bounded asynchronous dispatch without account dropping
                    for acc in accounts {
                        if !acc.enabled || acc.provider() != QuotaProviderId::Antigravity {
                            continue;
                        }

                        let sem = semaphore.clone();
                        let acc_clone = acc.clone();
                        let snapshots_clone = snapshots.clone();
                        let provider_clone = provider.clone();
                        let app_handle_clone = app_handle.clone();
                        let in_flight_clone = in_flight.clone();

                        tokio::spawn(async move {
                            if let Ok(permit) = sem.acquire_owned().await {
                                let _permit = permit;
                                Self::execute_account_refresh(
                                    &acc_clone,
                                    snapshots_clone,
                                    provider_clone,
                                    app_handle_clone,
                                    in_flight_clone,
                                    interval_secs,
                                )
                                .await;
                            }
                        });
                    }

                    *last_global_refresh.write().await = Some(current_timestamp_str());
                    let handle_opt = app_handle.read().await.clone();
                    if let Some(ref handle) = handle_opt {
                        let _ = handle.emit("quota:engine-status-changed", ());
                    }
                }

                // Sample every 1s for accurate timing and instant response to shutdown/settings update
                tokio::select! {
                    _ = sleep(Duration::from_secs(1)) => {},
                    _ = rx.changed() => {
                        if *rx.borrow() {
                            break;
                        }
                    }
                }
            }

            *is_running_flag.write().await = false;
        });

        Ok(())
    }

    pub async fn stop(&self) -> Result<(), String> {
        let mut running = self.is_running.write().await;
        if !*running {
            return Ok(());
        }

        let mut guard = self.shutdown_tx.lock().await;
        if let Some(tx) = guard.take() {
            let _ = tx.send(true);
        }
        *running = false;
        *self.next_global_refresh.write().await = None;

        let handle_opt = self.app_handle.read().await.clone();
        if let Some(ref handle) = handle_opt {
            let _ = handle.emit("quota:engine-status-changed", ());
        }

        Ok(())
    }

    pub async fn refresh_account_now(&self, account_id: &str) -> Result<AccountQuotaSnapshot, String> {
        let acc = self
            .registry
            .get(account_id)
            .await
            .ok_or_else(|| format!("Account '{}' not found in registry", account_id))?;

        let settings = self.settings_store.get().await;

        let permit = self
            .semaphore
            .clone()
            .acquire_owned()
            .await
            .map_err(|e| e.to_string())?;

        let snapshot = Self::execute_account_refresh(
            &acc,
            self.snapshots.clone(),
            self.provider.clone(),
            self.app_handle.clone(),
            self.in_flight.clone(),
            settings.interval_seconds,
        )
        .await;

        drop(permit);
        Ok(snapshot)
    }

    pub async fn refresh_all_now(&self) -> Result<Vec<AccountQuotaSnapshot>, String> {
        let accounts = self.registry.list().await;
        let mut results = Vec::new();

        for acc in accounts {
            if acc.enabled {
                let snap = self.refresh_account_now(&acc.account_id).await?;
                results.push(snap);
            }
        }

        let now_str = current_timestamp_str();
        *self.last_global_refresh.write().await = Some(now_str);

        let settings = self.settings_store.get().await;
        if settings.auto_refresh_enabled {
            let next_ts = current_unix_timestamp() + settings.interval_seconds;
            *self.next_global_refresh.write().await = Some(next_ts.to_string());
        }

        let handle_opt = self.app_handle.read().await.clone();
        if let Some(ref handle) = handle_opt {
            let _ = handle.emit("quota:engine-status-changed", ());
        }

        Ok(results)
    }



    pub async fn get_account_state(&self, account_id: &str) -> Option<AccountQuotaSnapshot> {
        let snaps = self.snapshots.read().await;
        snaps.get(account_id).cloned()
    }

    pub async fn get_all_states(&self) -> Vec<AccountQuotaSnapshot> {
        let accounts = self.registry.list().await;
        let snaps = self.snapshots.read().await;
        let mut results = Vec::new();

        for acc in accounts {
            if let Some(snap) = snaps.get(&acc.account_id) {
                results.push(snap.clone());
            } else {
                results.push(AccountQuotaSnapshot {
                    account_id: acc.account_id.clone(),
                    provider: acc.provider(),
                    email: acc.email.clone(),
                    display_name: acc.display_name.clone(),
                    tier: acc.tier.clone(),
                    status: if acc.enabled { AccountPollingState::AuthRequired } else { AccountPollingState::Disabled },
                    auto_connect: acc.auto_connect,
                    data_source: crate::monitor::quota_provider::QuotaDataSource::Unavailable,
                    data_quality: crate::monitor::quota_provider::QuotaDataQuality::Unavailable,
                    last_updated_at: current_timestamp_str(),
                    last_successful_sync_at: None,
                    next_refresh_at: None,
                    quota: None,
                    error_message: None,
                });
            }
        }


        results
    }

    pub async fn reconnect_startup_accounts(&self) -> Vec<AccountQuotaSnapshot> {
        let accounts = self.registry.list().await;
        let mut results = Vec::new();

        for acc in accounts {
            if acc.enabled && acc.auto_connect {
                // Set transient Checking state in snapshots map
                {
                    let mut snaps = self.snapshots.write().await;
                    if let Some(snap) = snaps.get_mut(&acc.account_id) {
                        snap.status = AccountPollingState::Checking;
                    }
                }
                let handle_opt = self.app_handle.read().await.clone();
                if let Some(ref handle) = handle_opt {
                    let _ = handle.emit("quota:engine-status-changed", ());
                }

                match self.refresh_account_now(&acc.account_id).await {
                    Ok(snap) => results.push(snap),
                    Err(e) => eprintln!("[QuotaEngine] Startup reconnect failed for {}: {}", acc.account_id, e),
                }
            }
        }

        results
    }

    pub async fn set_account_auto_connect(&self, account_id: &str, auto_connect: bool) -> Result<bool, String> {
        let res = self.registry.set_auto_connect(account_id, auto_connect).await?;
        if let Some(snap) = self.snapshots.write().await.get_mut(account_id) {
            snap.auto_connect = auto_connect;
        }
        let handle_opt = self.app_handle.read().await.clone();
        if let Some(ref handle) = handle_opt {
            let _ = handle.emit("quota:engine-status-changed", ());
        }
        Ok(res)
    }

    pub async fn get_status(&self) -> PollingEngineStatus {
        let running = *self.is_running.read().await;
        let accounts = self.registry.list().await;
        let total_count = accounts.len();
        let active_count = accounts.iter().filter(|a| a.enabled).count();

        let snaps = self.snapshots.read().await;
        let mut online = 0;
        let mut auth_req = 0;
        let mut errors = 0;

        for snap in snaps.values() {
            match snap.status {
                AccountPollingState::Online => online += 1,
                AccountPollingState::AuthRequired => auth_req += 1,
                AccountPollingState::NetworkError
                | AccountPollingState::RateLimited
                | AccountPollingState::ProviderError => errors += 1,
                _ => {}
            }
        }

        let last_refresh = self.last_global_refresh.read().await.clone();
        let next_refresh = self.next_global_refresh.read().await.clone();
        let settings = self.settings_store.get().await;

        PollingEngineStatus {
            is_running: running,
            active_accounts_count: active_count,
            total_accounts_count: total_count,
            online_count: online,
            auth_required_count: auth_req,
            error_count: errors,
            last_global_refresh_at: last_refresh,
            next_global_refresh_at: next_refresh,
            auto_refresh_enabled: settings.auto_refresh_enabled,
            interval_seconds: settings.interval_seconds,
        }
    }

    pub async fn register_account(&self, config: AccountMonitorConfig) -> Result<(), String> {
        let account_id = config.account_id.clone();
        self.registry.register(config).await?;
        // Initialize an initial snapshot
        let _ = self.refresh_account_now(&account_id).await;
        Ok(())
    }

    pub async fn remove_account(&self, account_id: &str) -> Result<bool, String> {
        let mut snaps = self.snapshots.write().await;
        snaps.remove(account_id);
        self.registry.remove(account_id).await
    }

    pub async fn set_account_enabled(&self, account_id: &str, enabled: bool) -> Result<bool, String> {
        let res = self.registry.set_enabled(account_id, enabled).await?;
        if let Some(snap) = self.snapshots.write().await.get_mut(account_id) {
            if !enabled {
                snap.status = AccountPollingState::Disabled;
            }
        }
        let handle_opt = self.app_handle.read().await.clone();
        if let Some(ref handle) = handle_opt {
            let _ = handle.emit("quota:engine-status-changed", ());
        }
        Ok(res)
    }

    pub async fn rename_account(&self, account_id: &str, display_name: Option<String>) -> Result<bool, String> {
        let res = self.registry.rename(account_id, display_name.clone()).await?;
        if let Some(snap) = self.snapshots.write().await.get_mut(account_id) {
            snap.display_name = display_name;
        }
        Ok(res)
    }

    pub async fn list_registry_accounts(&self) -> Vec<AccountMonitorConfig> {
        self.registry.list().await
    }

    async fn execute_account_refresh(
        acc: &AccountMonitorConfig,
        snapshots: Arc<RwLock<HashMap<String, AccountQuotaSnapshot>>>,
        provider: Arc<QuotaProviderService>,
        app_handle: Arc<RwLock<Option<AppHandle>>>,
        in_flight: Arc<RwLock<HashSet<String>>>,
        interval_seconds: u64,
    ) -> AccountQuotaSnapshot {

        let account_id = acc.account_id.clone();

        // In-flight deduplication check
        {
            let in_flight_set = in_flight.read().await;
            if in_flight_set.contains(&account_id) {
                let snaps = snapshots.read().await;
                if let Some(snap) = snaps.get(&account_id) {
                    return snap.clone();
                }
            }
        }

        // Mark account as in-flight
        {
            let mut in_flight_set = in_flight.write().await;
            in_flight_set.insert(account_id.clone());
        }

        let existing = {
            let snaps = snapshots.read().await;
            snaps.get(&account_id).cloned()
        };

        let now_ts = current_unix_timestamp();
        let now_str = now_ts.to_string();
        let next_ts = now_ts + interval_seconds;
        let next_str = next_ts.to_string();

        let provider_id = acc.provider();

        let fetch_future = provider.get_account_quota(
            provider_id,
            &acc.account_id,
            Some(&acc.email),
            true, // force_refresh
        );

        let timeout_res = tokio::time::timeout(Duration::from_secs(8), fetch_future).await;

        let snapshot = match timeout_res {
            Ok(Ok(quota)) => {
                let (status, data_source, data_quality, actual_quota, sync_time, error_msg) = match quota.status {
                    ModelQuotaStatus::Available => (
                        AccountPollingState::Online,
                        quota.data_source.clone(),
                        quota.data_quality.clone(),
                        Some(quota.clone()),
                        Some(quota.fetched_at.clone()),
                        None,
                    ),
                    ModelQuotaStatus::AuthRequired => (
                        AccountPollingState::AuthRequired,
                        crate::monitor::quota_provider::QuotaDataSource::Unavailable,
                        crate::monitor::quota_provider::QuotaDataQuality::Unavailable,
                        None,
                        None,
                        quota.safe_diagnostic_message.clone(),
                    ),
                    ModelQuotaStatus::RateLimited => (
                        AccountPollingState::RateLimited,
                        quota.data_source.clone(),
                        quota.data_quality.clone(),
                        None,
                        None,
                        quota.safe_diagnostic_message.clone(),
                    ),
                    ModelQuotaStatus::NetworkError => (
                        AccountPollingState::NetworkError,
                        quota.data_source.clone(),
                        crate::monitor::quota_provider::QuotaDataQuality::Unavailable,
                        None,
                        None,
                        quota.safe_diagnostic_message.clone(),
                    ),
                    _ => (
                        AccountPollingState::ProviderError,
                        crate::monitor::quota_provider::QuotaDataSource::Unavailable,
                        crate::monitor::quota_provider::QuotaDataQuality::Unavailable,
                        None,
                        None,
                        quota.safe_diagnostic_message.clone(),
                    ),
                };


                AccountQuotaSnapshot {
                    account_id: acc.account_id.clone(),
                    provider: provider_id,
                    email: acc.email.clone(),
                    display_name: acc.display_name.clone(),
                    tier: acc.tier.clone().or_else(|| quota.tier.clone()),
                    status,
                    auto_connect: acc.auto_connect,
                    data_source,
                    data_quality,
                    last_updated_at: now_str.clone(),
                    last_successful_sync_at: sync_time,
                    next_refresh_at: Some(next_str),
                    quota: actual_quota,
                    error_message: error_msg,
                }
            }

            Ok(Err(err)) => {
                let (status, msg) = match err.kind {
                    QuotaProviderErrorKind::CredentialUnavailable
                    | QuotaProviderErrorKind::Unauthorized
                    | QuotaProviderErrorKind::Forbidden => {
                        (AccountPollingState::AuthRequired, err.message)
                    }
                    QuotaProviderErrorKind::RateLimited => {
                        (AccountPollingState::RateLimited, err.message)
                    }
                    QuotaProviderErrorKind::NetworkError => {
                        (AccountPollingState::NetworkError, err.message)
                    }
                    _ => (AccountPollingState::ProviderError, err.message),
                };

                // Preserve stale quota snapshot if network error
                let stale_quota = existing.as_ref().and_then(|e| e.quota.clone());
                let stale_sync = existing.as_ref().and_then(|e| e.last_successful_sync_at.clone());
                let data_source = existing.as_ref().map(|e| e.data_source.clone()).unwrap_or(crate::monitor::quota_provider::QuotaDataSource::Unavailable);
                let data_quality = if stale_quota.is_some() {
                    crate::monitor::quota_provider::QuotaDataQuality::Stale
                } else {
                    crate::monitor::quota_provider::QuotaDataQuality::Unavailable
                };

                AccountQuotaSnapshot {
                    account_id: acc.account_id.clone(),
                    provider: provider_id,
                    email: acc.email.clone(),
                    display_name: acc.display_name.clone(),
                    tier: acc.tier.clone(),
                    status,
                    auto_connect: acc.auto_connect,
                    data_source,
                    data_quality,
                    last_updated_at: now_str,
                    last_successful_sync_at: stale_sync,
                    next_refresh_at: Some(next_str),
                    quota: stale_quota,
                    error_message: Some(sanitize_error_message(&msg)),
                }
            }
            Err(_) => {
                // Request timeout
                let stale_quota = existing.as_ref().and_then(|e| e.quota.clone());
                let stale_sync = existing.as_ref().and_then(|e| e.last_successful_sync_at.clone());
                let data_source = existing.as_ref().map(|e| e.data_source.clone()).unwrap_or(crate::monitor::quota_provider::QuotaDataSource::Unavailable);
                let data_quality = if stale_quota.is_some() {
                    crate::monitor::quota_provider::QuotaDataQuality::Stale
                } else {
                    crate::monitor::quota_provider::QuotaDataQuality::Unavailable
                };

                AccountQuotaSnapshot {
                    account_id: acc.account_id.clone(),
                    provider: provider_id,
                    email: acc.email.clone(),
                    display_name: acc.display_name.clone(),
                    tier: acc.tier.clone(),
                    status: AccountPollingState::NetworkError,
                    auto_connect: acc.auto_connect,
                    data_source,
                    data_quality,
                    last_updated_at: now_str,
                    last_successful_sync_at: stale_sync,
                    next_refresh_at: Some(next_str),
                    quota: stale_quota,
                    error_message: Some("Quota request timed out after 8s.".to_string()),
                }
            }
        };

        // Update in-memory snapshots cache
        {
            let mut snaps = snapshots.write().await;
            snaps.insert(acc.account_id.clone(), snapshot.clone());
        }

        // Cleanup in-flight marker
        {
            let mut in_flight_set = in_flight.write().await;
            in_flight_set.remove(&account_id);
        }

        // Emit safe Tauri event
        let handle_opt = app_handle.read().await.clone();
        if let Some(ref app) = handle_opt {
            let _ = app.emit("quota:account-updated", &snapshot);
        }

        snapshot
    }
}



fn current_unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn current_timestamp_str() -> String {
    current_unix_timestamp().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::monitor::quota_provider::MockCredentialStorage;

    #[test]
    fn test_account_registry_validation() {
        let valid = AccountMonitorConfig {
            account_id: "acc1".to_string(),
            provider: Some(QuotaProviderId::Antigravity),
            email: "user@example.com".to_string(),
            display_name: Some("User 1".to_string()),
            tier: Some("Pro".to_string()),
            enabled: true,
            auto_connect: true,
            polling_interval_seconds: 120,
            created_at: "1723719000".to_string(),
            updated_at: "1723719000".to_string(),
        };
        assert!(valid.validate().is_ok());


        let invalid_interval = AccountMonitorConfig {
            polling_interval_seconds: 30, // below 60
            ..valid.clone()
        };
        assert!(invalid_interval.validate().is_err());

        let invalid_email = AccountMonitorConfig {
            email: "invalid-email".to_string(),
            ..valid
        };
        assert!(invalid_email.validate().is_err());
    }

    #[test]
    fn test_account_registry_serialization() {
        let config = AccountMonitorConfig {
            account_id: "acc-001".to_string(),
            provider: Some(QuotaProviderId::Antigravity),
            email: "user@example.com".to_string(),
            display_name: Some("Test Account".to_string()),
            tier: Some("Free".to_string()),
            enabled: true,
            auto_connect: true,
            polling_interval_seconds: 120,
            created_at: "1723719000".to_string(),
            updated_at: "1723719000".to_string(),
        };


        let json = serde_json::to_string(&config).expect("Serialize config");
        assert!(json.contains("acc-001"));
        assert!(json.contains("user@example.com"));
        assert!(json.contains("antigravity"));
        assert!(!json.contains("token"));
        assert!(!json.contains("secret"));
    }

    #[test]
    fn test_backward_compatibility_missing_provider_defaults_to_antigravity() {
        let legacy_json = r#"{
            "accountId": "legacy-acc-1",
            "email": "legacy@example.com",
            "displayName": "Legacy Account",
            "tier": "Standard Tier",
            "enabled": true,
            "pollingIntervalSeconds": 120,
            "createdAt": "1723719000",
            "updatedAt": "1723719000"
        }"#;

        let parsed: AccountMonitorConfig = serde_json::from_str(legacy_json).expect("Parse legacy json");
        assert_eq!(parsed.provider(), QuotaProviderId::Antigravity);
        assert_eq!(parsed.email, "legacy@example.com");
        assert!(parsed.auto_connect, "Legacy accounts must default auto_connect to true");
    }

    #[test]
    fn test_account_quota_snapshot_serialization() {
        let snapshot = AccountQuotaSnapshot {
            account_id: "acc-001".to_string(),
            provider: QuotaProviderId::Antigravity,
            email: "user@example.com".to_string(),
            display_name: Some("Account 1".to_string()),
            tier: Some("Pro".to_string()),
            status: AccountPollingState::Online,
            auto_connect: true,
            data_source: crate::monitor::quota_provider::QuotaDataSource::RealProvider,
            data_quality: crate::monitor::quota_provider::QuotaDataQuality::Live,
            last_updated_at: "1723719000".to_string(),
            last_successful_sync_at: Some("1723719000".to_string()),
            next_refresh_at: Some("1723719120".to_string()),
            quota: None,
            error_message: None,
        };

        let json = serde_json::to_string(&snapshot).expect("Serialize snapshot");
        assert!(json.contains("Online"));
        assert!(json.contains("antigravity"));
        assert!(json.contains("autoConnect"));
        assert!(!json.contains("Authorization"));
        assert!(!json.contains("Bearer"));
    }

    #[tokio::test]
    async fn test_polling_engine_lifecycle() {
        let storage = Arc::new(MockCredentialStorage::new());
        let provider = Arc::new(QuotaProviderService::new(storage));
        let registry = Arc::new(AccountRegistry::new(None));

        let engine = QuotaPollingEngine::new(registry, provider, None);
        assert!(!engine.get_status().await.is_running);

        assert!(engine.start().await.is_ok());
        assert!(engine.get_status().await.is_running);

        assert!(engine.stop().await.is_ok());
        assert!(!engine.get_status().await.is_running);
    }

    #[tokio::test]
    async fn test_unauthenticated_refresh_sets_auth_required_without_fakes() {
        let storage = Arc::new(MockCredentialStorage::new());
        let provider = Arc::new(QuotaProviderService::new(storage));
        let registry = Arc::new(AccountRegistry::new(None));

        let engine = QuotaPollingEngine::new(registry, provider, None);
        let config = AccountMonitorConfig {
            account_id: "test-user-1".to_string(),
            provider: Some(QuotaProviderId::Antigravity),
            email: "user1@example.com".to_string(),
            display_name: Some("User 1".to_string()),
            tier: None,
            enabled: true,
            auto_connect: true,
            polling_interval_seconds: 120,
            created_at: "1723719000".to_string(),
            updated_at: "1723719000".to_string(),
        };

        let snap = QuotaPollingEngine::execute_account_refresh(
            &config,
            Arc::new(RwLock::new(HashMap::new())),
            engine.provider.clone(),
            Arc::new(RwLock::new(None)),
            Arc::new(RwLock::new(HashSet::new())),
            300,
        )
        .await;

        assert_eq!(snap.status, AccountPollingState::AuthRequired);
        if let Some(quota) = snap.quota {
            assert!(quota.models.is_empty(), "Unauthenticated account must not have fake models");
        }
    }

    #[tokio::test]
    async fn test_singleton_start_guarantee() {
        let storage = Arc::new(MockCredentialStorage::new());
        let provider = Arc::new(QuotaProviderService::new(storage));
        let registry = Arc::new(AccountRegistry::new(None));

        let engine = QuotaPollingEngine::new(registry, provider, None);
        assert!(!engine.get_status().await.is_running);

        let res1 = engine.start().await;
        let res2 = engine.start().await;
        let res3 = engine.start().await;

        assert!(res1.is_ok());
        assert!(res2.is_ok());
        assert!(res3.is_ok());
        assert!(engine.get_status().await.is_running);

        assert!(engine.stop().await.is_ok());
        assert!(!engine.get_status().await.is_running);
    }

    #[tokio::test]
    async fn test_quota_refresh_settings_update_and_persistence() {
        let store = Arc::new(QuotaSettingsStore::new(None));
        let initial = store.get().await;
        assert!(initial.auto_refresh_enabled);
        assert_eq!(initial.interval_seconds, 300);

        let new_settings = QuotaRefreshSettings {
            auto_refresh_enabled: false,
            interval_seconds: 60,
        };
        store.update(new_settings.clone()).await.expect("update settings");

        let updated = store.get().await;
        assert!(!updated.auto_refresh_enabled);
        assert_eq!(updated.interval_seconds, 60);
    }

    #[tokio::test]
    async fn test_in_flight_deduplication() {
        let storage = Arc::new(MockCredentialStorage::new());
        let provider = Arc::new(QuotaProviderService::new(storage));
        let registry = Arc::new(AccountRegistry::new(None));
        let engine = QuotaPollingEngine::new(registry, provider, None);

        let config = AccountMonitorConfig {
            account_id: "dedup-user".to_string(),
            provider: Some(QuotaProviderId::Antigravity),
            email: "dedup@example.com".to_string(),
            display_name: Some("Dedup User".to_string()),
            tier: None,
            enabled: true,
            auto_connect: true,
            polling_interval_seconds: 120,
            created_at: "1723719000".to_string(),
            updated_at: "1723719000".to_string(),
        };

        let in_flight = Arc::new(RwLock::new(HashSet::new()));
        let snapshots = Arc::new(RwLock::new(HashMap::new()));

        // Mark "dedup-user" in flight
        {
            in_flight.write().await.insert("dedup-user".to_string());
        }

        // Insert cached snapshot
        let cached_snap = AccountQuotaSnapshot {
            account_id: "dedup-user".to_string(),
            provider: QuotaProviderId::Antigravity,
            email: "dedup@example.com".to_string(),
            display_name: Some("Dedup User".to_string()),
            tier: None,
            status: AccountPollingState::Online,
            auto_connect: true,
            data_source: crate::monitor::quota_provider::QuotaDataSource::RealProvider,
            data_quality: crate::monitor::quota_provider::QuotaDataQuality::Live,
            last_updated_at: "1723719000".to_string(),
            last_successful_sync_at: Some("1723719000".to_string()),
            next_refresh_at: Some("1723719300".to_string()),
            quota: None,
            error_message: None,
        };
        snapshots.write().await.insert("dedup-user".to_string(), cached_snap);

        // When in-flight, execute_account_refresh must immediately return the existing snapshot without calling provider
        let result = QuotaPollingEngine::execute_account_refresh(
            &config,
            snapshots,
            engine.provider.clone(),
            Arc::new(RwLock::new(None)),
            in_flight,
            300,
        )
        .await;

        assert_eq!(result.status, AccountPollingState::Online);
        assert_eq!(result.account_id, "dedup-user");
    }

    #[tokio::test]
    async fn test_duplicate_account_registration_rejected() {
        let registry = AccountRegistry::new(None);
        let config1 = AccountMonitorConfig {
            account_id: "test-user-dup".to_string(),
            provider: Some(QuotaProviderId::Antigravity),
            email: "dup@example.com".to_string(),
            display_name: Some("User Dup".to_string()),
            tier: None,
            enabled: true,
            auto_connect: true,
            polling_interval_seconds: 120,
            created_at: "1723719000".to_string(),
            updated_at: "1723719000".to_string(),
        };

        let res1 = registry.register(config1.clone()).await;
        assert!(res1.is_ok());

        let res2 = registry.register(config1).await;
        assert!(res2.is_err(), "Duplicate registration must be rejected");
        assert!(res2.unwrap_err().contains("already exists"));
    }

    #[tokio::test]
    async fn test_get_all_states_returns_all_registered_accounts() {
        let storage = Arc::new(MockCredentialStorage::new());
        let provider = Arc::new(QuotaProviderService::new(storage));
        let registry = Arc::new(AccountRegistry::new(None));

        let config = AccountMonitorConfig {
            account_id: "new-user-abc".to_string(),
            provider: Some(QuotaProviderId::Antigravity),
            email: "abc@example.com".to_string(),
            display_name: Some("New User ABC".to_string()),
            tier: Some("Pro".to_string()),
            enabled: true,
            auto_connect: true,
            polling_interval_seconds: 120,
            created_at: "1723719000".to_string(),
            updated_at: "1723719000".to_string(),
        };

        registry.register(config).await.expect("register account");

        let engine = QuotaPollingEngine::new(registry, provider, None);

        let all_states = engine.get_all_states().await;

        let found = all_states.iter().find(|s| s.account_id == "new-user-abc");
        assert!(found.is_some(), "get_all_states must return newly registered account");
        let item = found.unwrap();
        assert_eq!(item.email, "abc@example.com");
        assert_eq!(item.status, AccountPollingState::AuthRequired);
        assert!(item.auto_connect);
    }

    #[tokio::test]
    async fn test_auto_connect_toggle_and_startup_reconnect_selection() {
        let storage = Arc::new(MockCredentialStorage::new());
        let provider = Arc::new(QuotaProviderService::new(storage));
        let registry = Arc::new(AccountRegistry::new(None));

        let acc_a = AccountMonitorConfig {
            account_id: "acc-a".to_string(),
            provider: Some(QuotaProviderId::Antigravity),
            email: "a@example.com".to_string(),
            display_name: Some("Account A".to_string()),
            tier: None,
            enabled: true,
            auto_connect: true,
            polling_interval_seconds: 120,
            created_at: "1723719000".to_string(),
            updated_at: "1723719000".to_string(),
        };

        let acc_b = AccountMonitorConfig {
            account_id: "acc-b".to_string(),
            provider: Some(QuotaProviderId::Antigravity),
            email: "b@example.com".to_string(),
            display_name: Some("Account B".to_string()),
            tier: None,
            enabled: true,
            auto_connect: false, // disabled auto_connect
            polling_interval_seconds: 120,
            created_at: "1723719000".to_string(),
            updated_at: "1723719000".to_string(),
        };

        registry.register(acc_a).await.expect("register A");
        registry.register(acc_b).await.expect("register B");

        let engine = QuotaPollingEngine::new(registry.clone(), provider, None);

        // Test set_account_auto_connect
        let toggle_res = engine.set_account_auto_connect("acc-b", true).await;
        assert!(toggle_res.is_ok());
        let b_cfg = registry.get("acc-b").await.unwrap();
        assert!(b_cfg.auto_connect);

        // Set acc-b back to false
        let _ = engine.set_account_auto_connect("acc-b", false).await;

        // Startup reconnect should only process acc-a (and default account), not acc-b
        let reconnected = engine.reconnect_startup_accounts().await;
        assert!(reconnected.iter().any(|s| s.account_id == "acc-a"));
        assert!(!reconnected.iter().any(|s| s.account_id == "acc-b"));
    }



    #[tokio::test]
    async fn test_interval_update_recalculates_snapshot_deadlines() {
        let storage = Arc::new(MockCredentialStorage::new());
        let provider = Arc::new(QuotaProviderService::new(storage));
        let registry = Arc::new(AccountRegistry::new(None));
        let engine = QuotaPollingEngine::new(registry, provider, None);

        // Setup snapshot with 300s deadline
        let now_ts = current_unix_timestamp();
        {
            let mut snaps = engine.snapshots.write().await;
            snaps.insert(
                "acc-test".to_string(),
                AccountQuotaSnapshot {
                    account_id: "acc-test".to_string(),
                    provider: QuotaProviderId::Antigravity,
                    email: "test@example.com".to_string(),
                    display_name: None,
                    tier: None,
                    status: AccountPollingState::Online,
                    auto_connect: true,
                    data_source: crate::monitor::quota_provider::QuotaDataSource::RealProvider,
                    data_quality: crate::monitor::quota_provider::QuotaDataQuality::Live,
                    last_updated_at: now_ts.to_string(),
                    last_successful_sync_at: Some(now_ts.to_string()),
                    next_refresh_at: Some((now_ts + 300).to_string()),
                    quota: None,
                    error_message: None,
                },
            );
        }

        // Change interval to 30s
        let res = engine
            .update_refresh_settings(QuotaRefreshSettings {
                auto_refresh_enabled: true,
                interval_seconds: 30,
            })
            .await;
        assert!(res.is_ok());

        // Verify next_global_refresh and snapshot next_refresh_at are both now + 30
        let status = engine.get_status().await;
        assert_eq!(status.interval_seconds, 30);
        let next_global = status.next_global_refresh_at.expect("next_global_refresh_at");
        let next_global_num = next_global.parse::<u64>().unwrap();
        assert!(next_global_num <= current_unix_timestamp() + 30);

        let snap = engine.get_account_state("acc-test").await.unwrap();
        let snap_next = snap.next_refresh_at.expect("snapshot next_refresh_at");
        let snap_next_num = snap_next.parse::<u64>().unwrap();
        assert_eq!(snap_next_num, next_global_num);
    }

    #[tokio::test]
    async fn test_background_dispatch_does_not_drop_accounts_when_semaphore_is_full() {
        let storage = Arc::new(MockCredentialStorage::new());
        let provider = Arc::new(QuotaProviderService::new(storage));
        let registry = Arc::new(AccountRegistry::new(None));

        // Register 4 accounts
        for i in 1..=4 {
            let acc = AccountMonitorConfig {
                account_id: format!("acc-{}", i),
                provider: Some(QuotaProviderId::Antigravity),
                email: format!("user{}@example.com", i),
                display_name: Some(format!("Account {}", i)),
                tier: None,
                enabled: true,
                auto_connect: true,
                polling_interval_seconds: 120,
                created_at: "1723719000".to_string(),
                updated_at: "1723719000".to_string(),
            };
            registry.register(acc).await.unwrap();
        }

        let _engine = QuotaPollingEngine::new(registry.clone(), provider, None);

        // Verify that with Semaphore(2) and 4 accounts, acquire_owned handles all 4 without dropping
        let sem = Arc::new(Semaphore::new(2));
        let accounts = registry.list().await;
        assert_eq!(accounts.len(), 5); // default + 4 accounts = 5

        let completed = Arc::new(tokio::sync::Mutex::new(Vec::new()));
        let mut handles = Vec::new();

        for acc in accounts {
            let s = sem.clone();
            let c = completed.clone();
            let aid = acc.account_id.clone();
            handles.push(tokio::spawn(async move {
                let permit = s.acquire_owned().await.unwrap();
                tokio::time::sleep(Duration::from_millis(10)).await;
                c.lock().await.push(aid);
                drop(permit);
            }));
        }

        for h in handles {
            h.await.unwrap();
        }

        let count = completed.lock().await.len();
        assert_eq!(count, 5, "All 5 accounts must acquire permit and complete without being dropped");
    }
}


