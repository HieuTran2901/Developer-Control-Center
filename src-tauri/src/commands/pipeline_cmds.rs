use std::sync::Arc;
use tauri::{AppHandle, State};
use crate::pipeline::events::PipelineExecutionManager;
use crate::pipeline::domain::{PipelineDefinition, PipelineStatus, PipelineStage, PipelineStep, PipelineStepType, StepConfig};
use crate::pipeline::execution::PipelineExecutor;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionStateDto {
    pub execution_id: String,
    pub pipeline_id: String,
    pub status: PipelineStatus,
    pub start_time_ms: u64,
    pub end_time_ms: Option<u64>,
    pub is_cancelled: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineRunDto {
    pub id: String,
    pub name: String,
    pub project: String,
    pub status: String,
    pub branch: String,
    pub commit: String,
    pub commit_message: String,
    pub duration: String,
    pub triggered_at: String,
    pub triggered_by: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatsDto {
    pub total: u32,
    pub success: u32,
    pub failed: u32,
    pub cancelled: u32,
    pub running: u32,
}

#[tauri::command]
pub async fn get_pipeline_execution_state(
    execution_id: String,
    manager: State<'_, Arc<PipelineExecutionManager>>,
) -> Result<ExecutionStateDto, String> {
    let ctx = manager.get_execution(&execution_id).ok_or_else(|| {
        format!("Execution ID '{}' not found", execution_id)
    })?;

    let end_time = *ctx.end_time_ms.lock().unwrap();

    Ok(ExecutionStateDto {
        execution_id: ctx.execution_id.clone(),
        pipeline_id: ctx.pipeline_id.clone(),
        status: ctx.get_pipeline_status(),
        start_time_ms: ctx.start_time_ms,
        end_time_ms: end_time,
        is_cancelled: ctx.is_cancelled(),
    })
}

#[tauri::command]
pub async fn list_active_executions(
    manager: State<'_, Arc<PipelineExecutionManager>>,
) -> Result<Vec<String>, String> {
    Ok(manager.list_active_executions())
}

#[tauri::command]
pub async fn submit_step_approval(
    approval_id: String,
    approved: bool,
    policy_engine: State<'_, Arc<crate::policy::PolicyEngine>>,
    history_store: State<'_, Arc<crate::pipeline::history::PipelineHistoryStore>>,
) -> Result<(), String> {
    if approved {
        approve_approval(approval_id, policy_engine, history_store).await
    } else {
        reject_approval(approval_id, policy_engine, history_store).await
    }
}

#[tauri::command]
pub async fn get_pipelines() -> Result<Vec<PipelineDefinition>, String> {
    let mock_pipeline = PipelineDefinition {
        id: "web-app-pipeline".into(),
        name: "Web Application Pipeline".into(),
        description: Some("Builds and tests the React frontend".into()),
        version: 1,
        trigger: "manual".into(),
        triggers: None,
        verification_status: Default::default(),
        confidence_score: 1.0,
        provenance: None,
        stages: vec![
            PipelineStage {
                id: "stage-1".into(),
                name: "Build & Check".into(),
                order: 1,
                steps: vec![
                    PipelineStep {
                        id: "step-1".into(),
                        name: "Echo Test".into(),
                        step_type: PipelineStepType::Command,
                        config: StepConfig::Command {
                            command: "cmd".into(),
                            args: vec!["/c".into(), "echo Build successful".into()],
                            cwd: None,
                        },
                        order: 1,
                        timeout_seconds: Some(30),
                        provenance: None,
                    }
                ],
            },
            PipelineStage {
                id: "stage-2".into(),
                name: "AI Security Scan".into(),
                order: 2,
                steps: vec![
                    PipelineStep {
                        id: "step-2".into(),
                        name: "Scan".into(),
                        step_type: PipelineStepType::Approval,
                        config: StepConfig::Approval {
                            approvers: vec!["admin".into()],
                            timeout_seconds: Some(60),
                        },
                        order: 1,
                        timeout_seconds: Some(60),
                        provenance: None,
                    }
                ],
            }
        ],
        metadata: std::collections::HashMap::new(),
        status: Default::default(),
    };
    Ok(vec![mock_pipeline])
}

#[tauri::command]
pub async fn get_recent_executions() -> Result<Vec<PipelineRunDto>, String> {
    Ok(vec![
        PipelineRunDto {
            id: "run-1245".into(),
            name: "Web Application Pipeline".into(),
            project: "dcc-frontend".into(),
            status: "Success".into(),
            branch: "main".into(),
            commit: "a1b2c3d".into(),
            commit_message: "feat: runtime integration".into(),
            duration: "2m 10s".into(),
            triggered_at: "5m ago".into(),
            triggered_by: "DevUser".into(),
        }
    ])
}

#[tauri::command]
pub async fn get_pipeline_health_stats() -> Result<HealthStatsDto, String> {
    Ok(HealthStatsDto {
        total: 10,
        success: 9,
        failed: 1,
        cancelled: 0,
        running: 0,
    })
}

#[tauri::command]
pub async fn trigger_pipeline(
    pipeline_id: String,
    manager: State<'_, Arc<PipelineExecutionManager>>,
    ai_gateway: State<'_, Arc<crate::ai::AIGateway>>,
    policy_engine: State<'_, Arc<crate::policy::PolicyEngine>>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let pipelines = get_pipelines().await?;
    let target = pipelines.into_iter().find(|p| p.id == pipeline_id)
        .ok_or_else(|| "Pipeline not found".to_string())?;

    let executor = PipelineExecutor::new(
        Some(Arc::clone(&ai_gateway)),
        Some(app_handle.clone()),
        Arc::clone(&manager),
    ).with_policy_engine(Arc::clone(&policy_engine));

    tauri::async_runtime::spawn(async move {
        let _ = executor.execute(&target).await;
    });

    Ok("dispatched".into())
}

#[tauri::command]
pub async fn analyze_folder_scope_cmd(
    folder_path: String,
) -> Result<crate::pipeline::scope::FolderScopeAnalysis, String> {
    let path = std::path::PathBuf::from(&folder_path);
    let analysis = tokio::task::spawn_blocking(move || {
        crate::pipeline::scope::FolderSafetyGuard::analyze_scope(&path)
    })
    .await
    .map_err(|e| format!("Scope analysis failed: {}", e))?;
    Ok(analysis)
}

#[tauri::command]
pub async fn scan_project_cmd(
    project_root_path: String,
) -> Result<crate::pipeline::discovery::ProjectIntelligence, String> {
    let root = std::path::PathBuf::from(&project_root_path);
    if !root.exists() || !root.is_dir() {
        return Err(format!("Invalid project root: {}", project_root_path));
    }
    
    let intelligence = tokio::task::spawn_blocking(move || {
        crate::pipeline::discovery::ProjectScanner::scan(&root)
    })
    .await
    .map_err(|e| format!("Project scan failed: {}", e))?;
    Ok(intelligence)
}

#[tauri::command]
pub async fn generate_pipeline_cmd(
    user_intent: String,
    project_root_path: String,
    ai_gateway: State<'_, Arc<crate::ai::AIGateway>>,
    policy_engine: State<'_, Arc<crate::policy::PolicyEngine>>,
    history_store: State<'_, Arc<crate::pipeline::history::PipelineHistoryStore>>,
) -> Result<crate::ai::planner::PipelineGenerationResult, String> {
    let root = std::path::PathBuf::from(&project_root_path);
    if !root.exists() || !root.is_dir() {
        return Err(format!("Invalid project root: {}", project_root_path));
    }
    
    let context = crate::pipeline::discovery::ProjectScanner::scan(&root);
    let mut res = crate::ai::planner::generate_pipeline(&ai_gateway, &policy_engine, &context, &user_intent).await?;

    let version = history_store.get_next_version(&res.pipeline.id);
    res.pipeline.version = version;

    let serialized = serde_json::to_string(&res.pipeline).unwrap_or_default();
    let fingerprint = crate::policy::crypto::sha256_hex(serialized.as_bytes());

    let record = crate::pipeline::history::PipelineVersionRecord {
        pipeline_id: res.pipeline.id.clone(),
        version,
        name: res.pipeline.name.clone(),
        description: res.pipeline.description.clone(),
        trigger: res.pipeline.trigger.clone(),
        definition: res.pipeline.clone(),
        created_at_ms: crate::pipeline::history::PipelineHistoryStore::now_ms(),
        source_type: "ai_generator".into(),
        prompt_reference: Some(user_intent.clone()),
        provider_id: Some("default".into()),
        model_name: None,
        fingerprint: format!("fp-{}", &fingerprint[..32]),
    };

    let _ = history_store.save_version(record);

    let event_type = if version == 1 { "PIPELINE_GENERATED" } else { "PIPELINE_UPDATED" };

    let _ = history_store.record_event(crate::pipeline::history::PipelineHistoryEvent {
        event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
        sequence_number: 0,
        pipeline_id: res.pipeline.id.clone(),
        pipeline_version: version,
        event_type: event_type.to_string(),
        actor: crate::pipeline::history::AuditActor::Ai,
        timestamp_ms: crate::pipeline::history::PipelineHistoryStore::now_ms(),
        stage_id: None,
        step_id: None,
        approval_id: None,
        execution_id: None,
        command_fingerprint: None,
        previous_state: None,
        new_state: Some("GENERATED".to_string()),
        reason_code: None,
        reason: None,
        policy_code: None,
        summary: format!("AI generated pipeline v{} from user intent", version),
        metadata: std::collections::HashMap::from([("userIntent".to_string(), user_intent.clone())]),
    });

    let _ = history_store.record_event(crate::pipeline::history::PipelineHistoryEvent {
        event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
        sequence_number: 0,
        pipeline_id: res.pipeline.id.clone(),
        pipeline_version: version,
        event_type: "POLICY_EVALUATED".to_string(),
        actor: crate::pipeline::history::AuditActor::PolicyEngine,
        timestamp_ms: crate::pipeline::history::PipelineHistoryStore::now_ms(),
        stage_id: None,
        step_id: None,
        approval_id: None,
        execution_id: None,
        command_fingerprint: None,
        previous_state: None,
        new_state: Some("EVALUATED".to_string()),
        reason_code: None,
        reason: None,
        policy_code: None,
        summary: format!("Policy evaluated for pipeline v{}: Allowed={}, ApprovalRequired={}", version, res.security_preview.is_allowed, res.security_preview.is_approval_required),
        metadata: std::collections::HashMap::new(),
    });

    for step in &res.security_preview.steps {
        if let crate::policy::models::PolicyDecision::RequireApproval { ref approval_id, ref prompt, ref action_fingerprint, .. } = step.decision {
            let _ = history_store.record_event(crate::pipeline::history::PipelineHistoryEvent {
                event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                sequence_number: 0,
                pipeline_id: res.pipeline.id.clone(),
                pipeline_version: version,
                event_type: "APPROVAL_REQUESTED".to_string(),
                actor: crate::pipeline::history::AuditActor::PolicyEngine,
                timestamp_ms: crate::pipeline::history::PipelineHistoryStore::now_ms(),
                stage_id: None,
                step_id: Some(step.step_id.clone()),
                approval_id: Some(approval_id.clone()),
                execution_id: None,
                command_fingerprint: Some(action_fingerprint.clone()),
                previous_state: Some("NONE".to_string()),
                new_state: Some("PENDING".to_string()),
                reason_code: Some("REQUIRE_APPROVAL".to_string()),
                reason: Some(prompt.clone()),
                policy_code: Some("REQUIRE_APPROVAL".to_string()),
                summary: format!("Step '{}' requires approval: {}", step.step_name, prompt),
                metadata: std::collections::HashMap::new(),
            });
        }
    }

    Ok(res)
}

pub fn clean_path_string(path: &std::path::Path) -> String {
    let s = path.to_string_lossy().to_string();
    if s.starts_with(r"\\?\") {
        s[4..].to_string()
    } else {
        s
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPipelineResult {
    pub content: String,
    pub target_file_path: String,
    pub target_directory: String,
}

#[tauri::command]
pub async fn export_pipeline_cmd(
    pipeline: PipelineDefinition,
    platform: String,
    project_root_path: Option<String>,
    approval_id: Option<String>,
    policy_engine: State<'_, Arc<crate::policy::PolicyEngine>>,
    history_store: State<'_, Arc<crate::pipeline::history::PipelineHistoryStore>>,
) -> Result<ExportPipelineResult, String> {
    let serialized = serde_json::to_string(&pipeline).unwrap_or_default();
    let fingerprint_payload = format!("{}:{}", platform, serialized);
    use crate::policy::crypto::sha256_hex;
    let fingerprint = sha256_hex(fingerprint_payload.as_bytes());

    let workspace_root = project_root_path
        .filter(|p| !p.trim().is_empty())
        .unwrap_or_else(|| ".".to_string());

    let execution_id = "preview-execution".to_string();
    let step_id = "export".to_string();
    let export_rel_path = format!("export/{}", platform);

    let export_res = if let Some(id) = approval_id {
        let store = policy_engine.approval_store().clone();
        if store.verify_and_consume(&id, &execution_id, &step_id, &fingerprint).is_ok() {
            let renderer = crate::pipeline::renderer::RendererFactory::get(&platform)?;
            let output = renderer.render(&pipeline)?;

            // Post-authorization directory creation and write
            let root_path = std::path::Path::new(&workspace_root);
            let abs_root = if root_path.is_relative() {
                std::env::current_dir().unwrap_or_default().join(root_path)
            } else {
                root_path.to_path_buf()
            };
            let target_dir = abs_root.join(&export_rel_path);
            let _ = std::fs::create_dir_all(&target_dir);

            let canonical_target_dir = std::fs::canonicalize(&target_dir).unwrap_or(target_dir);

            let target_filename = match platform.as_str() {
                "github" => "action.yml",
                "gitlab" => ".gitlab-ci.yml",
                _ => "pipeline.sh",
            };
            let target_file = canonical_target_dir.join(target_filename);
            let _ = std::fs::write(&target_file, &output);

            let clean_dir_str = clean_path_string(&canonical_target_dir);
            let clean_file_str = clean_path_string(&target_file);

            Ok(ExportPipelineResult {
                content: output,
                target_file_path: clean_file_str,
                target_directory: clean_dir_str,
            })
        } else {
            Err("Approval missing, expired, or invalid fingerprint.".into())
        }
    } else {
        let request = crate::policy::models::PolicyEvaluationRequest {
            execution_id: execution_id.clone(),
            pipeline_id: pipeline.id.clone(),
            pipeline_version: Some(pipeline.version),
            stage_id: "export".into(),
            step_id: step_id.clone(),
            step_type: "Export".into(),
            environment_id: None,
            platform: Some(platform.clone()),
            action_type: crate::policy::models::ActionType::ExportPipeline,
            command: None,
            args: vec![],
            cwd: None,
            path: Some(export_rel_path.clone()),
            url: None,
            workspace_root: workspace_root.clone(),
            policy_version: crate::policy::CURRENT_POLICY_VERSION.into(),
        };

        let result = policy_engine.evaluate(&request);
        
        match result.decision {
            crate::policy::models::PolicyDecision::Allow { .. } => {
                let renderer = crate::pipeline::renderer::RendererFactory::get(&platform)?;
                let output = renderer.render(&pipeline)?;

                // Post-authorization directory creation and write
                let root_path = std::path::Path::new(&workspace_root);
                let abs_root = if root_path.is_relative() {
                    std::env::current_dir().unwrap_or_default().join(root_path)
                } else {
                    root_path.to_path_buf()
                };
                let target_dir = abs_root.join(&export_rel_path);
                let _ = std::fs::create_dir_all(&target_dir);

                let canonical_target_dir = std::fs::canonicalize(&target_dir).unwrap_or(target_dir);

                let target_filename = match platform.as_str() {
                    "github" => "action.yml",
                    "gitlab" => ".gitlab-ci.yml",
                    _ => "pipeline.sh",
                };
                let target_file = canonical_target_dir.join(target_filename);
                
                // Record EXPORT_REQUESTED
                let _ = history_store.record_event(crate::pipeline::history::PipelineHistoryEvent {
                    event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                    sequence_number: 0,
                    pipeline_id: pipeline.id.clone(),
                    pipeline_version: pipeline.version,
                    event_type: "EXPORT_REQUESTED".to_string(),
                    actor: crate::pipeline::history::AuditActor::User,
                    timestamp_ms: crate::pipeline::history::PipelineHistoryStore::now_ms(),
                    stage_id: None,
                    step_id: None,
                    approval_id: None,
                    execution_id: None,
                    command_fingerprint: None,
                    previous_state: None,
                    new_state: Some("REQUESTED".to_string()),
                    reason_code: None,
                    reason: None,
                    policy_code: None,
                    summary: format!("Requested pipeline export to platform '{}'", platform),
                    metadata: std::collections::HashMap::from([("platform".to_string(), platform.clone())]),
                });

                // Record EXPORT_AUTHORIZED
                let _ = history_store.record_event(crate::pipeline::history::PipelineHistoryEvent {
                    event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                    sequence_number: 0,
                    pipeline_id: pipeline.id.clone(),
                    pipeline_version: pipeline.version,
                    event_type: "EXPORT_AUTHORIZED".to_string(),
                    actor: crate::pipeline::history::AuditActor::PolicyEngine,
                    timestamp_ms: crate::pipeline::history::PipelineHistoryStore::now_ms(),
                    stage_id: None,
                    step_id: None,
                    approval_id: None,
                    execution_id: None,
                    command_fingerprint: None,
                    previous_state: Some("REQUESTED".to_string()),
                    new_state: Some("AUTHORIZED".to_string()),
                    reason_code: Some("POLICY_ALLOW".to_string()),
                    reason: None,
                    policy_code: Some("ALLOW".to_string()),
                    summary: format!("Export authorized for platform '{}'", platform),
                    metadata: std::collections::HashMap::from([("platform".to_string(), platform.clone())]),
                });

                let write_res = std::fs::write(&target_file, &output);
                let clean_dir_str = clean_path_string(&canonical_target_dir);
                let clean_file_str = clean_path_string(&target_file);

                if write_res.is_ok() {
                    // PIPELINE_EXPORTED recorded ONLY after filesystem write succeeds
                    let _ = history_store.record_event(crate::pipeline::history::PipelineHistoryEvent {
                        event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                        sequence_number: 0,
                        pipeline_id: pipeline.id.clone(),
                        pipeline_version: pipeline.version,
                        event_type: "PIPELINE_EXPORTED".to_string(),
                        actor: crate::pipeline::history::AuditActor::User,
                        timestamp_ms: crate::pipeline::history::PipelineHistoryStore::now_ms(),
                        stage_id: None,
                        step_id: None,
                        approval_id: None,
                        execution_id: None,
                        command_fingerprint: None,
                        previous_state: Some("AUTHORIZED".to_string()),
                        new_state: Some("EXPORTED".to_string()),
                        reason_code: None,
                        reason: None,
                        policy_code: None,
                        summary: format!("Exported pipeline to platform '{}'", platform),
                        metadata: std::collections::HashMap::from([
                            ("platform".to_string(), platform.clone()),
                            ("target_relative_path".to_string(), export_rel_path.clone()),
                        ]),
                    });

                    Ok(ExportPipelineResult {
                        content: output,
                        target_file_path: clean_file_str,
                        target_directory: clean_dir_str,
                    })
                } else {
                    let err_msg = write_res.unwrap_err().to_string();
                    let _ = history_store.record_event(crate::pipeline::history::PipelineHistoryEvent {
                        event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                        sequence_number: 0,
                        pipeline_id: pipeline.id.clone(),
                        pipeline_version: pipeline.version,
                        event_type: "EXPORT_FAILED".to_string(),
                        actor: crate::pipeline::history::AuditActor::User,
                        timestamp_ms: crate::pipeline::history::PipelineHistoryStore::now_ms(),
                        stage_id: None,
                        step_id: None,
                        approval_id: None,
                        execution_id: None,
                        command_fingerprint: None,
                        previous_state: Some("AUTHORIZED".to_string()),
                        new_state: Some("FAILED".to_string()),
                        reason_code: Some("WRITE_FAILED".to_string()),
                        reason: Some(err_msg.clone()),
                        policy_code: None,
                        summary: format!("Failed writing export file to disk: {}", err_msg),
                        metadata: std::collections::HashMap::from([("platform".to_string(), platform.clone())]),
                    });

                    Err(format!("Failed to write export file: {}", err_msg))
                }
            },
            crate::policy::models::PolicyDecision::RequireApproval { approval_id, prompt, risk_level, reason_code, .. } => {
                let risk_level_str = format!("{:?}", risk_level);
                let ttl_ms = crate::policy::approval::ApprovalStore::get_ttl_for_risk_level(&risk_level_str);
                policy_engine.approval_store().register_approval_detailed(
                    approval_id.clone(),
                    execution_id,
                    Some(pipeline.id.clone()),
                    None,
                    step_id,
                    Some("Export Pipeline".to_string()),
                    "ExportPipeline".to_string(),
                    None,
                    vec![],
                    risk_level_str,
                    reason_code,
                    prompt.clone(),
                    fingerprint,
                    ttl_ms,
                );

                let _ = history_store.record_event(crate::pipeline::history::PipelineHistoryEvent {
                    event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                    sequence_number: 0,
                    pipeline_id: pipeline.id.clone(),
                    pipeline_version: pipeline.version,
                    event_type: "EXPORT_REQUESTED".to_string(),
                    actor: crate::pipeline::history::AuditActor::User,
                    timestamp_ms: crate::pipeline::history::PipelineHistoryStore::now_ms(),
                    stage_id: None,
                    step_id: None,
                    approval_id: Some(approval_id.clone()),
                    execution_id: None,
                    command_fingerprint: None,
                    previous_state: None,
                    new_state: Some("REQUESTED".to_string()),
                    reason_code: None,
                    reason: None,
                    policy_code: None,
                    summary: format!("Export requested for platform '{}' (requires approval)", platform),
                    metadata: std::collections::HashMap::from([("platform".to_string(), platform.clone())]),
                });

                Err(format!("APPROVAL_REQUIRED:{}::{}", approval_id, prompt))
            },
            crate::policy::models::PolicyDecision::Deny { message, .. } => {
                let _ = history_store.record_event(crate::pipeline::history::PipelineHistoryEvent {
                    event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                    sequence_number: 0,
                    pipeline_id: pipeline.id.clone(),
                    pipeline_version: pipeline.version,
                    event_type: "EXPORT_FAILED".to_string(),
                    actor: crate::pipeline::history::AuditActor::PolicyEngine,
                    timestamp_ms: crate::pipeline::history::PipelineHistoryStore::now_ms(),
                    stage_id: None,
                    step_id: None,
                    approval_id: None,
                    execution_id: None,
                    command_fingerprint: None,
                    previous_state: None,
                    new_state: Some("DENIED".to_string()),
                    reason_code: Some("POLICY_DENIED".to_string()),
                    reason: Some(message.clone()),
                    policy_code: Some("DENY".to_string()),
                    summary: format!("Policy Engine denied pipeline export: {}", message),
                    metadata: std::collections::HashMap::from([("platform".to_string(), platform.clone())]),
                });

                Err(format!("Policy Engine Denied: {}", message))
            }
        }
    };

    export_res
}

#[tauri::command]
pub async fn list_pending_approvals(
    policy_engine: State<'_, Arc<crate::policy::PolicyEngine>>,
) -> Result<Vec<crate::policy::PendingApproval>, String> {
    Ok(policy_engine.approval_store().list_pending())
}

#[tauri::command]
pub async fn get_approval(
    approval_id: String,
    policy_engine: State<'_, Arc<crate::policy::PolicyEngine>>,
) -> Result<crate::policy::PendingApproval, String> {
    policy_engine
        .approval_store()
        .get_approval(&approval_id)
        .ok_or_else(|| format!("Approval ID '{}' not found", approval_id))
}

#[tauri::command]
pub async fn approve_approval(
    approval_id: String,
    policy_engine: State<'_, Arc<crate::policy::PolicyEngine>>,
    history_store: State<'_, Arc<crate::pipeline::history::PipelineHistoryStore>>,
) -> Result<(), String> {
    let app_opt = policy_engine.approval_store().get_approval(&approval_id);
    let res = policy_engine
        .approval_store()
        .submit_approval(&approval_id, true);

    if res.is_ok() {
        if let Some(app) = app_opt {
            let pid = app.pipeline_id.unwrap_or_else(|| "unknown".into());
            let _ = history_store.record_event(crate::pipeline::history::PipelineHistoryEvent {
                event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                sequence_number: 0,
                pipeline_id: pid,
                pipeline_version: 1,
                event_type: "APPROVAL_APPROVED".to_string(),
                actor: crate::pipeline::history::AuditActor::User,
                timestamp_ms: crate::pipeline::history::PipelineHistoryStore::now_ms(),
                stage_id: None,
                step_id: Some(app.step_id),
                approval_id: Some(approval_id),
                execution_id: Some(app.execution_id),
                command_fingerprint: Some(app.action_fingerprint),
                previous_state: Some("PENDING".to_string()),
                new_state: Some("APPROVED".to_string()),
                reason_code: Some("USER_APPROVAL".to_string()),
                reason: Some("Human operator approved request".to_string()),
                policy_code: Some(app.reason_code),
                summary: "Human operator authorized execution step".to_string(),
                metadata: std::collections::HashMap::new(),
            });
        }
    }
    res
}

#[tauri::command]
pub async fn reject_approval(
    approval_id: String,
    policy_engine: State<'_, Arc<crate::policy::PolicyEngine>>,
    history_store: State<'_, Arc<crate::pipeline::history::PipelineHistoryStore>>,
) -> Result<(), String> {
    let app_opt = policy_engine.approval_store().get_approval(&approval_id);
    let res = policy_engine
        .approval_store()
        .submit_approval(&approval_id, false);

    if res.is_ok() {
        if let Some(app) = app_opt {
            let pid = app.pipeline_id.unwrap_or_else(|| "unknown".into());
            let _ = history_store.record_event(crate::pipeline::history::PipelineHistoryEvent {
                event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                sequence_number: 0,
                pipeline_id: pid,
                pipeline_version: 1,
                event_type: "APPROVAL_REJECTED".to_string(),
                actor: crate::pipeline::history::AuditActor::User,
                timestamp_ms: crate::pipeline::history::PipelineHistoryStore::now_ms(),
                stage_id: None,
                step_id: Some(app.step_id),
                approval_id: Some(approval_id),
                execution_id: Some(app.execution_id),
                command_fingerprint: Some(app.action_fingerprint),
                previous_state: Some("PENDING".to_string()),
                new_state: Some("REJECTED".to_string()),
                reason_code: Some("USER_REJECTION".to_string()),
                reason: Some("Human operator rejected request".to_string()),
                policy_code: Some(app.reason_code),
                summary: "Human operator rejected execution step".to_string(),
                metadata: std::collections::HashMap::new(),
            });
        }
    }
    res
}

#[tauri::command]
pub async fn request_new_approval(
    old_approval_id: String,
    pipeline: PipelineDefinition,
    step_id: String,
    platform: Option<String>,
    policy_engine: State<'_, Arc<crate::policy::PolicyEngine>>,
    history_store: State<'_, Arc<crate::pipeline::history::PipelineHistoryStore>>,
) -> Result<crate::policy::PendingApproval, String> {
    let old_app = policy_engine
        .approval_store()
        .get_approval(&old_approval_id)
        .ok_or_else(|| format!("Old approval ID '{}' not found", old_approval_id))?;

    let mut target_step = None;
    let mut target_stage = None;
    for stage in &pipeline.stages {
        for step in &stage.steps {
            if step.id == step_id {
                target_step = Some(step.clone());
                target_stage = Some(stage.clone());
                break;
            }
        }
    }
    
    let step = target_step.ok_or_else(|| format!("Step ID '{}' not found in pipeline", step_id))?;
    let stage = target_stage.unwrap();

    let (cmd, cmd_args, path, url, action_type) = match &step.config {
        crate::pipeline::domain::StepConfig::Command { command, args, cwd } => {
            (Some(command.clone()), args.clone(), cwd.clone(), None, crate::policy::ActionType::Command)
        }
        crate::pipeline::domain::StepConfig::Artifact { path, .. } => {
            (None, vec![], Some(path.clone()), None, crate::policy::ActionType::FileRead)
        }
        crate::pipeline::domain::StepConfig::Http { url, .. } => {
            (None, vec![], None, Some(url.clone()), crate::policy::ActionType::Network)
        }
        _ => (None, vec![], None, None, crate::policy::ActionType::Unknown),
    };

    let request = crate::policy::models::PolicyEvaluationRequest {
        execution_id: old_app.execution_id.clone(),
        pipeline_id: pipeline.id.clone(),
        pipeline_version: Some(pipeline.version),
        stage_id: stage.id.clone(),
        step_id: step.id.clone(),
        step_type: format!("{:?}", step.step_type),
        environment_id: None,
        platform: platform.clone(),
        action_type,
        command: cmd,
        args: cmd_args,
        cwd: None,
        path,
        url,
        workspace_root: "".to_string(),
        policy_version: policy_engine.policy_version().to_string(),
    };

    let eval_res = policy_engine.evaluate(&request);

    match eval_res.decision {
        crate::policy::models::PolicyDecision::Allow { .. } => {
            Err("Policy evaluation allowed: no approval is required".to_string())
        }
        crate::policy::models::PolicyDecision::RequireApproval { 
            approval_id: new_approval_id, 
            risk_level, 
            reason_code, 
            prompt, 
            action_fingerprint, 
            .. 
        } => {
            let risk_level_str = format!("{:?}", risk_level);
            let cmd_val = request.command.clone();
            let args_val = request.args.clone();
            let act_type_str = format!("{:?}", request.action_type);
            
            // Logical invalidation of the old approval request
            policy_engine.approval_store().revoke_approval(&old_approval_id);

            let _ = history_store.record_event(crate::pipeline::history::PipelineHistoryEvent {
                event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                sequence_number: 0,
                pipeline_id: pipeline.id.clone(),
                pipeline_version: pipeline.version,
                event_type: "APPROVAL_REVOKED".to_string(),
                actor: crate::pipeline::history::AuditActor::User,
                timestamp_ms: crate::pipeline::history::PipelineHistoryStore::now_ms(),
                stage_id: Some(stage.id.clone()),
                step_id: Some(step.id.clone()),
                approval_id: Some(old_approval_id.clone()),
                execution_id: Some(old_app.execution_id.clone()),
                command_fingerprint: Some(old_app.action_fingerprint),
                previous_state: Some("PENDING".to_string()),
                new_state: Some("REVOKED".to_string()),
                reason_code: Some("RENEWAL".to_string()),
                reason: Some("Expired/invalid approval revoked for new approval request".to_string()),
                policy_code: Some("REQUIRE_APPROVAL".to_string()),
                summary: "Expired/invalid approval revoked for new approval request".to_string(),
                metadata: std::collections::HashMap::new(),
            });

            let ttl_ms = crate::policy::approval::ApprovalStore::get_ttl_for_risk_level(&risk_level_str);

            let new_app = policy_engine.approval_store().register_approval_detailed(
                new_approval_id.clone(),
                request.execution_id.clone(),
                Some(pipeline.id.clone()),
                    None,
                step.id.clone(),
                Some(step.name.clone()),
                act_type_str,
                cmd_val,
                args_val,
                risk_level_str,
                reason_code.clone(),
                prompt.clone(),
                action_fingerprint.clone(),
                ttl_ms,
            );

            let _ = history_store.record_event(crate::pipeline::history::PipelineHistoryEvent {
                event_id: crate::pipeline::history::PipelineHistoryStore::generate_event_id(),
                sequence_number: 0,
                pipeline_id: pipeline.id.clone(),
                pipeline_version: pipeline.version,
                event_type: "APPROVAL_REQUESTED".to_string(),
                actor: crate::pipeline::history::AuditActor::User,
                timestamp_ms: crate::pipeline::history::PipelineHistoryStore::now_ms(),
                stage_id: Some(stage.id.clone()),
                step_id: Some(step.id.clone()),
                approval_id: Some(new_approval_id),
                execution_id: Some(old_app.execution_id),
                command_fingerprint: Some(action_fingerprint),
                previous_state: Some("NONE".to_string()),
                new_state: Some("PENDING".to_string()),
                reason_code: Some("RENEWED_REQUEST".to_string()),
                reason: Some(prompt.clone()),
                policy_code: Some("REQUIRE_APPROVAL".to_string()),
                summary: format!("New approval token requested: {}", prompt),
                metadata: std::collections::HashMap::new(),
            });

            Ok(new_app)
        }
        crate::policy::models::PolicyDecision::Deny { message, .. } => {
            Err(format!("Policy evaluation denied: {}", message))
        }
    }
}

