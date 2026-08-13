#[cfg(test)]
mod tests {
    use crate::pipeline::domain::{PipelineDefinition, PipelineStage, PipelineStep, PipelineStepType, StepConfig};
    use crate::pipeline::history::models::*;
    use crate::pipeline::history::store::PipelineHistoryStore;
    use tempfile::tempdir;
    use std::collections::HashMap;

    fn mock_pipeline(id: &str, name: &str, version: u32) -> PipelineDefinition {
        PipelineDefinition {
            id: id.to_string(),
            name: name.to_string(),
            description: Some("Test pipeline".to_string()),
            version,
            trigger: "manual".to_string(),
            stages: vec![
                PipelineStage {
                    id: "stage-1".to_string(),
                    name: "Build".to_string(),
                    order: 1,
                    steps: vec![
                        PipelineStep {
                            id: "step-1".to_string(),
                            name: "Unit Test".to_string(),
                            step_type: PipelineStepType::Command,
                            config: StepConfig::Command {
                                command: "npm".to_string(),
                                args: vec!["test".to_string()],
                                cwd: None,
                            },
                            order: 1,
                            timeout_seconds: Some(30),
                            provenance: None,
                        }
                    ],
                }
            ],
            metadata: HashMap::new(),
            triggers: None,
            verification_status: Default::default(),
            confidence_score: 0.0,
            provenance: None,
            status: Default::default(),
        }
    }

    #[test]
    fn test_pipeline_generation_and_version_increment() {
        let dir = tempdir().unwrap();
        let store = PipelineHistoryStore::new(dir.path()).unwrap();

        let v1_def = mock_pipeline("pipe-1", "Pipeline 1", 1);
        let v1_rec = PipelineVersionRecord {
            pipeline_id: "pipe-1".to_string(),
            version: 1,
            name: "Pipeline 1".to_string(),
            description: None,
            trigger: "manual".to_string(),
            definition: v1_def.clone(),
            created_at_ms: PipelineHistoryStore::now_ms(),
            source_type: "ai_generator".to_string(),
            prompt_reference: Some("Generate build pipeline with api_key=secret123".to_string()),
            provider_id: Some("openai".to_string()),
            model_name: Some("gpt-4".to_string()),
            fingerprint: "fp-v1".to_string(),
        };

        store.save_version(v1_rec).unwrap();
        assert_eq!(store.get_next_version("pipe-1"), 2);

        let v2_def = mock_pipeline("pipe-1", "Pipeline 1 Updated", 2);
        let v2_rec = PipelineVersionRecord {
            pipeline_id: "pipe-1".to_string(),
            version: 2,
            name: "Pipeline 1 Updated".to_string(),
            description: None,
            trigger: "manual".to_string(),
            definition: v2_def,
            created_at_ms: PipelineHistoryStore::now_ms(),
            source_type: "ai_generator".to_string(),
            prompt_reference: Some("Update pipeline".to_string()),
            provider_id: Some("openai".to_string()),
            model_name: Some("gpt-4".to_string()),
            fingerprint: "fp-v2".to_string(),
        };
        store.save_version(v2_rec).unwrap();

        assert_eq!(store.get_next_version("pipe-1"), 3);

        // Test immutability: v1 remains unchanged
        let fetched_v1 = store.get_version("pipe-1", 1).unwrap();
        assert_eq!(fetched_v1.definition, v1_def);
        assert!(fetched_v1.prompt_reference.unwrap().contains("[REDACTED_SECRET]"));
    }

    #[test]
    fn test_event_lifecycle_and_multi_pipeline_isolation() {
        let dir = tempdir().unwrap();
        let store = PipelineHistoryStore::new(dir.path()).unwrap();

        let evt1 = PipelineHistoryEvent {
            event_id: PipelineHistoryStore::generate_event_id(),
            sequence_number: 0,
            pipeline_id: "pipe-1".to_string(),
            pipeline_version: 1,
            event_type: "PIPELINE_GENERATED".to_string(),
            actor: AuditActor::Ai,
            timestamp_ms: PipelineHistoryStore::now_ms(),
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
            summary: "AI generated pipeline".to_string(),
            metadata: HashMap::new(),
        };

        let evt2 = PipelineHistoryEvent {
            event_id: PipelineHistoryStore::generate_event_id(),
            sequence_number: 0,
            pipeline_id: "pipe-2".to_string(),
            pipeline_version: 1,
            event_type: "PIPELINE_GENERATED".to_string(),
            actor: AuditActor::Ai,
            timestamp_ms: PipelineHistoryStore::now_ms(),
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
            summary: "AI generated pipeline for pipe-2".to_string(),
            metadata: HashMap::new(),
        };

        store.record_event(evt1).unwrap();
        store.record_event(evt2).unwrap();

        let pipe1_events = store.get_events("pipe-1");
        let pipe2_events = store.get_events("pipe-2");

        assert_eq!(pipe1_events.len(), 1);
        assert_eq!(pipe2_events.len(), 1);
        assert_eq!(pipe1_events[0].pipeline_id, "pipe-1");
        assert_eq!(pipe1_events[0].actor, AuditActor::Ai);
        assert_eq!(pipe2_events[0].pipeline_id, "pipe-2");
    }

