use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use sysinfo::{Pid, System};
use tauri::{AppHandle, Emitter, State};

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
}

impl MonitorState {
    pub fn new() -> Self {
        Self {
            watched_pids: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

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

pub fn init_monitor_worker(app: AppHandle, watched_pids: Arc<RwLock<Vec<u32>>>) {
    tauri::async_runtime::spawn(async move {
        let mut sys = System::new_all();
        
        loop {
            tokio::time::sleep(Duration::from_secs(1)).await;
            
            let pids = watched_pids.read().await.clone();
            if pids.is_empty() {
                continue; // Skip sys refresh if nothing to monitor
            }
            
            // Refresh process info
            sys.refresh_processes_specifics(sysinfo::ProcessesToUpdate::Some(&pids.iter().map(|&p| Pid::from_u32(p)).collect::<Vec<_>>()), true, sysinfo::ProcessRefreshKind::nothing().with_cpu().with_memory());
            
            let mut metrics_list = Vec::new();
            
            for pid_u32 in pids {
                if let Some(process) = sys.process(Pid::from_u32(pid_u32)) {
                    metrics_list.push(ProcessMetricsDto {
                        pid: pid_u32,
                        cpu: process.cpu_usage(), // %
                        memory: process.memory(), // bytes
                        threads: 0, // sysinfo threads requires different handling, setting 0 for now as placeholder or we can get it if needed. Actually sysinfo doesn't easily expose thread count on all OS without full refresh.
                        uptime: process.run_time(), // seconds
                        start_time: process.start_time(), // timestamp
                    });
                }
            }
            
            if !metrics_list.is_empty() {
                let _ = app.emit("process_metrics", metrics_list);
            }
        }
    });
}

