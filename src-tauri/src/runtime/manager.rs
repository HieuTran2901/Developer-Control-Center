use super::model::{ProcessModel, ProcessState, ReadinessState};
use super::registry::RuntimeRegistry;
use crate::error::DesktopError;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
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
}

impl ProcessManager {
    pub fn new(registry: Arc<RuntimeRegistry>, app_handle: AppHandle) -> Self {
        Self {
            registry,
            children: Arc::new(Mutex::new(HashMap::new())),
            app_handle,
        }
    }

    pub async fn start(
        &self,
        project_id: String,
        profile_id: String,
        command: String,
        cwd: String,
        readiness_regex: Option<String>,
        readiness_config: Option<crate::runtime::model::ReadinessStrategy>,
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
            readiness: ReadinessState::Unknown,
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

        #[cfg(target_os = "windows")]
        let job_manager = crate::runtime::job::JobManager::new().ok();
        #[cfg(not(target_os = "windows"))]
        let job_manager = crate::runtime::job::JobManager::new().ok();

        match child_cmd.spawn() {
            Ok(mut child) => {
                let pid_opt = child.id();

                if let Some(pid) = pid_opt {
                    if let Some(ref jm) = job_manager {
                        if let Err(e) = jm.assign(pid) {
                            println!("Job assignment failed for pid {}: {}", pid, e);
                        }
                    }
                }

                model.status = ProcessState::Running;
                model.readiness = ReadinessState::Waiting;
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
                                "readiness": "waiting",
                                "pid": pid_opt
                            }
                        }),
                    );
                });

                let resolved_readiness = crate::runtime::readiness::ReadinessResolver::resolve(&command, readiness_regex.clone(), readiness_config);
                
                let regex_pattern = match &resolved_readiness {
                    crate::runtime::model::ReadinessStrategy::LogPattern { pattern } => Some(pattern.clone()),
                    _ => None,
                };
                let regex_pattern_err = regex_pattern.clone();
                
                let app_handle_timeout = self.app_handle.clone();
                let p_id_timeout = project_id.clone();
                let s_id_timeout = profile_id.clone();
                let id_timeout = id.clone();
                let registry_timeout = self.registry.clone();
                
                tokio::spawn(async move {
                    match resolved_readiness {
                        crate::runtime::model::ReadinessStrategy::None => {
                            // If strategy is None, just set it to ready immediately
                            if let Some(mut m) = registry_timeout.find_by_id(&id_timeout) {
                                if m.status == ProcessState::Running && m.readiness == ReadinessState::Waiting {
                                    m.readiness = ReadinessState::Ready;
                                    registry_timeout.add(m);
                                    let _ = app_handle_timeout.emit(
                                        "process_event",
                                        json!({
                                            "type": "ProcessReadinessChanged",
                                            "payload": {
                                                "projectId": p_id_timeout,
                                                "profileId": s_id_timeout,
                                                "readiness": "ready"
                                            }
                                        }),
                                    );
                                }
                            }
                        }
                        crate::runtime::model::ReadinessStrategy::Port { port } => {
                            // Poll port
                            let mut attempts = 0;
                            while attempts < 150 { // wait up to 150 * 200ms = 30 seconds
                                tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                                if let Ok(_stream) = tokio::net::TcpStream::connect(format!("127.0.0.1:{}", port)).await {
                                    if let Some(mut m) = registry_timeout.find_by_id(&id_timeout) {
                                        if m.status == ProcessState::Running && m.readiness == ReadinessState::Waiting {
                                            m.readiness = ReadinessState::Ready;
                                            registry_timeout.add(m);
                                            let _ = app_handle_timeout.emit(
                                                "process_event",
                                                json!({
                                                    "type": "ProcessReadinessChanged",
                                                    "payload": {
                                                        "projectId": p_id_timeout,
                                                        "profileId": s_id_timeout,
                                                        "readiness": "ready"
                                                    }
                                                }),
                                            );
                                        }
                                    }
                                    break;
                                }
                                attempts += 1;
                            }
                        }
                        crate::runtime::model::ReadinessStrategy::Http { path: _ } => {
                            // Http polling is not implemented properly yet, just wait for port 8080 or rely on fallback
                            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                            if let Some(mut m) = registry_timeout.find_by_id(&id_timeout) {
                                if m.status == ProcessState::Running && m.readiness == ReadinessState::Waiting {
                                    m.readiness = ReadinessState::Ready;
                                    registry_timeout.add(m);
                                    let _ = app_handle_timeout.emit(
                                        "process_event",
                                        json!({
                                            "type": "ProcessReadinessChanged",
                                            "payload": {
                                                "projectId": p_id_timeout,
                                                "profileId": s_id_timeout,
                                                "readiness": "ready"
                                            }
                                        }),
                                    );
                                }
                            }
                        }
                        crate::runtime::model::ReadinessStrategy::LogPattern { .. } => {
                            // Handled in the log streams
                        }
                    }
                });

                let registry_out = self.registry.clone();
                let id_out = id.clone();
                let app_handle_out = self.app_handle.clone();
                let p_id_out = project_id.clone();
                let s_id_out = profile_id.clone();
                if let Some(mut out) = stdout {
                    tokio::spawn(async move {
                        use tokio::io::AsyncReadExt;
                        let mut read_buf = [0u8; 2048];
                        let mut buffer = Vec::new();
                        let mut readiness_buffer = String::new();
                        let mut last_emit = tokio::time::Instant::now();
                        let mut regex = regex_pattern.and_then(|p| regex::Regex::new(&p).ok());
                        
                        loop {
                            tokio::select! {
                                res = out.read(&mut read_buf) => {
                                    match res {
                                        Ok(0) => {
                                            // EOF
                                            if !buffer.is_empty() {
                                                let app_handle = app_handle_out.clone();
                                                let payload = json!({
                                                    "type": "ProcessOutput",
                                                    "payload": {
                                                        "projectId": p_id_out.clone(),
                                                        "profileId": s_id_out.clone(),
                                                        "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
                                                        "streamType": "stdout",
                                                        "message": buffer.join("")
                                                    }
                                                });
                                                tokio::spawn(async move { let _ = app_handle.emit("process_event", payload); });
                                            }
                                            break;
                                        }
                                        Ok(n) => {
                                            let chunk = String::from_utf8_lossy(&read_buf[..n]).into_owned();
                                            
                                            // Readiness check
                                            if let Some(ref re) = regex {
                                                readiness_buffer.push_str(&chunk);
                                                let clean_line = crate::runtime::ansi::strip_ansi(&readiness_buffer);
                                                if re.is_match(&clean_line) {
                                                    if let Some(mut m) = registry_out.find_by_id(&id_out) {
                                                        if m.status == ProcessState::Running && m.readiness == ReadinessState::Waiting {
                                                            m.readiness = ReadinessState::Ready;
                                                            registry_out.add(m);
                                                            let _ = app_handle_out.emit(
                                                                "process_event",
                                                                json!({
                                                                    "type": "ProcessReadinessChanged",
                                                                    "payload": {
                                                                        "projectId": p_id_out,
                                                                        "profileId": s_id_out,
                                                                        "readiness": "ready"
                                                                    }
                                                                }),
                                                            );
                                                        }
                                                    }
                                                    regex = None; // Stop checking
                                                }
                                                // Prevent buffer from growing infinitely
                                                if readiness_buffer.len() > 2048 {
                                                    let keep_len = 1024;
                                                    let new_start = readiness_buffer.len() - keep_len;
                                                    let kept = readiness_buffer[new_start..].to_string();
                                                    readiness_buffer = kept;
                                                }
                                            }
                                            
                                            buffer.push(chunk);
                                            if buffer.len() >= 50 || last_emit.elapsed().as_millis() >= 50 {
                                                let app_handle = app_handle_out.clone();
                                                let payload = json!({
                                                    "type": "ProcessOutput",
                                                    "payload": {
                                                        "projectId": p_id_out.clone(),
                                                        "profileId": s_id_out.clone(),
                                                        "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
                                                        "streamType": "stdout",
                                                        "message": buffer.join("")
                                                    }
                                                });
                                                tokio::spawn(async move { let _ = app_handle.emit("process_event", payload); });
                                                buffer.clear();
                                                last_emit = tokio::time::Instant::now();
                                            }
                                        }
                                        Err(_) => {
                                            break; // Stream error
                                        }
                                    }
                                }
                                _ = tokio::time::sleep(tokio::time::Duration::from_millis(50)) => {
                                    if !buffer.is_empty() {
                                        let app_handle = app_handle_out.clone();
                                        let payload = json!({
                                            "type": "ProcessOutput",
                                            "payload": {
                                                "projectId": p_id_out.clone(),
                                                "profileId": s_id_out.clone(),
                                                "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
                                                "streamType": "stdout",
                                                "message": buffer.join("")
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

                let registry_err = self.registry.clone();
                let id_err = id.clone();
                let app_handle_err = self.app_handle.clone();
                let p_id_err = project_id.clone();
                let s_id_err = profile_id.clone();
                if let Some(mut err) = stderr {
                    tokio::spawn(async move {
                        use tokio::io::AsyncReadExt;
                        let mut read_buf = [0u8; 2048];
                        let mut buffer = Vec::new();
                        let mut readiness_buffer = String::new();
                        let mut last_emit = tokio::time::Instant::now();
                        let mut regex = regex_pattern_err.and_then(|p| regex::Regex::new(&p).ok());
                        
                        loop {
                            tokio::select! {
                                res = err.read(&mut read_buf) => {
                                    match res {
                                        Ok(0) => {
                                            // EOF
                                            if !buffer.is_empty() {
                                                let app_handle = app_handle_err.clone();
                                                let payload = json!({
                                                    "type": "ProcessErrorOutput",
                                                    "payload": {
                                                        "projectId": p_id_err.clone(),
                                                        "profileId": s_id_err.clone(),
                                                        "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
                                                        "streamType": "stderr",
                                                        "message": buffer.join("")
                                                    }
                                                });
                                                tokio::spawn(async move { let _ = app_handle.emit("process_event", payload); });
                                            }
                                            break;
                                        }
                                        Ok(n) => {
                                            let chunk = String::from_utf8_lossy(&read_buf[..n]).into_owned();
                                            
                                            // Readiness check
                                            if let Some(ref re) = regex {
                                                readiness_buffer.push_str(&chunk);
                                                let clean_line = crate::runtime::ansi::strip_ansi(&readiness_buffer);
                                                if re.is_match(&clean_line) {
                                                    if let Some(mut m) = registry_err.find_by_id(&id_err) {
                                                        if m.status == ProcessState::Running && m.readiness == ReadinessState::Waiting {
                                                            m.readiness = ReadinessState::Ready;
                                                            registry_err.add(m);
                                                            let _ = app_handle_err.emit(
                                                                "process_event",
                                                                json!({
                                                                    "type": "ProcessReadinessChanged",
                                                                    "payload": {
                                                                        "projectId": p_id_err,
                                                                        "profileId": s_id_err,
                                                                        "readiness": "ready"
                                                                    }
                                                                }),
                                                            );
                                                        }
                                                    }
                                                    regex = None; // Stop checking
                                                }
                                                // Prevent buffer from growing infinitely
                                                if readiness_buffer.len() > 2048 {
                                                    let keep_len = 1024;
                                                    let new_start = readiness_buffer.len() - keep_len;
                                                    let kept = readiness_buffer[new_start..].to_string();
                                                    readiness_buffer = kept;
                                                }
                                            }
                                            
                                            buffer.push(chunk);
                                            if buffer.len() >= 50 || last_emit.elapsed().as_millis() >= 50 {
                                                let app_handle = app_handle_err.clone();
                                                let payload = json!({
                                                    "type": "ProcessErrorOutput",
                                                    "payload": {
                                                        "projectId": p_id_err.clone(),
                                                        "profileId": s_id_err.clone(),
                                                        "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
                                                        "streamType": "stderr",
                                                        "message": buffer.join("")
                                                    }
                                                });
                                                tokio::spawn(async move { let _ = app_handle.emit("process_event", payload); });
                                                buffer.clear();
                                                last_emit = tokio::time::Instant::now();
                                            }
                                        }
                                        Err(_) => {
                                            break; // Stream error
                                        }
                                    }
                                }
                                _ = tokio::time::sleep(tokio::time::Duration::from_millis(50)) => {
                                    if !buffer.is_empty() {
                                        let app_handle = app_handle_err.clone();
                                        let payload = json!({
                                            "type": "ProcessErrorOutput",
                                            "payload": {
                                                "projectId": p_id_err.clone(),
                                                "profileId": s_id_err.clone(),
                                                "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
                                                "streamType": "stderr",
                                                "message": buffer.join("")
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
                    let _job_manager = job_manager; // Move JobManager into actor task to tie its lifetime to the actor
                    
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
                                m.readiness = ReadinessState::Unknown;
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
                                    "exitCode": exit_code,
                                    "pid": pid_opt
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
                                    m.readiness = ReadinessState::Unknown;
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
                                        "exitCode": exit_code,
                                        "pid": pid_opt
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
        readiness_regex: Option<String>,
        readiness_config: Option<crate::runtime::model::ReadinessStrategy>,
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
        self.start(project_id, profile_id, command, cwd, readiness_regex, readiness_config).await
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

