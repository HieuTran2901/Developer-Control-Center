use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::pipeline::domain::StepConfig;
use crate::policy::crypto::sha256_hex;
use super::models::{
    redact_metadata, redact_sensitive_data, PipelineHistoryEvent, PipelineHistorySummary,
    PipelineVersionRecord, SecuritySummary, StepDiff, VersionDiff,
};

pub struct PipelineHistoryStore {
    versions_path: PathBuf,
    events_path: PathBuf,
    versions: RwLock<Vec<PipelineVersionRecord>>,
    events: RwLock<Vec<PipelineHistoryEvent>>,
    sequence_counter: AtomicU64,
}

impl PipelineHistoryStore {
    pub fn new(app_data_dir: &Path) -> Result<Self, String> {
        let dcc_dir = app_data_dir.join(".dcc");
        if !dcc_dir.exists() {
            fs::create_dir_all(&dcc_dir).map_err(|e| e.to_string())?;
        }

        let versions_path = dcc_dir.join("pipeline_versions.json");
        let events_path = dcc_dir.join("pipeline_history.json");

        let versions = if versions_path.exists() {
            let data = fs::read_to_string(&versions_path).map_err(|e| e.to_string())?;
            serde_json::from_str(&data).unwrap_or_else(|_| vec![])
        } else {
            vec![]
        };

        let events: Vec<PipelineHistoryEvent> = if events_path.exists() {
            let data = fs::read_to_string(&events_path).map_err(|e| e.to_string())?;
            serde_json::from_str(&data).unwrap_or_else(|_| vec![])
        } else {
            vec![]
        };

        let max_seq = events.iter().map(|e| e.sequence_number).max().unwrap_or(0);

        Ok(Self {
            versions_path,
            events_path,
            versions: RwLock::new(versions),
            events: RwLock::new(events),
            sequence_counter: AtomicU64::new(max_seq + 1),
        })
    }

    pub fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    pub fn generate_event_id() -> String {
        let now = Self::now_ms();
        let thread_id = format!("{:?}", std::thread::current().id());
        let raw = format!("evt:{}:{:p}:{}", now, &now, thread_id);
        format!("evt-{}", &sha256_hex(raw.as_bytes())[..16])
    }

    pub fn get_next_version(&self, pipeline_id: &str) -> u32 {
        let versions = self.versions.read().unwrap();
        versions
            .iter()
            .filter(|v| v.pipeline_id == pipeline_id)
            .map(|v| v.version)
            .max()
            .unwrap_or(0)
            + 1
    }

