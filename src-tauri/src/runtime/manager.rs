use super::model::{ProcessModel, ProcessState};
use super::registry::RuntimeRegistry;
use crate::error::DesktopError;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use super::job::JobManager;
use tokio::process::Command;
use tokio::sync::{mpsc, Mutex};

pub enum ProcessCommand {
    Stop,
    ForceStop,
}

pub struct ProcessManager {
    pub registry: Arc<RuntimeRegistry>,
    children: Arc<Mutex<HashMap<String, mpsc::Sender<ProcessCommand>>>>,
    app_handle: AppHandle,
    job_manager: Arc<JobManager>,
}

impl ProcessManager {
    pub fn new(registry: Arc<RuntimeRegistry>, app_handle: AppHandle) -> Self {
        let job_manager = match JobManager::new() {
            Ok(jm) => Arc::new(jm),
            Err(e) => {
                panic!("CRITICAL: Failed to initialize Windows JobManager: {}", e);
            }
        };

        Self {
            registry,
            children: Arc::new(Mutex::new(HashMap::new())),
            app_handle,
            job_manager,
        }
    }

    pub async fn start(
        &self,
        project_id: String,
        profile_id: String,
        command: String,
        cwd: String,
    ) -> Result<(), DesktopError> {
        let id = format!("{}-{}", project_id, profile_id);

        let mut model = ProcessModel {
            id: id.clone(),
            project_id: project_id.clone(),
            profile_id: profile_id.clone(),
            pid: None,
            parent_pid: None,
            command: command.clone(),
            args: None,
            working_directory: cwd.clone(),
            status: ProcessState::Starting,
            start_time: Some(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64,
            ),
            stop_time: None,
            exit_code: None,
        };

        self.registry.add(model.clone());
        let app_handle_starting = self.app_handle.clone();
        let p_id_starting = project_id.clone();
        let s_id_starting = profile_id.clone();
        tokio::spawn(async move {
            let _ = app_handle_starting.emit(
                "process_event",
                json!({
                    "type": "ProcessStarting",
                    "payload": {
                        "projectId": p_id_starting,
                        "profileId": s_id_starting
                    }
                }),
            );
        });

        let mut parts = command.split_whitespace();
        let cmd = parts.next().unwrap_or("").to_string();
        let args: Vec<String> = parts.map(|s| s.to_string()).collect();

        // 1. Executable Resolver
        let is_path_based = cmd.contains('/') || cmd.contains('\\');
        let executable_path = if is_path_based {
            let path = std::path::Path::new(&cwd).join(&cmd);
            if !path.exists() {
                // Return clear error if explicit executable is not found
                let mut m = model.clone();
                m.status = ProcessState::Failed;
                self.registry.add(m);
                let _ = self.app_handle.emit(
                    "process_event",
                    json!({
                        "type": "ProcessFailed",
                        "payload": {
                            "projectId": project_id,
                            "profileId": profile_id,
                            "error": format!("Executable not found: {}", path.display())
                        }
                    }),
                );
                return Err(DesktopError {
                    kind: "ExecutionFailed".to_string(),
                    message: format!("Executable not found: {}", path.display()),
                });
            }
            path.to_string_lossy().to_string()
        } else {
            cmd.clone()
        };

        // 2. Command Construction
        #[cfg(target_os = "windows")]
        let mut child_cmd = {
            let resolved_cmd = if is_path_based {
                executable_path
            } else {
                match executable_path.to_lowercase().as_str() {
                    "npm" => "npm.cmd".to_string(),
                    "npx" => "npx.cmd".to_string(),
                    "pnpm" => "pnpm.cmd".to_string(),
                    "yarn" => "yarn.cmd".to_string(),
                    "node" => "node.exe".to_string(),
                    "vite" => "vite.cmd".to_string(),
                    _ => executable_path,
                }
            };
            let mut c = Command::new(resolved_cmd);
            c.args(args);
            c
        };

        #[cfg(not(target_os = "windows"))]
        let mut child_cmd = {
            let mut c = Command::new(executable_path);
            c.args(args);
            c
        };

        child_cmd.current_dir(cwd.clone());
        child_cmd.stdout(std::process::Stdio::piped());
        child_cmd.stderr(std::process::Stdio::piped());

        match child_cmd.spawn() {
            Ok(mut child) => {
                let pid_opt = child.id();

                if let Some(pid) = pid_opt {
                    if let Err(e) = self.job_manager.assign(pid) {
                        println!("Job assignment failed for pid {}: {}", pid, e);
                    }
                }

                model.status = ProcessState::Running;
                model.pid = pid_opt;
                self.registry.add(model.clone());

                let stdout = child.stdout.take();
                let stderr = child.stderr.take();

                let (tx, mut rx) = mpsc::channel(1);
                {
                    let mut children = self.children.lock().await;
                    children.insert(id.clone(), tx);
                }

                let app_handle_started = self.app_handle.clone();
                let p_id_started = project_id.clone();
                let s_id_started = profile_id.clone();
                tokio::spawn(async move {
                    let _ = app_handle_started.emit(
                        "process_event",
                        json!({
                            "type": "ProcessStarted",
                            "payload": {
                                "projectId": p_id_started,
                                "profileId": s_id_started,
                                "status": "running",
                                "pid": pid_opt
                            }
                        }),
                    );
                });

                let app_handle_out = self.app_handle.clone();
                let p_id_out = project_id.clone();
                let s_id_out = profile_id.clone();
                if let Some(out) = stdout {
                    tokio::spawn(async move {
                        use tokio::io::AsyncBufReadExt;
                        let mut reader = tokio::io::BufReader::new(out).lines();
                        let mut buffer = Vec::new();
                        let mut last_emit = tokio::time::Instant::now();
                        loop {
                            match tokio::time::timeout(tokio::time::Duration::from_millis(50), reader.next_line()).await {
                                Ok(Ok(Some(line))) => {
                                    buffer.push(line);
                                    if buffer.len() >= 50 || last_emit.elapsed().as_millis() >= 50 {
                                        let app_handle = app_handle_out.clone();
                                        let payload = json!({
                                            "type": "ProcessOutput",
                                            "payload": {
                                                "projectId": p_id_out.clone(),
                                                "profileId": s_id_out.clone(),
                                                "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
                                                "streamType": "stdout",
                                                "message": buffer.join("\n")
                                            }
                                        });
                                        tokio::spawn(async move { let _ = app_handle.emit("process_event", payload); });
                                        buffer.clear();
                                        last_emit = tokio::time::Instant::now();
                                    }
                                }
                                Ok(Ok(None)) | Ok(Err(_)) => {
                                    if !buffer.is_empty() {
                                        let app_handle = app_handle_out.clone();
                                        let payload = json!({
                                            "type": "ProcessOutput",
                                            "payload": {
                                                "projectId": p_id_out.clone(),
                                                "profileId": s_id_out.clone(),
                                                "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
                                                "streamType": "stdout",
                                                "message": buffer.join("\n")
                                            }
                                        });
                                        tokio::spawn(async move { let _ = app_handle.emit("process_event", payload); });
                                    }
                                    break;
                                }
                                Err(_) => {
                                    if !buffer.is_empty() {
                                        let app_handle = app_handle_out.clone();
                                        let payload = json!({
                                            "type": "ProcessOutput",
                                            "payload": {
                                                "projectId": p_id_out.clone(),
                                                "profileId": s_id_out.clone(),
                                                "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
                                                "streamType": "stdout",
                                                "message": buffer.join("\n")
                                            }
                                        });
                                        tokio::spawn(async move { let _ = app_handle.emit("process_event", payload); });
                                        buffer.clear();
                                        last_emit = tokio::time::Instant::now();
                                    }
                                }
                            }
                        }
                    });
                }

                let app_handle_err = self.app_handle.clone();
                let p_id_err = project_id.clone();
                let s_id_err = profile_id.clone();
                if let Some(err) = stderr {
                    tokio::spawn(async move {
                        use tokio::io::AsyncBufReadExt;
                        let mut reader = tokio::io::BufReader::new(err).lines();
                        let mut buffer = Vec::new();
                        let mut last_emit = tokio::time::Instant::now();
                        loop {
                            match tokio::time::timeout(tokio::time::Duration::from_millis(50), reader.next_line()).await {
                                Ok(Ok(Some(line))) => {
                                    buffer.push(line);
                                    if buffer.len() >= 50 || last_emit.elapsed().as_millis() >= 50 {
                                        let app_handle = app_handle_err.clone();
                                        let payload = json!({
                                            "type": "ProcessErrorOutput",
                                            "payload": {
                                                "projectId": p_id_err.clone(),
                                                "profileId": s_id_err.clone(),
                                                "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
                                                "streamType": "stderr",
                                                "message": buffer.join("\n")
                                            }
                                        });
                                        tokio::spawn(async move { let _ = app_handle.emit("process_event", payload); });
                                        buffer.clear();
                                        last_emit = tokio::time::Instant::now();
                                    }
                                }
                                Ok(Ok(None)) | Ok(Err(_)) => {
                                    if !buffer.is_empty() {
                                        let app_handle = app_handle_err.clone();
                                        let payload = json!({
                                            "type": "ProcessErrorOutput",
                                            "payload": {
                                                "projectId": p_id_err.clone(),
                                                "profileId": s_id_err.clone(),
                                                "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
                                                "streamType": "stderr",
                                                "message": buffer.join("\n")
                                            }
                                        });
                                        tokio::spawn(async move { let _ = app_handle.emit("process_event", payload); });
                                    }
                                    break;
                                }
                                Err(_) => {
                                    if !buffer.is_empty() {
                                        let app_handle = app_handle_err.clone();
                                        let payload = json!({
                                            "type": "ProcessErrorOutput",
                                            "payload": {
                                                "projectId": p_id_err.clone(),
                                                "profileId": s_id_err.clone(),
                                                "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
                                                "streamType": "stderr",
                                                "message": buffer.join("\n")
                                            }
                                        });
                                        tokio::spawn(async move { let _ = app_handle.emit("process_event", payload); });
                                        buffer.clear();
                                        last_emit = tokio::time::Instant::now();
                                    }
                                }
                            }
                        }
                    });
                }

                // Actor Task to manage lifecycle
                let actor_app_handle = self.app_handle.clone();
                let actor_registry = self.registry.clone();
                let actor_children = self.children.clone();
                let actor_id = id.clone();

                tokio::spawn(async move {
                    tokio::select! {
                        status_res = child.wait() => {
                            let exit_code = status_res.ok().and_then(|s| s.code()).unwrap_or(-1);
                            // Cleanup handles
                            let mut children_map = actor_children.lock().await;
                            children_map.remove(&actor_id);

                            // 1. Update Registry First (Source of Truth)
                            if let Some(mut m) = actor_registry.find_by_id(&actor_id) {
                                m.status = if exit_code == 0 {
                                    ProcessState::Exited
                                } else {
                                    ProcessState::Failed
                                };
                                m.stop_time = Some(
                                    std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap_or_default()
                                        .as_millis() as u64,
                                );
                                m.exit_code = Some(exit_code);
                                actor_registry.add(m);
                            }

                            // 2. Emit Event Second
                            let _ = actor_app_handle.emit("process_event", json!({
                                "type": "ProcessExited",
                                "payload": {
                                    "projectId": project_id.clone(),
                                    "profileId": profile_id.clone(),
                                    "exitCode": exit_code
                                }
                            }));
                        }
                        cmd_opt = rx.recv() => {
                            if let Some(cmd) = cmd_opt {
                                let exit_code = match cmd {
                                    ProcessCommand::Stop | ProcessCommand::ForceStop => {
                                        if let Some(pid) = pid_opt {
                                            let _ = crate::runtime::terminator::force_kill_process_tree(pid).await;
                                        }

                                        let _ = child.kill().await;

                                        let timeout_duration = std::time::Duration::from_secs(3);
                                        match tokio::time::timeout(timeout_duration, child.wait()).await {
                                            Ok(status_res) => {
                                                status_res.ok().and_then(|s| s.code()).unwrap_or(-1)
                                            },
                                            Err(_) => {
                                                let _ = child.kill().await;
                                                let status_res = child.wait().await;
                                                status_res.ok().and_then(|s| s.code()).unwrap_or(-1)
                                            }
                                        }
                                    }
                                };

                                // 1. Update Registry First (Source of Truth)
                                if let Some(mut m) = actor_registry.find_by_id(&actor_id) {
                                    m.status = ProcessState::Stopped; // Explicitly set to Stopped for manual termination
                                    m.stop_time = Some(
                                        std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap_or_default()
                                            .as_millis() as u64,
                                    );
                                    m.exit_code = Some(exit_code);
                                    actor_registry.add(m);
                                }

                                // 2. Emit Event Second
                                let _ = actor_app_handle.emit("process_event", json!({
                                    "type": "ProcessStopped",
                                    "payload": {
                                        "projectId": project_id.clone(),
                                        "profileId": profile_id.clone(),
                                        "exitCode": exit_code
                                    }
                                }));
                            }
                        }
                    }
                });

                Ok(())
            }
            Err(e) => {
                model.status = ProcessState::Failed;
                self.registry.add(model);
                let _ = self.app_handle.emit(
                    "process_event",
                    json!({
                        "type": "ProcessFailed",
                        "payload": {
                            "projectId": project_id,
                            "profileId": profile_id,
                            "error": e.to_string()
                        }
                    }),
                );
                Err(DesktopError {
                    kind: "ExecutionFailed".to_string(),
                    message: e.to_string(),
                })
            }
        }
    }