    #[test]
    fn test_application_restart_persistence() {
        let dir = tempdir().unwrap();
        
        {
            let store = PipelineHistoryStore::new(dir.path()).unwrap();
            let v1_def = mock_pipeline("pipe-persistent", "Persistent Pipeline", 1);
            let v1_rec = PipelineVersionRecord {
                pipeline_id: "pipe-persistent".to_string(),
                version: 1,
                name: "Persistent Pipeline".to_string(),
                description: None,
                trigger: "manual".to_string(),
                definition: v1_def,
                created_at_ms: PipelineHistoryStore::now_ms(),
                source_type: "ai_generator".to_string(),
                prompt_reference: None,
                provider_id: None,
                model_name: None,
                fingerprint: "fp-persist".to_string(),
            };
            store.save_version(v1_rec).unwrap();
        }

        // Reload store from same path
        let reloaded_store = PipelineHistoryStore::new(dir.path()).unwrap();
        let fetched = reloaded_store.get_version("pipe-persistent", 1);
        assert!(fetched.is_some());
        assert_eq!(fetched.unwrap().name, "Persistent Pipeline");
    }

    #[test]
    fn test_structural_and_pattern_secret_redaction() {
        let prompt_with_key = "Build with API_KEY=sk-1234567890abcdef1234567890abcdef and password=MySecretPassword123";
        let redacted = redact_sensitive_data(prompt_with_key);
        assert!(!redacted.contains("sk-1234567890abcdef1234567890abcdef"));
        assert!(!redacted.contains("MySecretPassword123"));
        assert!(redacted.contains("[REDACTED_SECRET]"));

        let mut meta = HashMap::from([
            ("password".to_string(), "SuperSecret123".to_string()),
            ("authorization".to_string(), "Bearer secret-token-xyz".to_string()),
            ("safe_key".to_string(), "normal_value".to_string()),
        ]);
        redact_metadata(&mut meta);
        assert_eq!(meta.get("password").unwrap(), "[REDACTED_SECRET]");
        assert_eq!(meta.get("authorization").unwrap(), "[REDACTED_SECRET]");
        assert_eq!(meta.get("safe_key").unwrap(), "normal_value");
    }

    #[test]
    fn test_legacy_unknown_actor_deserialization() {
        let legacy_json = r#"{
            "eventId": "evt-legacy-123",
            "pipelineId": "pipe-legacy",
            "pipelineVersion": 1,
            "eventType": "PIPELINE_GENERATED",
            "timestampMs": 1700000000000,
            "summary": "Legacy audit event without actor field",
            "metadata": {}
        }"#;