    pub fn save_version(&self, mut record: PipelineVersionRecord) -> Result<(), String> {
        let mut versions = self.versions.write().map_err(|_| "Lock error")?;

        if let Some(ref prompt) = record.prompt_reference {
            record.prompt_reference = Some(redact_sensitive_data(prompt));
        }

        // Prevent overwriting existing versions for audit immutability
        if versions.iter().any(|v| v.pipeline_id == record.pipeline_id && v.version == record.version) {
            return Err(format!(
                "Version v{} for pipeline '{}' already exists and is immutable",
                record.version, record.pipeline_id
            ));
        }

        versions.push(record);

        let json = serde_json::to_string_pretty(&*versions).map_err(|e| e.to_string())?;
        fs::write(&self.versions_path, json).map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn get_versions(&self, pipeline_id: &str) -> Vec<PipelineVersionRecord> {
        let versions = self.versions.read().unwrap();
        let mut filtered: Vec<_> = versions
            .iter()
            .filter(|v| v.pipeline_id == pipeline_id)
            .cloned()
            .collect();
        filtered.sort_by_key(|v| v.version);
        filtered
    }

    pub fn get_version(&self, pipeline_id: &str, version: u32) -> Option<PipelineVersionRecord> {
        let versions = self.versions.read().unwrap();
        versions
            .iter()
            .find(|v| v.pipeline_id == pipeline_id && v.version == version)
            .cloned()
    }

    pub fn record_event(&self, mut event: PipelineHistoryEvent) -> Result<(), String> {
        let mut events = self.events.write().map_err(|_| "Lock error")?;

        if event.sequence_number == 0 {
            event.sequence_number = self.sequence_counter.fetch_add(1, Ordering::SeqCst);
        }

        event.summary = redact_sensitive_data(&event.summary);
        if let Some(ref r) = event.reason {
            event.reason = Some(redact_sensitive_data(r));
        }
        redact_metadata(&mut event.metadata);

        events.push(event);

        // Sort events deterministically by timestamp, sequence number, and event ID
        events.sort_by(|a, b| {
            a.timestamp_ms
                .cmp(&b.timestamp_ms)
                .then(a.sequence_number.cmp(&b.sequence_number))
                .then(a.event_id.cmp(&b.event_id))
        });

        // Bound event history to 2000 events to manage disk size
        let len = events.len();
        if len > 2000 {
            events.drain(0..(len - 2000));
        }

        let json = serde_json::to_string_pretty(&*events).map_err(|e| e.to_string())?;
        fs::write(&self.events_path, json).map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn get_events(&self, pipeline_id: &str) -> Vec<PipelineHistoryEvent> {
        let events = self.events.read().unwrap();
        events
            .iter()
            .filter(|e| e.pipeline_id == pipeline_id)
            .cloned()
            .collect()
    }

    pub fn get_all_summaries(&self) -> Vec<PipelineHistorySummary> {
        let versions = self.versions.read().unwrap();
        let events = self.events.read().unwrap();

        let mut pipeline_ids: HashSet<String> = HashSet::new();
        for v in versions.iter() {
            pipeline_ids.insert(v.pipeline_id.clone());
        }
        for e in events.iter() {
            pipeline_ids.insert(e.pipeline_id.clone());
        }

        let mut summaries = Vec::new();

        for pid in pipeline_ids {
            let p_versions: Vec<_> = versions.iter().filter(|v| v.pipeline_id == pid).collect();
            let p_events: Vec<_> = events.iter().filter(|e| e.pipeline_id == pid).collect();

            let latest_version_rec = p_versions.iter().max_by_key(|v| v.version);
            let latest_version = latest_version_rec.map(|v| v.version).unwrap_or(1);
            let pipeline_name = latest_version_rec
                .map(|v| v.name.clone())
                .unwrap_or_else(|| pid.clone());

            let created_at_ms = p_versions
                .iter()
                .map(|v| v.created_at_ms)
                .min()
                .or_else(|| p_events.iter().map(|e| e.timestamp_ms).min())
                .unwrap_or_else(Self::now_ms);

            let updated_at_ms = p_events
                .iter()
                .map(|e| e.timestamp_ms)
                .max()
                .or_else(|| p_versions.iter().map(|v| v.created_at_ms).max())
                .unwrap_or(created_at_ms);

            let latest_status = p_events
                .iter()
                .last()
                .map(|e| e.event_type.clone())
                .unwrap_or_else(|| "PIPELINE_GENERATED".to_string());

            // Hierarchical Security Summary Projection
            // Reduce chronological events for the latest pipeline version
            let mut step_active_state: HashMap<String, String> = HashMap::new();

            for e in p_events.iter().filter(|e| e.pipeline_version == latest_version) {
                if let Some(ref sid) = e.step_id {
                    match e.event_type.as_str() {
                        "APPROVAL_REQUESTED" => {
                            step_active_state.insert(sid.clone(), "REQUESTED".to_string());
                        }
                        "APPROVAL_APPROVED" => {
                            step_active_state.insert(sid.clone(), "APPROVED".to_string());
                        }
                        "APPROVAL_REJECTED" => {
                            step_active_state.insert(sid.clone(), "REJECTED".to_string());
                        }
                        "APPROVAL_EXPIRED" => {
                            step_active_state.insert(sid.clone(), "EXPIRED".to_string());
                        }
                        "APPROVAL_REVOKED" => {
                            step_active_state.insert(sid.clone(), "REVOKED".to_string());
                        }
                        "APPROVAL_CONSUMED" => {
                            step_active_state.insert(sid.clone(), "CONSUMED".to_string());
                        }
                        "POLICY_DENIED" => {
                            step_active_state.insert(sid.clone(), "DENIED".to_string());
                        }
                        _ => {}
                    }
                }
            }

            let mut sec_summary = SecuritySummary::default();
            if let Some(rec) = latest_version_rec {
                for stage in &rec.definition.stages {
                    for step in &stage.steps {
                        if let Some(state) = step_active_state.get(&step.id) {
                            match state.as_str() {
                                "APPROVED" | "CONSUMED" => sec_summary.approved_count += 1,
                                "REJECTED" => sec_summary.rejected_count += 1,
                                "DENIED" => sec_summary.denied_count += 1,
                                "REQUESTED" | "EXPIRED" | "REVOKED" => sec_summary.approval_required_count += 1,
                                _ => sec_summary.allowed_count += 1,
                            }
                        } else {
                            match &step.config {
                                StepConfig::Approval { .. } => {
                                    sec_summary.approval_required_count += 1;
                                }
                                _ => {
                                    sec_summary.allowed_count += 1;
                                }
                            }
                        }
                    }
                }
            }

            summaries.push(PipelineHistorySummary {
                pipeline_id: pid,
                pipeline_name,
                latest_version,
                latest_status,
                created_at_ms,
                updated_at_ms,
                provider_id: latest_version_rec.and_then(|v| v.provider_id.clone()),
                model_name: latest_version_rec.and_then(|v| v.model_name.clone()),
                security_summary: sec_summary,
                total_events: p_events.len(),
            });
        }

        summaries.sort_by(|a, b| {
            b.updated_at_ms
                .cmp(&a.updated_at_ms)
                .then_with(|| a.pipeline_id.cmp(&b.pipeline_id))
        });
        summaries
    }

    pub fn compare_versions(&self, pipeline_id: &str, v1_num: u32, v2_num: u32) -> Result<VersionDiff, String> {
        let v1_rec = self
            .get_version(pipeline_id, v1_num)
            .ok_or_else(|| format!("Version v{} not found for pipeline {}", v1_num, pipeline_id))?;
        let v2_rec = self
            .get_version(pipeline_id, v2_num)
            .ok_or_else(|| format!("Version v{} not found for pipeline {}", v2_num, pipeline_id))?;

        let stages1: HashSet<String> = v1_rec.definition.stages.iter().map(|s| s.name.clone()).collect();
        let stages2: HashSet<String> = v2_rec.definition.stages.iter().map(|s| s.name.clone()).collect();

        let added_stages: Vec<String> = stages2.difference(&stages1).cloned().collect();
        let removed_stages: Vec<String> = stages1.difference(&stages2).cloned().collect();

        let mut step_map1: HashMap<String, (&String, &StepConfig)> = HashMap::new();
        for stage in &v1_rec.definition.stages {
            for step in &stage.steps {
                step_map1.insert(step.id.clone(), (&step.name, &step.config));
            }
        }

        let mut step_map2: HashMap<String, (&String, &StepConfig)> = HashMap::new();
        for stage in &v2_rec.definition.stages {
            for step in &stage.steps {
                step_map2.insert(step.id.clone(), (&step.name, &step.config));
            }
        }

        let all_step_ids: HashSet<String> = step_map1.keys().chain(step_map2.keys()).cloned().collect();

        let mut step_diffs = Vec::new();
        let mut has_security_changes = false;

        for step_id in all_step_ids {
            let s1 = step_map1.get(&step_id);
            let s2 = step_map2.get(&step_id);

            match (s1, s2) {
                (None, Some((name2, config2))) => {
                    let (cmd2, args2) = extract_cmd_and_args(config2);
                    step_diffs.push(StepDiff {
                        step_id: step_id.clone(),
                        step_name: (*name2).clone(),
                        diff_type: "added".into(),
                        old_command: None,
                        new_command: cmd2,
                        old_args: vec![],
                        new_args: args2,
                        security_changed: true,
                    });
                    has_security_changes = true;
                }
                (Some((name1, config1)), None) => {
                    let (cmd1, args1) = extract_cmd_and_args(config1);
                    step_diffs.push(StepDiff {
                        step_id: step_id.clone(),
                        step_name: (*name1).clone(),
                        diff_type: "removed".into(),
                        old_command: cmd1,
                        new_command: None,
                        old_args: args1,
                        new_args: vec![],
                        security_changed: true,
                    });
                    has_security_changes = true;
                }
                (Some((name1, config1)), Some((_name2, config2))) => {
                    let (cmd1, args1) = extract_cmd_and_args(config1);
                    let (cmd2, args2) = extract_cmd_and_args(config2);

                    let changed = cmd1 != cmd2 || args1 != args2;
                    let sec_changed = changed && (is_high_risk_cmd(&cmd2, &args2) || is_high_risk_cmd(&cmd1, &args1));

                    if sec_changed {
                        has_security_changes = true;
                    }

                    step_diffs.push(StepDiff {
                        step_id: step_id.clone(),
                        step_name: (*name1).clone(),
                        diff_type: if changed { "modified".into() } else { "unchanged".into() },
                        old_command: cmd1,
                        new_command: cmd2,
                        old_args: args1,
                        new_args: args2,
                        security_changed: sec_changed,
                    });
                }
                (None, None) => {}
            }
        }

        step_diffs.sort_by(|a, b| a.step_id.cmp(&b.step_id));

        Ok(VersionDiff {
            pipeline_id: pipeline_id.to_string(),
            v1: v1_num,
            v2: v2_num,
            added_stages,
            removed_stages,
            step_diffs,
            has_security_changes,
        })
    }
}

fn extract_cmd_and_args(config: &StepConfig) -> (Option<String>, Vec<String>) {
    match config {
        StepConfig::Command { command, args, .. } => (Some(command.clone()), args.clone()),
        StepConfig::Http { url, .. } => (Some("HTTP".to_string()), vec![url.clone()]),
        StepConfig::Artifact { path, .. } => (Some("ARTIFACT".to_string()), vec![path.clone()]),
        StepConfig::Approval { approvers, .. } => (Some("APPROVAL".to_string()), approvers.clone()),
        _ => (None, vec![]),
    }
}

fn is_high_risk_cmd(cmd: &Option<String>, args: &[String]) -> bool {
    let cmd_str = cmd.as_deref().unwrap_or("").to_lowercase();
    let args_str = args.join(" ").to_lowercase();

    cmd_str.contains("curl")
        || cmd_str.contains("wget")
        || cmd_str.contains("bash")
        || cmd_str.contains("powershell")
        || cmd_str.contains("sudo")
        || args_str.contains("| bash")
        || args_str.contains("| powershell")
}
