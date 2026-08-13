use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use crate::policy::crypto::sha256_hex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingApproval {
    pub approval_id: String,
    pub execution_id: String,
    pub pipeline_id: Option<String>,
    pub pipeline_version: Option<u32>,
    pub step_id: String,
    pub step_name: Option<String>,
    pub action_type: String,
    pub command: Option<String>,
    pub args: Vec<String>,
    pub risk_level: String,
    pub reason_code: String,
    pub prompt: String,
    pub action_fingerprint: String,
    pub requested_at_ms: u64,
    pub expires_at_ms: u64,
    pub approved_at_ms: Option<u64>,
    pub rejected_at_ms: Option<u64>,
    pub approved_by: Option<String>,
    pub rejected_by: Option<String>,
    pub consumed: bool,
    pub approved: Option<bool>,
    pub status: String,
}

impl PendingApproval {
    pub fn update_status(&mut self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        if self.consumed {
            self.status = "CONSUMED".to_string();
        } else if self.status == "REVOKED" {
            // remain revoked
        } else if let Some(app) = self.approved {
            if app {
                if now >= self.expires_at_ms {
                    self.status = "EXPIRED".to_string();
                } else {
                    self.status = "APPROVED".to_string();
                }
            } else {
                self.status = "REJECTED".to_string();
            }
        } else if now >= self.expires_at_ms {
            self.status = "EXPIRED".to_string();
        } else {
            self.status = "PENDING".to_string();
        }
    }
}

#[derive(Clone)]
pub struct ApprovalStore {
    pub pending: Arc<Mutex<HashMap<String, PendingApproval>>>,
    notify: Arc<tokio::sync::Notify>,
}