    pub async fn stop(&self, project_id: String, profile_id: String) -> Result<(), DesktopError> {
        let id = format!("{}-{}", project_id, profile_id);

        let mut children = self.children.lock().await;
        if let Some(tx) = children.remove(&id) {
            let _ = tx.send(ProcessCommand::Stop).await;
            Ok(())
        } else {
            Err(DesktopError {
                kind: "NotFound".to_string(),
                message: "Process not running".to_string(),
            })
        }
    }

    pub async fn force_stop(
        &self,
        project_id: String,
        profile_id: String,
    ) -> Result<(), DesktopError> {
        let id = format!("{}-{}", project_id, profile_id);

        let mut children = self.children.lock().await;
        if let Some(tx) = children.remove(&id) {
            let _ = tx.send(ProcessCommand::ForceStop).await;
            Ok(())
        } else {
            Err(DesktopError {
                kind: "NotFound".to_string(),
                message: "Process not running".to_string(),
            })
        }
    }

    pub async fn restart(
        &self,
        project_id: String,
        profile_id: String,
        command: String,
        cwd: String,
    ) -> Result<(), DesktopError> {
        let id = format!("{}-{}", project_id, profile_id);
        
        if let Some(mut m) = self.registry.find_by_id(&id) {
            m.status = ProcessState::Restarting;
            self.registry.add(m);
            let _ = self.app_handle.emit(
                "process_event",
                json!({
                    "type": "ProcessRestarting",
                    "payload": {
                        "projectId": project_id,
                        "profileId": profile_id
                    }
                }),
            );
        }

        let _ = self.stop(project_id.clone(), profile_id.clone()).await;

        let mut attempts = 0;
        while attempts < 20 {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            if let Some(m) = self.registry.find_by_id(&id) {
                if m.status != ProcessState::Stopping && m.status != ProcessState::Running && m.status != ProcessState::Starting {
                    break;
                }
            } else {
                break;
            }
            attempts += 1;
        }

        // Delay to allow OS ports to be fully released
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        self.start(project_id, profile_id, command, cwd).await
    }

    pub async fn shutdown(&self) {
        let active_ids: Vec<String> = {
            let children = self.children.lock().await;
            children.keys().cloned().collect()
        };

        for id in active_ids {
            let parts: Vec<&str> = id.splitn(2, '-').collect();
            if parts.len() == 2 {
                let _ = self.stop(parts[0].to_string(), parts[1].to_string()).await;
            }
        }
        
        let mut attempts = 0;
        while attempts < 30 {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            let count = {
                let children = self.children.lock().await;
                children.len()
            };
            if count == 0 {
                break;
            }
            attempts += 1;
        }
    }
}