        let event: PipelineHistoryEvent = serde_json::from_str(legacy_json).unwrap();
        assert_eq!(event.actor, AuditActor::Unknown);
        assert_eq!(event.sequence_number, 0);
    }

    #[test]
    fn test_deterministic_event_ordering() {
        let dir = tempdir().unwrap();
        let store = PipelineHistoryStore::new(dir.path()).unwrap();
        let now = PipelineHistoryStore::now_ms();

        let evt1 = PipelineHistoryEvent {
            event_id: "evt-1".to_string(),
            sequence_number: 0,
            pipeline_id: "pipe-order".to_string(),
            pipeline_version: 1,
            event_type: "STEP_STARTED".to_string(),
            actor: AuditActor::Executor,
            timestamp_ms: now,
            stage_id: Some("stage-1".to_string()),
            step_id: Some("step-1".to_string()),
            approval_id: None,
            execution_id: Some("exec-1".to_string()),
            command_fingerprint: None,
            previous_state: None,
            new_state: Some("RUNNING".to_string()),
            reason_code: None,
            reason: None,
            policy_code: None,
            summary: "Step 1 started".to_string(),
            metadata: HashMap::new(),
        };

        let evt2 = PipelineHistoryEvent {
            event_id: "evt-2".to_string(),
            sequence_number: 0,
            pipeline_id: "pipe-order".to_string(),
            pipeline_version: 1,
            event_type: "STEP_SUCCEEDED".to_string(),
            actor: AuditActor::Executor,
            timestamp_ms: now,
            stage_id: Some("stage-1".to_string()),
            step_id: Some("step-1".to_string()),
            approval_id: None,
            execution_id: Some("exec-1".to_string()),
            command_fingerprint: None,
            previous_state: Some("RUNNING".to_string()),
            new_state: Some("SUCCEEDED".to_string()),
            reason_code: None,
            reason: None,
            policy_code: None,
            summary: "Step 1 succeeded".to_string(),
            metadata: HashMap::new(),
        };

        store.record_event(evt1).unwrap();
        store.record_event(evt2).unwrap();

        let events = store.get_events("pipe-order");
        assert_eq!(events.len(), 2);
        assert!(events[0].sequence_number < events[1].sequence_number);
        assert_eq!(events[0].event_type, "STEP_STARTED");
        assert_eq!(events[1].event_type, "STEP_SUCCEEDED");
    }

    #[test]
    fn test_approval_renewal_and_hierarchical_summary() {
        let dir = tempdir().unwrap();
        let store = PipelineHistoryStore::new(dir.path()).unwrap();

        let v1_def = mock_pipeline("pipe-renew", "Renew Test", 1);
        store.save_version(PipelineVersionRecord {
            pipeline_id: "pipe-renew".to_string(),
            version: 1,
            name: "Renew Test".to_string(),
            description: None,
            trigger: "manual".to_string(),
            definition: v1_def,
            created_at_ms: PipelineHistoryStore::now_ms(),
            source_type: "ai_generator".to_string(),
            prompt_reference: None,
            provider_id: None,
            model_name: None,
            fingerprint: "fp-renew".to_string(),
        }).unwrap();

        // 1. Old approval requested
        store.record_event(PipelineHistoryEvent {
            event_id: PipelineHistoryStore::generate_event_id(),
            sequence_number: 0,
            pipeline_id: "pipe-renew".to_string(),
            pipeline_version: 1,
            event_type: "APPROVAL_REQUESTED".to_string(),
            actor: AuditActor::PolicyEngine,
            timestamp_ms: PipelineHistoryStore::now_ms(),
            stage_id: Some("stage-1".to_string()),
            step_id: Some("step-1".to_string()),
            approval_id: Some("app-old-123".to_string()),
            execution_id: Some("exec-1".to_string()),
            command_fingerprint: Some("fp-cmd-1".to_string()),
            previous_state: Some("NONE".to_string()),
            new_state: Some("PENDING".to_string()),
            reason_code: Some("POLICY_REQ".to_string()),
            reason: None,
            policy_code: None,
            summary: "Approval requested".to_string(),
            metadata: HashMap::new(),
        }).unwrap();

        // 2. Old approval revoked for renewal
        store.record_event(PipelineHistoryEvent {
            event_id: PipelineHistoryStore::generate_event_id(),
            sequence_number: 0,
            pipeline_id: "pipe-renew".to_string(),
            pipeline_version: 1,
            event_type: "APPROVAL_REVOKED".to_string(),
            actor: AuditActor::User,
            timestamp_ms: PipelineHistoryStore::now_ms(),
            stage_id: Some("stage-1".to_string()),
            step_id: Some("step-1".to_string()),
            approval_id: Some("app-old-123".to_string()),
            execution_id: Some("exec-1".to_string()),
            command_fingerprint: Some("fp-cmd-1".to_string()),
            previous_state: Some("PENDING".to_string()),
            new_state: Some("REVOKED".to_string()),
            reason_code: Some("RENEWAL".to_string()),
            reason: None,
            policy_code: None,
            summary: "Old approval revoked".to_string(),
            metadata: HashMap::new(),
        }).unwrap();

        // 3. New approval requested
        store.record_event(PipelineHistoryEvent {
            event_id: PipelineHistoryStore::generate_event_id(),
            sequence_number: 0,
            pipeline_id: "pipe-renew".to_string(),
            pipeline_version: 1,
            event_type: "APPROVAL_REQUESTED".to_string(),
            actor: AuditActor::User,
            timestamp_ms: PipelineHistoryStore::now_ms(),
            stage_id: Some("stage-1".to_string()),
            step_id: Some("step-1".to_string()),
            approval_id: Some("app-new-456".to_string()),
            execution_id: Some("exec-1".to_string()),
            command_fingerprint: Some("fp-cmd-1".to_string()),
            previous_state: Some("NONE".to_string()),
            new_state: Some("PENDING".to_string()),
            reason_code: Some("RENEWED_REQUEST".to_string()),
            reason: None,
            policy_code: None,
            summary: "New approval requested".to_string(),
            metadata: HashMap::new(),
        }).unwrap();

        // 4. New approval approved
        store.record_event(PipelineHistoryEvent {
            event_id: PipelineHistoryStore::generate_event_id(),
            sequence_number: 0,
            pipeline_id: "pipe-renew".to_string(),
            pipeline_version: 1,
            event_type: "APPROVAL_APPROVED".to_string(),
            actor: AuditActor::User,
            timestamp_ms: PipelineHistoryStore::now_ms(),
            stage_id: Some("stage-1".to_string()),
            step_id: Some("step-1".to_string()),
            approval_id: Some("app-new-456".to_string()),
            execution_id: Some("exec-1".to_string()),
            command_fingerprint: Some("fp-cmd-1".to_string()),
            previous_state: Some("PENDING".to_string()),
            new_state: Some("APPROVED".to_string()),
            reason_code: Some("USER_APPROVAL".to_string()),
            reason: None,
            policy_code: None,
            summary: "New approval approved".to_string(),
            metadata: HashMap::new(),
        }).unwrap();

        let summaries = store.get_all_summaries();
        let pipe_sum = summaries.iter().find(|s| s.pipeline_id == "pipe-renew").unwrap();
        // Step active state must be APPROVED, not collapsed or incremented incorrectly
        assert_eq!(pipe_sum.security_summary.approved_count, 1);
        assert_eq!(pipe_sum.security_summary.rejected_count, 0);
        assert_eq!(pipe_sum.security_summary.approval_required_count, 0);
    }

    #[test]
    fn test_export_lifecycle_event_flow() {
        let dir = tempdir().unwrap();
        let store = PipelineHistoryStore::new(dir.path()).unwrap();

        let v1_def = mock_pipeline("pipe-export", "Export Test", 1);
        store.save_version(PipelineVersionRecord {
            pipeline_id: "pipe-export".to_string(),
            version: 1,
            name: "Export Test".to_string(),
            description: None,
            trigger: "manual".to_string(),
            definition: v1_def,
            created_at_ms: PipelineHistoryStore::now_ms(),
            source_type: "ai_generator".to_string(),
            prompt_reference: None,
            provider_id: None,
            model_name: None,
            fingerprint: "fp-export".to_string(),
        }).unwrap();

        store.record_event(PipelineHistoryEvent {
            event_id: PipelineHistoryStore::generate_event_id(),
            sequence_number: 0,
            pipeline_id: "pipe-export".to_string(),
            pipeline_version: 1,
            event_type: "EXPORT_REQUESTED".to_string(),
            actor: AuditActor::User,
            timestamp_ms: PipelineHistoryStore::now_ms(),
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
            summary: "Export requested".to_string(),
            metadata: HashMap::from([("platform".to_string(), "github".to_string())]),
        }).unwrap();

        store.record_event(PipelineHistoryEvent {
            event_id: PipelineHistoryStore::generate_event_id(),
            sequence_number: 0,
            pipeline_id: "pipe-export".to_string(),
            pipeline_version: 1,
            event_type: "EXPORT_AUTHORIZED".to_string(),
            actor: AuditActor::PolicyEngine,
            timestamp_ms: PipelineHistoryStore::now_ms(),
            stage_id: None,
            step_id: None,
            approval_id: None,
            execution_id: None,
            command_fingerprint: None,
            previous_state: Some("REQUESTED".to_string()),
            new_state: Some("AUTHORIZED".to_string()),
            reason_code: Some("POLICY_ALLOW".to_string()),
            reason: None,
            policy_code: None,
            summary: "Export authorized".to_string(),
            metadata: HashMap::from([("platform".to_string(), "github".to_string())]),
        }).unwrap();

        store.record_event(PipelineHistoryEvent {
            event_id: PipelineHistoryStore::generate_event_id(),
            sequence_number: 0,
            pipeline_id: "pipe-export".to_string(),
            pipeline_version: 1,
            event_type: "PIPELINE_EXPORTED".to_string(),
            actor: AuditActor::User,
            timestamp_ms: PipelineHistoryStore::now_ms(),
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
            summary: "Pipeline exported".to_string(),
            metadata: HashMap::from([("platform".to_string(), "github".to_string())]),
        }).unwrap();

        let events = store.get_events("pipe-export");
        assert_eq!(events.len(), 3);
        assert_eq!(events[0].event_type, "EXPORT_REQUESTED");
        assert_eq!(events[1].event_type, "EXPORT_AUTHORIZED");
        assert_eq!(events[2].event_type, "PIPELINE_EXPORTED");
    }
}