impl ApprovalStore {
    pub fn new() -> Self {
        Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
            notify: Arc::new(tokio::sync::Notify::new()),
        }
    }

    pub fn notify(&self) -> Arc<tokio::sync::Notify> {
        self.notify.clone()
    }

    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    pub fn generate_unpredictable_approval_id() -> String {
        let now_nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
            
        let thread_id = format!("{:?}", std::thread::current().id());
        let raw_entropy = format!("{}:{}:{:p}", now_nanos, thread_id, &now_nanos);
        let hash = sha256_hex(raw_entropy.as_bytes());
        format!("app-{}", &hash[..32])
    }

    pub fn compute_canonical_fingerprint(
        action_type: &str,
        command: Option<&str>,
        args: &[String],
        workspace_root: &str,
        policy_version: &str,
        pipeline_version: Option<u32>,
    ) -> String {
        let mut canonical = String::new();
        canonical.push_str(&format!("ACT:{}\n", action_type));
        canonical.push_str(&format!("CMD:{}\n", command.unwrap_or("")));
        canonical.push_str(&format!("ARGC:{}\n", args.len()));
        for (i, arg) in args.iter().enumerate() {
            canonical.push_str(&format!("ARG[{}]:L{}:{}\n", i, arg.len(), arg));
        }
        canonical.push_str(&format!("ROOT:{}\n", workspace_root));
        canonical.push_str(&format!("VER:{}\n", policy_version));
        canonical.push_str(&format!("PIPE_VER:{:?}\n", pipeline_version));

        let hash = sha256_hex(canonical.as_bytes());
        format!("fp-{}", &hash[..32])
    }

    pub fn get_ttl_for_risk_level(risk_level: &str) -> u64 {
        match risk_level.to_lowercase().as_str() {
            "critical" => 5 * 60 * 1000,         // 5 minutes
            "high" => 10 * 60 * 1000,            // 10 minutes
            "medium" | "low" => 15 * 60 * 1000,   // 15 minutes
            _ => 10 * 60 * 1000,                 // Default: 10 minutes
        }
    }

    pub fn cleanup_expired_records(&self) {
        let now = Self::now_ms();
        let mut map = self.pending.lock().unwrap();
        // Remove records that are EXPIRED/CONSUMED/REVOKED/REJECTED and have been inactive/expired for more than 1 hour (3,600,000 ms)
        map.retain(|_, v| {
            v.update_status();
            if v.status == "EXPIRED" || v.status == "CONSUMED" || v.status == "REVOKED" || v.status == "REJECTED" {
                now < v.expires_at_ms + 3_600_000
            } else {
                true
            }
        });
    }

    pub fn register_approval_detailed(
        &self,
        approval_id: String,
        execution_id: String,
        pipeline_id: Option<String>,
        pipeline_version: Option<u32>,
        step_id: String,
        step_name: Option<String>,
        action_type: String,
        command: Option<String>,
        args: Vec<String>,
        risk_level: String,
        reason_code: String,
        prompt: String,
        action_fingerprint: String,
        ttl_ms: u64,
    ) -> PendingApproval {
        self.cleanup_expired_records();
        let now = Self::now_ms();
        let expires_at_ms = now + ttl_ms;
        let mut approval = PendingApproval {
            approval_id: approval_id.clone(),
            execution_id,
            pipeline_id,
            pipeline_version,
            step_id,
            step_name,
            action_type,
            command,
            args,
            risk_level,
            reason_code,
            prompt,
            action_fingerprint,
            requested_at_ms: now,
            expires_at_ms,
            approved_at_ms: None,
            rejected_at_ms: None,
            approved_by: None,
            rejected_by: None,
            consumed: false,
            approved: None,
            status: "PENDING".to_string(),
        };
        approval.update_status();

        self.pending.lock().unwrap().insert(approval_id, approval.clone());
        self.notify.notify_waiters();
        approval
    }

    pub fn register_approval(
        &self,
        approval_id: String,
        execution_id: String,
        step_id: String,
        action_fingerprint: String,
        ttl_ms: u64,
    ) -> PendingApproval {
        self.register_approval_detailed(
            approval_id,
            execution_id,
            None,
            None,
            step_id,
            None,
            "Unknown".to_string(),
            None,
            vec![],
            "High".to_string(),
            "POLICY_UNKNOWN".to_string(),
            "Approval required".to_string(),
            action_fingerprint,
            ttl_ms,
        )
    }

    pub fn revoke_approval(&self, approval_id: &str) {
        let mut map = self.pending.lock().unwrap();
        if let Some(entry) = map.get_mut(approval_id) {
            entry.update_status();
            if entry.status == "PENDING" || entry.status == "APPROVED" || entry.status == "EXPIRED" {
                entry.status = "REVOKED".to_string();
            }
        }
    }

    pub fn submit_approval(&self, approval_id: &str, approved: bool) -> Result<(), String> {
        let mut map = self.pending.lock().unwrap();
        let entry = map.get_mut(approval_id).ok_or_else(|| format!("Approval ID '{}' not found", approval_id))?;

        entry.update_status();

        if entry.status != "PENDING" {
            return Err(format!("Invalid state transition: cannot submit approval in status '{}'", entry.status));
        }

        let now = Self::now_ms();
        if now >= entry.expires_at_ms {
            entry.status = "EXPIRED".to_string();
            return Err("Approval token has expired".to_string());
        }

        entry.approved = Some(approved);
        if approved {
            entry.status = "APPROVED".to_string();
            entry.approved_at_ms = Some(now);
            entry.approved_by = Some("Operator".to_string());
        } else {
            entry.status = "REJECTED".to_string();
            entry.rejected_at_ms = Some(now);
            entry.rejected_by = Some("Operator".to_string());
        }
        self.notify.notify_waiters();
        Ok(())
    }

    pub fn verify_and_consume(
        &self,
        approval_id: &str,
        expected_execution_id: &str,
        expected_step_id: &str,
        expected_fingerprint: &str,
    ) -> Result<bool, String> {
        let mut map = self.pending.lock().unwrap();
        let entry = map.get_mut(approval_id).ok_or_else(|| format!("Approval ID '{}' not found", approval_id))?;

        entry.update_status();

        if entry.status == "CONSUMED" {
            return Err("Approval token has already been consumed".to_string());
        }
        if entry.status == "EXPIRED" {
            return Err("Approval token has expired".to_string());
        }
        if entry.status == "REVOKED" {
            return Err("Approval token has been revoked".to_string());
        }
        if entry.status == "REJECTED" {
            return Err("Approval token has been rejected".to_string());
        }

        if entry.execution_id != expected_execution_id || entry.step_id != expected_step_id {
            entry.status = "REVOKED".to_string();
            return Err("Approval token execution/step mismatch".to_string());
        }

        if entry.action_fingerprint != expected_fingerprint {
            entry.status = "REVOKED".to_string();
            return Err("Action fingerprint mismatch: action configuration changed".to_string());
        }

        if entry.status != "APPROVED" {
            return Err(format!("Approval status is '{}', expected APPROVED", entry.status));
        }

        let is_approved = entry.approved.unwrap_or(false);
        if is_approved {
            entry.consumed = true;
            entry.status = "CONSUMED".to_string();
            Ok(true)
        } else {
            entry.status = "REJECTED".to_string();
            Err("Approval has been rejected".to_string())
        }
    }

    pub fn is_approved(&self, approval_id: &str) -> Option<bool> {
        let map = self.pending.lock().unwrap();
        map.get(approval_id).and_then(|a| a.approved)
    }

    pub fn list_pending(&self) -> Vec<PendingApproval> {
        let mut map = self.pending.lock().unwrap();
        let mut list = Vec::new();
        for approval in map.values_mut() {
            approval.update_status();
            if approval.status == "PENDING" {
                list.push(approval.clone());
            }
        }
        list
    }

    pub fn get_approval(&self, approval_id: &str) -> Option<PendingApproval> {
        let mut map = self.pending.lock().unwrap();
        map.get_mut(approval_id).map(|a| {
            a.update_status();
            a.clone()
        })
    }

    pub fn consume_existing_approval(
        &self,
        expected_pipeline_id: &Option<String>,
        expected_pipeline_version: Option<u32>,
        expected_step_id: &str,
        expected_fingerprint: &str,
    ) -> Result<bool, String> {
        let mut map = self.pending.lock().unwrap();
        
        // Find matching approval
        let mut found_id = None;
        for (id, app) in map.iter_mut() {
            app.update_status();
            if app.status == "APPROVED" || app.status == "PENDING" {
                if app.pipeline_id == *expected_pipeline_id 
                    && app.pipeline_version == expected_pipeline_version
                    && app.step_id == expected_step_id
                    && app.action_fingerprint == expected_fingerprint {
                    found_id = Some(id.clone());
                    break;
                }
            }
        }

        if let Some(id) = found_id {
            let entry = map.get_mut(&id).unwrap();
            if entry.status == "APPROVED" {
                entry.consumed = true;
                entry.status = "CONSUMED".to_string();
                Ok(true)
            } else {
                Err("Found matching approval but it is still PENDING".to_string())
            }
        } else {
            Err("No matching pre-approved token found".to_string())
        }
    }
}
