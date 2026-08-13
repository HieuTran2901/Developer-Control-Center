import os

path = r'E:\Github project\Developer-Control-Center\src-tauri\src\policy\tests.rs'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find('// ==========================================')
start_idx = content.find('// Phase 7: Comprehensive Test Matrix', start_idx)
cut_idx = content.rfind('\n', 0, start_idx)

content = content[:cut_idx]

tests = """
    // ==========================================
    // Phase 7: Comprehensive Test Matrix
    // CATEGORY A — POLICY ENGINE
    // ==========================================

    fn create_test_req(action_type: ActionType, command: Option<&str>, args: Vec<&str>, path: Option<&str>, url: Option<&str>) -> PolicyEvaluationRequest {
        PolicyEvaluationRequest {
            execution_id: "exec-test-1".into(),
            pipeline_id: "pipe-test-1".into(),
            stage_id: "stage-1".into(),
            step_id: "step-1".into(),
            step_type: "Command".into(),
            environment_id: None,
            platform: None,
            action_type,
            command: command.map(|s| s.into()),
            args: args.into_iter().map(|s| s.into()).collect(),
            cwd: None,
            path: path.map(|s| s.into()),
            url: url.map(|s| s.into()),
            workspace_root: r"C:\\workspace".into(),
            policy_version: "1.0".into(),
            pipeline_version: Some(1),
        }
    }

    #[test]
    fn test_cat_a_fs_relative_path_allowed() {
        let engine = PolicyEngine::new();
        let req = create_test_req(ActionType::FileRead, None, vec![], Some("./src/main.rs"), None);
        let decision = engine.evaluate(&req);
        assert!(matches!(decision.decision, PolicyDecision::Allow { .. }));
    }

    #[test]
    fn test_cat_a_fs_absolute_path_rejected() {
        let engine = PolicyEngine::new();
        let req = create_test_req(ActionType::FileRead, None, vec![], Some("/etc/passwd"), None);
        let decision = engine.evaluate(&req);
        assert!(matches!(decision.decision, PolicyDecision::Deny { .. }));
    }

    #[test]
    fn test_cat_a_fs_traversal_dotdot_rejected() {
        let engine = PolicyEngine::new();
        let req = create_test_req(ActionType::FileRead, None, vec![], Some("../../secret.txt"), None);
        let decision = engine.evaluate(&req);
        assert!(matches!(decision.decision, PolicyDecision::Deny { .. }));
    }

    #[test]
    fn test_cat_a_fs_mixed_separators_traversal_rejected() {
        let engine = PolicyEngine::new();
        let req = create_test_req(ActionType::FileRead, None, vec![], Some("..\\\\../secret.txt"), None);
        let decision = engine.evaluate(&req);
        assert!(matches!(decision.decision, PolicyDecision::Deny { .. }));
    }

    #[test]
    fn test_cat_a_fs_escape_workspace_rejected() {
        let engine = PolicyEngine::new();
        let req = create_test_req(ActionType::FileRead, None, vec![], Some("../outside_workspace"), None);
        let decision = engine.evaluate(&req);
        assert!(matches!(decision.decision, PolicyDecision::Deny { .. }));
    }

    #[test]
    fn test_cat_a_fs_hidden_sensitive_file_rejected() {
        let engine = PolicyEngine::new();
        let req = create_test_req(ActionType::FileRead, None, vec![], Some(".git/config"), None);
        let decision = engine.evaluate(&req);
        assert!(matches!(decision.decision, PolicyDecision::Deny { .. }));
    }

    #[test]
    fn test_cat_a_fs_env_file_access_rejected() {
        let engine = PolicyEngine::new();
        let req = create_test_req(ActionType::FileRead, None, vec![], Some(".env"), None);
        let decision = engine.evaluate(&req);
        assert!(matches!(decision.decision, PolicyDecision::Deny { .. }));
    }

    #[test]
    fn test_cat_a_fs_credential_secret_access_rejected() {
        let engine = PolicyEngine::new();
        let req = create_test_req(ActionType::FileRead, None, vec![], Some("credentials/aws_keys.txt"), None);
        let decision = engine.evaluate(&req);
        assert!(matches!(decision.decision, PolicyDecision::Deny { .. }));
    }

    #[test]
    fn test_cat_a_fs_valid_project_file_allowed() {
        let engine = PolicyEngine::new();
        let req = create_test_req(ActionType::FileRead, None, vec![], Some("package.json"), None);
        let decision = engine.evaluate(&req);
        assert!(matches!(decision.decision, PolicyDecision::Allow { .. }));
    }

    #[test]
    fn test_cat_a_git_safe_read_only_allowed() {
        let engine = PolicyEngine::new();
        let req = create_test_req(ActionType::Command, Some("git"), vec!["log", "-n", "1"], None, None);
        let decision = engine.evaluate(&req);
        assert!(matches!(decision.decision, PolicyDecision::Allow { .. }));
    }

    #[test]
    fn test_cat_a_git_branch_status_log_allowed() {
        let engine = PolicyEngine::new();
        let req = create_test_req(ActionType::Command, Some("git"), vec!["status"], None, None);
        let decision = engine.evaluate(&req);
        assert!(matches!(decision.decision, PolicyDecision::Allow { .. }));
    }

    #[test]
    fn test_cat_a_git_destructive_command_rejected() {
        let engine = PolicyEngine::new();
        let req = create_test_req(ActionType::Command, Some("git"), vec!["push", "--force"], None, None);
        let decision = engine.evaluate(&req);
        assert!(matches!(decision.decision, PolicyDecision::RequireApproval { .. }));
    }

    #[test]
    fn test_cat_a_git_unsafe_arg_combination_rejected() {
        let engine = PolicyEngine::new();
        let req = create_test_req(ActionType::Command, Some("git"), vec!["commit", "-a", "-m", "auto"], None, None);
        let decision = engine.evaluate(&req);
        assert!(matches!(decision.decision, PolicyDecision::RequireApproval { .. }));
    }

    #[test]
    fn test_cat_a_net_public_url_allowed() {
        let engine = PolicyEngine::new();
        let req = create_test_req(ActionType::Network, None, vec![], None, Some("https://api.github.com/users"));
        let decision = engine.evaluate(&req);
        assert!(matches!(decision.decision, PolicyDecision::Allow { .. }));
    }

    #[test]
    fn test_cat_a_net_localhost_rejected() {
        let engine = PolicyEngine::new();
        let req = create_test_req(ActionType::Network, None, vec![], None, Some("http://localhost:8080/admin"));
        let decision = engine.evaluate(&req);
        assert!(matches!(decision.decision, PolicyDecision::Deny { .. }));
    }

    // ==========================================
    // CATEGORY B — APPROVAL & SECURITY BINDING
    // ==========================================

    #[test]
    fn test_cat_b_valid_approval_executes() {
        let store = ApprovalStore::new();
        let fp = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["valid".to_string()], r"C:\\workspace", "1.0", Some(1));
        
        let _ = store.register_approval_detailed(
            "app-b-1".into(),
            "exec-1".into(),
            Some("pipe-1".into()),
            Some(1),
            "step-1".into(),
            Some("step1".into()),
            "Command".into(),
            Some("echo".into()),
            vec!["valid".into()],
            "Low".into(),
            "OK".into(),
            "echo valid".into(),
            fp.clone(),
            3600
        );
        
        assert!(store.consume_existing_approval(&Some("pipe-1".into()), Some(1), "step-1", &fp).is_ok());
    }

    #[test]
    fn test_cat_b_missing_approval_rejected() {
        let store = ApprovalStore::new();
        let fp = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["valid".to_string()], r"C:\\workspace", "1.0", Some(1));
        
        let result = store.consume_existing_approval(&Some("pipe-1".into()), Some(1), "step-1", &fp);
        assert_eq!(result.unwrap_err(), "NOT_FOUND");
    }

    #[test]
    fn test_cat_b_expired_stale_approval_rejected() {
        let store = ApprovalStore::new();
        let fp = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["valid".to_string()], r"C:\\workspace", "1.0", Some(1));
        
        let _ = store.register_approval_detailed(
            "app-b-2".into(),
            "exec-1".into(),
            Some("pipe-1".into()),
            Some(1),
            "step-1".into(),
            Some("step1".into()),
            "Command".into(),
            Some("echo".into()),
            vec!["valid".into()],
            "Low".into(),
            "OK".into(),
            "echo valid".into(),
            fp.clone(),
            0 // Expires immediately
        );
        
        let result = store.consume_existing_approval(&Some("pipe-1".into()), Some(1), "step-1", &fp);
        assert_eq!(result.unwrap_err(), "EXPIRED");
    }

    #[test]
    fn test_cat_b_pipeline_version_mismatch_rejected() {
        let store = ApprovalStore::new();
        let fp = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["valid".to_string()], r"C:\\workspace", "1.0", Some(1));
        
        let _ = store.register_approval_detailed(
            "app-b-3".into(),
            "exec-1".into(),
            Some("pipe-1".into()),
            Some(1),
            "step-1".into(),
            Some("step1".into()),
            "Command".into(),
            Some("echo".into()),
            vec!["valid".into()],
            "Low".into(),
            "OK".into(),
            "echo valid".into(),
            fp.clone(),
            3600
        );
        
        // Attempting to execute with pipeline_version = Some(2)
        let result = store.consume_existing_approval(&Some("pipe-1".into()), Some(2), "step-1", &fp);
        assert_eq!(result.unwrap_err(), "VERSION_MISMATCH");
    }

    #[test]
    fn test_cat_b_pipeline_fingerprint_mismatch_rejected() {
        let store = ApprovalStore::new();
        let fp_approved = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["valid".to_string()], r"C:\\workspace", "1.0", Some(1));
        let fp_tampered = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["malicious".to_string()], r"C:\\workspace", "1.0", Some(1));
        
        let _ = store.register_approval_detailed(
            "app-b-4".into(),
            "exec-1".into(),
            Some("pipe-1".into()),
            Some(1),
            "step-1".into(),
            Some("step1".into()),
            "Command".into(),
            Some("echo".into()),
            vec!["valid".into()],
            "Low".into(),
            "OK".into(),
            "echo valid".into(),
            fp_approved.clone(),
            3600
        );
        
        let result = store.consume_existing_approval(&Some("pipe-1".into()), Some(1), "step-1", &fp_tampered);
        assert_eq!(result.unwrap_err(), "FINGERPRINT_MISMATCH");
    }

    #[test]
    fn test_cat_b_command_arg_tampering_rejected() {
        let store = ApprovalStore::new();
        let fp_approved = ApprovalStore::compute_canonical_fingerprint("Command", Some("npm"), &["run".to_string(), "build".to_string()], r"C:\\workspace", "1.0", Some(1));
        
        // If args are modified but someone passes the original fingerprint, they still fail if they attempt to compute new fingerprint and match
        let fp_tampered = ApprovalStore::compute_canonical_fingerprint("Command", Some("npm"), &["run".to_string(), "malicious".to_string()], r"C:\\workspace", "1.0", Some(1));
        
        let _ = store.register_approval_detailed(
            "app-b-5".into(),
            "exec-1".into(),
            Some("pipe-1".into()),
            Some(1),
            "step-1".into(),
            Some("step1".into()),
            "Command".into(),
            Some("npm".into()),
            vec!["run".into(), "build".into()],
            "Low".into(),
            "OK".into(),
            "npm run build".into(),
            fp_approved.clone(),
            3600
        );
        
        let result = store.consume_existing_approval(&Some("pipe-1".into()), Some(1), "step-1", &fp_tampered);
        assert_eq!(result.unwrap_err(), "FINGERPRINT_MISMATCH");
    }

    #[test]
    fn test_cat_b_working_dir_tampering_rejected() {
        let store = ApprovalStore::new();
        let fp_approved = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["hi".to_string()], r"C:\\workspace", "1.0", Some(1));
        let fp_tampered = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["hi".to_string()], r"C:\\malicious", "1.0", Some(1));
        
        let _ = store.register_approval_detailed(
            "app-b-6".into(),
            "exec-1".into(),
            Some("pipe-1".into()),
            Some(1),
            "step-1".into(),
            Some("step1".into()),
            "Command".into(),
            Some("echo".into()),
            vec!["hi".into()],
            "Low".into(),
            "OK".into(),
            "echo hi".into(),
            fp_approved.clone(),
            3600
        );
        
        let result = store.consume_existing_approval(&Some("pipe-1".into()), Some(1), "step-1", &fp_tampered);
        assert_eq!(result.unwrap_err(), "FINGERPRINT_MISMATCH");
    }

    #[test]
    fn test_cat_b_step_order_tampering_rejected() {
        let store = ApprovalStore::new();
        let fp_approved = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["hi".to_string()], r"C:\\workspace", "1.0", Some(1));
        
        let _ = store.register_approval_detailed(
            "app-b-7".into(),
            "exec-1".into(),
            Some("pipe-1".into()),
            Some(1),
            "step-1".into(),
            Some("step1".into()),
            "Command".into(),
            Some("echo".into()),
            vec!["hi".into()],
            "Low".into(),
            "OK".into(),
            "echo hi".into(),
            fp_approved.clone(),
            3600
        );
        
        // Changing step ID from step-1 to step-2
        let result = store.consume_existing_approval(&Some("pipe-1".into()), Some(1), "step-2", &fp_approved);
        assert_eq!(result.unwrap_err(), "NOT_FOUND");
    }

    #[test]
    fn test_cat_b_pipeline_id_mismatch_rejected() {
        let store = ApprovalStore::new();
        let fp_approved = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["hi".to_string()], r"C:\\workspace", "1.0", Some(1));
        
        let _ = store.register_approval_detailed(
            "app-b-8".into(),
            "exec-1".into(),
            Some("pipe-1".into()),
            Some(1),
            "step-1".into(),
            Some("step1".into()),
            "Command".into(),
            Some("echo".into()),
            vec!["hi".into()],
            "Low".into(),
            "OK".into(),
            "echo hi".into(),
            fp_approved.clone(),
            3600
        );
        
        let result = store.consume_existing_approval(&Some("pipe-2".into()), Some(1), "step-1", &fp_approved);
        assert_eq!(result.unwrap_err(), "NOT_FOUND");
    }

    #[test]
    fn test_cat_b_approval_replay_reuse_rejected() {
        let store = ApprovalStore::new();
        let fp = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["hi".to_string()], r"C:\\workspace", "1.0", Some(1));
        
        let _ = store.register_approval_detailed(
            "app-b-9".into(),
            "exec-1".into(),
            Some("pipe-1".into()),
            Some(1),
            "step-1".into(),
            Some("step1".into()),
            "Command".into(),
            Some("echo".into()),
            vec!["hi".into()],
            "Low".into(),
            "OK".into(),
            "echo hi".into(),
            fp.clone(),
            3600
        );
        
        // First consumption succeeds
        assert!(store.consume_existing_approval(&Some("pipe-1".into()), Some(1), "step-1", &fp).is_ok());
        
        // Second consumption (replay) fails
        let result = store.consume_existing_approval(&Some("pipe-1".into()), Some(1), "step-1", &fp);
        assert_eq!(result.unwrap_err(), "CONSUMED");
    }
}
"""

content = content + "\n" + tests

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Tests rewritten successfully")
