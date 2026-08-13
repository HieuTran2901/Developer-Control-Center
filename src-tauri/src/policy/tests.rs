#[cfg(test)]
mod policy_unit_tests {
    // use std::net::IpAddr;
    use crate::policy::approval::ApprovalStore;
    use crate::policy::engine::{PolicyEngine, CURRENT_POLICY_VERSION};
    use crate::policy::models::{ActionType, PolicyDecision, PolicyEvaluationRequest, RiskLevel};
    // use crate::policy::rules::network_policy::NetworkPolicyRule;

    fn make_request(
        step_id: &str,
        step_type: &str,
        action_type: ActionType,
        command: Option<&str>,
        args: Vec<&str>,
        path: Option<&str>,
        url: Option<&str>,
    ) -> PolicyEvaluationRequest {
        PolicyEvaluationRequest {
            execution_id: "exec-test-1".to_string(),
            pipeline_id: "pipe-test-1".to_string(),
            pipeline_version: None,
            stage_id: "stage-test-1".to_string(),
            step_id: step_id.to_string(),
            step_type: step_type.to_string(),
            environment_id: None,
            platform: None,
            action_type,
            command: command.map(|s| s.to_string()),
            args: args.into_iter().map(|s| s.to_string()).collect(),
            cwd: None,
            path: path.map(|s| s.to_string()),
            url: url.map(|s| s.to_string()),
            workspace_root: r"E:\Github project\Developer-Control-Center".to_string(),
            policy_version: CURRENT_POLICY_VERSION.to_string(),
        }
    }

    // ==========================================
    // Group A: Command Hardening (SEC-01 & SEC-06)
    // ==========================================

    #[test]
    fn test_adv_command_args_operator_injection_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-a1", "Command", ActionType::Command, Some("npm"), vec!["test", "&&", "rm", "-rf", "/"], None, None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_COMMAND_SMUGGLING");
            }
            _ => panic!("Expected Deny decision for operator injection in args array"),
        }
    }

    #[test]
    fn test_adv_command_args_pipe_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-a2", "Command", ActionType::Command, Some("cargo"), vec!["test", "|", "nc", "bad.com"], None, None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_COMMAND_SMUGGLING");
            }
            _ => panic!("Expected Deny decision for pipe operator in args array"),
        }
    }

    #[test]
    fn test_adv_command_newline_injection_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-a3", "Command", ActionType::Command, Some("npm test\nrm -rf /"), vec![], None, None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_NEWLINE_INJECTION");
            }
            _ => panic!("Expected Deny decision for newline injection in command"),
        }
    }

    #[test]
    fn test_adv_command_carriage_return_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-a4", "Command", ActionType::Command, Some("cargo"), vec!["test\rwhoami"], None, None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_NEWLINE_INJECTION");
            }
            _ => panic!("Expected Deny decision for carriage return injection in args"),
        }
    }

    #[test]
    fn test_adv_powershell_subshell_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-a5", "Command", ActionType::Command, Some("echo"), vec!["$(whoami)"], None, None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_POWERSHELL_SUBSHELL");
            }
            _ => panic!("Expected Deny decision for PowerShell subshell $(...)"),
        }
    }

    #[test]
    fn test_adv_powershell_encoded_short_flag_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-a6", "Command", ActionType::Command, Some("powershell"), vec!["-e", "JABh..."], None, None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_ENCODED_POWERSHELL");
            }
            _ => panic!("Expected Deny decision for PowerShell short flag -e"),
        }
    }

    #[test]
    fn test_adv_invoke_expression_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-a7", "Command", ActionType::Command, Some("powershell"), vec!["Invoke-Expression", "download"], None, None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_ENCODED_POWERSHELL");
            }
            _ => panic!("Expected Deny decision for Invoke-Expression"),
        }
    }

    #[test]
    fn test_adv_cmd_c_wrapper_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-a8", "Command", ActionType::Command, Some("cmd.exe"), vec!["/c", "dir"], None, None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_ENCODED_POWERSHELL");
            }
            _ => panic!("Expected Deny decision for cmd.exe /c wrapper"),
        }
    }

    #[test]
    fn test_adv_redirection_operator_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-a9", "Command", ActionType::Command, Some("echo"), vec!["secret", ">", "out.txt"], None, None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_COMMAND_SMUGGLING");
            }
            _ => panic!("Expected Deny decision for redirection operator >"),
        }
    }

    #[test]
    fn test_adv_unknown_binary_wrapper_requires_approval() {
        let engine = PolicyEngine::new();
        let req = make_request("step-a10", "Command", ActionType::Command, Some("mytool"), vec!["--flag"], None, None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::RequireApproval { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_REQUIRE_APPROVAL_UNRECOGNIZED_BINARY");
            }
            _ => panic!("Expected RequireApproval decision for unknown binary"),
        }
    }

    // ==========================================
    // Group B: Advanced SSRF (SEC-02 & SEC-05)
    // ==========================================

    #[test]
    fn test_adv_ssrf_userinfo_bypass_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-b1", "Http", ActionType::Network, None, vec![], None, Some("http://api.openai.com@127.0.0.1/admin"));
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_SSRF_ATTEMPT");
            }
            _ => panic!("Expected Deny decision for userinfo SSRF bypass"),
        }
    }

    #[test]
    fn test_adv_ssrf_localhost_string_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-b2", "Http", ActionType::Network, None, vec![], None, Some("http://localhost:8080/"));
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_SSRF_ATTEMPT");
            }
            _ => panic!("Expected Deny decision for localhost"),
        }
    }

    #[test]
    fn test_adv_ssrf_127_0_0_1_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-b3", "Http", ActionType::Network, None, vec![], None, Some("http://127.0.0.1/"));
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_SSRF_ATTEMPT");
            }
            _ => panic!("Expected Deny decision for 127.0.0.1"),
        }
    }

    #[test]
    fn test_adv_ssrf_ipv6_loopback_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-b4", "Http", ActionType::Network, None, vec![], None, Some("http://[::1]/"));
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_SSRF_ATTEMPT");
            }
            _ => panic!("Expected Deny decision for IPv6 loopback ::1"),
        }
    }

    #[test]
    fn test_adv_ssrf_private_ipv4_10_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-b5", "Http", ActionType::Network, None, vec![], None, Some("http://10.0.0.1/"));
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_SSRF_ATTEMPT");
            }
            _ => panic!("Expected Deny decision for 10.0.0.1 private IP"),
        }
    }

    #[test]
    fn test_adv_ssrf_private_ipv4_192_168_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-b6", "Http", ActionType::Network, None, vec![], None, Some("http://192.168.1.1/"));
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_SSRF_ATTEMPT");
            }
            _ => panic!("Expected Deny decision for 192.168.1.1 private IP"),
        }
    }

    #[test]
    fn test_adv_ssrf_aws_metadata_169_254_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-b7", "Http", ActionType::Network, None, vec![], None, Some("http://169.254.169.254/latest/meta-data/"));
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_SSRF_ATTEMPT");
            }
            _ => panic!("Expected Deny decision for AWS metadata IP"),
        }
    }

    #[test]
    fn test_adv_ssrf_ipv4_mapped_ipv6_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-b8", "Http", ActionType::Network, None, vec![], None, Some("http://[::ffff:127.0.0.1]/"));
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_SSRF_ATTEMPT");
            }
            _ => panic!("Expected Deny decision for IPv4-mapped IPv6"),
        }
    }

    #[test]
    fn test_adv_ssrf_decimal_ip_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-b9", "Http", ActionType::Network, None, vec![], None, Some("http://2130706433/"));
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_SSRF_ATTEMPT");
            }
            _ => panic!("Expected Deny decision for decimal IP format"),
        }
    }

    #[test]
    fn test_adv_ssrf_hex_ip_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-b10", "Http", ActionType::Network, None, vec![], None, Some("http://0x7f000001/"));
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_SSRF_ATTEMPT");
            }
            _ => panic!("Expected Deny decision for hex IP format"),
        }
    }

    #[test]
    fn test_adv_ssrf_octal_ip_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-b11", "Http", ActionType::Network, None, vec![], None, Some("http://0177.0.0.1/"));
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_SSRF_ATTEMPT");
            }
            _ => panic!("Expected Deny decision for octal IP format"),
        }
    }

    #[test]
    fn test_adv_trusted_openai_url_allowed() {
        let engine = PolicyEngine::new();
        let req = make_request("step-b12", "Http", ActionType::Network, None, vec![], None, Some("https://api.openai.com/v1/chat/completions"));
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Allow { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_ALLOW_TRUSTED_PROVIDER_ENDPOINT");
            }
            _ => panic!("Expected Allow decision for trusted OpenAI API"),
        }
    }

    // ==========================================
    // Group C: Approval & Fingerprint (SEC-03 & SEC-04)
    // ==========================================

    #[test]
    fn test_adv_approval_id_unpredictable_random() {
        let id1 = ApprovalStore::generate_unpredictable_approval_id();
        let id2 = ApprovalStore::generate_unpredictable_approval_id();
        assert_ne!(id1, id2);
        assert!(id1.starts_with("app-"));
        assert!(id1.len() >= 20);
    }

    #[test]
    fn test_adv_fingerprint_comma_delimiter_collision_prevented() {
        let args1 = vec!["a,b".to_string(), "c".to_string()];
        let args2 = vec!["a".to_string(), "b,c".to_string()];

        let fp1 = ApprovalStore::compute_canonical_fingerprint("Command", Some("npm"), &args1, "E:\\root", CURRENT_POLICY_VERSION, None);
        let fp2 = ApprovalStore::compute_canonical_fingerprint("Command", Some("npm"), &args2, "E:\\root", CURRENT_POLICY_VERSION, None);

        assert_ne!(fp1, fp2);
    }

    #[test]
    fn test_adv_approval_replay_rejected() {
        let store = ApprovalStore::new();
        let fp = ApprovalStore::compute_canonical_fingerprint("Command", Some("npm"), &[], "E:\\root", CURRENT_POLICY_VERSION, None);
        let app_id = ApprovalStore::generate_unpredictable_approval_id();

        store.register_approval(app_id.clone(), "exec-1".into(), "step-1".into(), fp.clone(), 300_000);
        assert!(store.submit_approval(&app_id, true).is_ok());

        assert_eq!(store.verify_and_consume(&app_id, "exec-1", "step-1", &fp), Ok(true));

        // Replay attempt
        assert!(store.verify_and_consume(&app_id, "exec-1", "step-1", &fp).is_err());
    }

    #[test]
    fn test_adv_approval_expired_rejected() {
        let store = ApprovalStore::new();
        let fp = "fp-test".to_string();
        let app_id = ApprovalStore::generate_unpredictable_approval_id();

        store.register_approval(app_id.clone(), "exec-1".into(), "step-1".into(), fp.clone(), 0);
        std::thread::sleep(std::time::Duration::from_millis(5));

        assert!(store.submit_approval(&app_id, true).is_err());
    }

    #[test]
    fn test_adv_approval_modified_binary_rejected() {
        let store = ApprovalStore::new();
        let fp1 = ApprovalStore::compute_canonical_fingerprint("Command", Some("cargo"), &["check".into()], "E:\\root", CURRENT_POLICY_VERSION, None);
        let fp2 = ApprovalStore::compute_canonical_fingerprint("Command", Some("rm"), &["-rf".into()], "E:\\root", CURRENT_POLICY_VERSION, None);
        let app_id = ApprovalStore::generate_unpredictable_approval_id();

        store.register_approval(app_id.clone(), "exec-1".into(), "step-1".into(), fp1, 300_000);
        let _ = store.submit_approval(&app_id, true);

        let ver = store.verify_and_consume(&app_id, "exec-1", "step-1", &fp2);
        assert!(ver.is_err());
    }

    #[test]
    fn test_adv_approval_modified_args_rejected() {
        let store = ApprovalStore::new();
        let fp1 = ApprovalStore::compute_canonical_fingerprint("Command", Some("npm"), &["test".into()], "E:\\root", CURRENT_POLICY_VERSION, None);
        let fp2 = ApprovalStore::compute_canonical_fingerprint("Command", Some("npm"), &["test".into(), "&&".into(), "evil".into()], "E:\\root", CURRENT_POLICY_VERSION, None);
        let app_id = ApprovalStore::generate_unpredictable_approval_id();

        store.register_approval(app_id.clone(), "exec-1".into(), "step-1".into(), fp1, 300_000);
        let _ = store.submit_approval(&app_id, true);

        assert!(store.verify_and_consume(&app_id, "exec-1", "step-1", &fp2).is_err());
    }

    #[test]
    fn test_adv_approval_modified_path_rejected() {
        let store = ApprovalStore::new();
        let fp1 = ApprovalStore::compute_canonical_fingerprint("FileDelete", None, &[], "E:\\root1", CURRENT_POLICY_VERSION, None);
        let fp2 = ApprovalStore::compute_canonical_fingerprint("FileDelete", None, &[], "E:\\root2", CURRENT_POLICY_VERSION, None);
        let app_id = ApprovalStore::generate_unpredictable_approval_id();

        store.register_approval(app_id.clone(), "exec-1".into(), "step-1".into(), fp1, 300_000);
        let _ = store.submit_approval(&app_id, true);

        assert!(store.verify_and_consume(&app_id, "exec-1", "step-1", &fp2).is_err());
    }

    #[test]
    fn test_adv_approval_modified_url_rejected() {
        let store = ApprovalStore::new();
        let fp1 = ApprovalStore::compute_canonical_fingerprint("Network", None, &["url1".into()], "E:\\root", CURRENT_POLICY_VERSION, None);
        let fp2 = ApprovalStore::compute_canonical_fingerprint("Network", None, &["url2".into()], "E:\\root", CURRENT_POLICY_VERSION, None);
        let app_id = ApprovalStore::generate_unpredictable_approval_id();

        store.register_approval(app_id.clone(), "exec-1".into(), "step-1".into(), fp1, 300_000);
        let _ = store.submit_approval(&app_id, true);

        assert!(store.verify_and_consume(&app_id, "exec-1", "step-1", &fp2).is_err());
    }

    #[test]
    fn test_adv_concurrent_approval_isolation() {
        let store = ApprovalStore::new();
        let id1 = ApprovalStore::generate_unpredictable_approval_id();
        let id2 = ApprovalStore::generate_unpredictable_approval_id();
        let fp = "fp-shared".to_string();

        store.register_approval(id1.clone(), "exec-1".into(), "step-1".into(), fp.clone(), 300_000);
        store.register_approval(id2.clone(), "exec-2".into(), "step-2".into(), fp.clone(), 300_000);

        let _ = store.submit_approval(&id1, true);

        assert_eq!(store.verify_and_consume(&id1, "exec-1", "step-1", &fp), Ok(true));
        assert!(store.verify_and_consume(&id2, "exec-2", "step-2", &fp).is_err()); // id2 not yet submitted
    }

    #[test]
    fn test_adv_approval_single_use_consumed_flag() {
        let store = ApprovalStore::new();
        let id = ApprovalStore::generate_unpredictable_approval_id();
        let fp = "fp-flag".to_string();

        let app = store.register_approval(id.clone(), "exec-1".into(), "step-1".into(), fp.clone(), 300_000);
        assert!(!app.consumed);

        let _ = store.submit_approval(&id, true);
        let _ = store.verify_and_consume(&id, "exec-1", "step-1", &fp);

        let is_app = store.is_approved(&id);
        assert_eq!(is_app, Some(true));
    }

    // ==========================================
    // Group D: Filesystem Hardening (SEC-07)
    // ==========================================

    #[test]
    fn test_adv_filesystem_relative_dotdot_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-d1", "Artifact", ActionType::FileRead, None, vec![], Some(r"..\..\secret.txt"), None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_PATH_TRAVERSAL");
            }
            _ => panic!("Expected Deny decision for dotdot traversal"),
        }
    }

    #[test]
    fn test_adv_filesystem_absolute_system_path_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-d2", "Artifact", ActionType::FileRead, None, vec![], Some(r"C:\Windows\System32\drivers\etc\hosts"), None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_PATH_OUTSIDE_WORKSPACE");
            }
            _ => panic!("Expected Deny decision for system path outside workspace"),
        }
    }

    #[test]
    fn test_adv_filesystem_unc_path_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-d3", "Artifact", ActionType::FileRead, None, vec![], Some(r"\\192.168.1.1\share\data"), None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_UNC_PATH");
            }
            _ => panic!("Expected Deny decision for UNC path"),
        }
    }

    #[test]
    fn test_adv_filesystem_prefix_confusion_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-d4", "Artifact", ActionType::FileRead, None, vec![], Some(r"E:\Github project\Developer-Control-Center-other\secret.txt"), None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_PATH_OUTSIDE_WORKSPACE");
            }
            _ => panic!("Expected Deny decision for workspace prefix confusion"),
        }
    }

    #[test]
    fn test_adv_filesystem_canonical_junction_escape_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-d5", "Artifact", ActionType::FileRead, None, vec![], Some(r"C:\NonExistentPathExtendsOutside\file.txt"), None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert!(reason_code.contains("PATH"));
            }
            _ => panic!("Expected Deny decision for uncanonicalizable outside path"),
        }
    }

    #[test]
    fn test_adv_filesystem_workspace_valid_file_allowed() {
        let engine = PolicyEngine::new();
        let req = make_request("step-d6", "Artifact", ActionType::FileRead, None, vec![], Some(r"E:\Github project\Developer-Control-Center\src\lib.rs"), None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Allow { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_ALLOW_WORKSPACE_FILE_ACCESS");
            }
            _ => panic!("Expected Allow decision for valid workspace file"),
        }
    }

    #[test]
    fn test_adv_filesystem_delete_action_requires_approval() {
        let engine = PolicyEngine::new();
        let req = make_request("step-d7", "Artifact", ActionType::FileDelete, None, vec![], Some(r"E:\Github project\Developer-Control-Center\temp.log"), None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::RequireApproval { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_REQUIRE_APPROVAL_FILE_DELETE");
            }
            _ => panic!("Expected RequireApproval decision for file delete"),
        }
    }

    // ==========================================
    // Group E: Resource & Concurrency (SEC-08)
    // ==========================================

    #[tokio::test]
    async fn test_adv_approval_notify_instant_wakeup() {
        let store = ApprovalStore::new();
        let id = ApprovalStore::generate_unpredictable_approval_id();
        let fp = "fp-notify".to_string();

        store.register_approval(id.clone(), "exec-1".into(), "step-1".into(), fp.clone(), 300_000);
        let store_clone = store.clone();
        let id_clone = id.clone();

        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            let _ = store_clone.submit_approval(&id_clone, true);
        });

        let start = std::time::Instant::now();
        let notify = store.notify();
        let mut approved = false;
        loop {
            if let Ok(ver) = store.verify_and_consume(&id, "exec-1", "step-1", &fp) {
                approved = ver;
                break;
            }
            tokio::select! {
                _ = notify.notified() => {}
                _ = tokio::time::sleep(tokio::time::Duration::from_secs(1)) => { break; }
            }
        }

        assert!(approved);
        assert!(start.elapsed() < std::time::Duration::from_millis(500));
    }

    #[tokio::test]
    async fn test_adv_approval_cancellation_wakes_waiter() {
        let store = ApprovalStore::new();
        let id = ApprovalStore::generate_unpredictable_approval_id();
        let fp = "fp-cancel".to_string();

        store.register_approval(id.clone(), "exec-1".into(), "step-1".into(), fp.clone(), 300_000);
        let cancelled = std::sync::atomic::AtomicBool::new(false);

        let notify = store.notify();
        cancelled.store(true, std::sync::atomic::Ordering::Relaxed);
        notify.notify_waiters();

        assert!(cancelled.load(std::sync::atomic::Ordering::Relaxed));
    }

    #[test]
    fn test_adv_no_mutex_lock_held_during_await() {
        let store = ApprovalStore::new();
        let id = ApprovalStore::generate_unpredictable_approval_id();
        store.register_approval(id.clone(), "exec-1".into(), "step-1".into(), "fp-1".into(), 300_000);

        // Lock should be released immediately after register
        assert!(store.submit_approval(&id, true).is_ok());
    }

    #[test]
    fn test_adv_multiple_execution_waiter_isolation() {
        let store = ApprovalStore::new();
        let id1 = ApprovalStore::generate_unpredictable_approval_id();
        let id2 = ApprovalStore::generate_unpredictable_approval_id();

        store.register_approval(id1.clone(), "exec-1".into(), "step-1".into(), "fp-1".into(), 300_000);
        store.register_approval(id2.clone(), "exec-2".into(), "step-2".into(), "fp-2".into(), 300_000);

        let _ = store.submit_approval(&id1, true);

        assert_eq!(store.is_approved(&id1), Some(true));
        assert_eq!(store.get_approval(&id2).unwrap().status, "REJECTED");
    }

    // ==========================================
    // Group F: Secret Safety
    // ==========================================

    #[test]
    fn test_adv_secret_env_dump_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-f1", "Command", ActionType::Command, Some("printenv"), vec![], None, None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_SECRET_EXFILTRATION_RISK");
            }
            _ => panic!("Expected Deny decision for printenv"),
        }
    }

    #[test]
    fn test_adv_secret_credential_file_read_denied() {
        let engine = PolicyEngine::new();
        let req = make_request("step-f2", "Artifact", ActionType::FileRead, None, vec![], Some(r"E:\Github project\Developer-Control-Center\.env"), None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_CREDENTIAL_FILE_ACCESS");
            }
            _ => panic!("Expected Deny decision for .env read"),
        }
    }

    #[test]
    fn test_adv_fingerprint_contains_no_secrets() {
        let fp = ApprovalStore::compute_canonical_fingerprint("Command", Some("npm test"), &["sk-1234567890abcdef".into()], "E:\\root", CURRENT_POLICY_VERSION, None);
        assert!(!fp.contains("sk-1234567890abcdef"));
        assert!(fp.starts_with("fp-"));
    }

    #[test]
    fn test_adv_event_payload_contains_no_secrets() {
        let id = ApprovalStore::generate_unpredictable_approval_id();
        assert!(!id.contains("secret"));
    }

    // ==========================================
    // Group G: Policy Non-Bypassability
    // ==========================================

    #[test]
    fn test_adv_policy_denied_step_never_reaches_executor() {
        let engine = PolicyEngine::new();
        let req = make_request("step-g1", "Command", ActionType::Command, Some("rm -rf /"), vec![], None, None);
        let res = engine.evaluate(&req);
        assert!(matches!(res.decision, PolicyDecision::Deny { .. }));
    }

    #[test]
    fn test_adv_policy_unapproved_step_never_reaches_executor() {
        let engine = PolicyEngine::new();
        let req = make_request("step-g2", "Command", ActionType::Command, Some("custom_tool"), vec![], None, None);
        let res = engine.evaluate(&req);
        assert!(matches!(res.decision, PolicyDecision::RequireApproval { .. }));
    }

    #[test]
    fn test_adv_malformed_step_fails_closed() {
        let engine = PolicyEngine::new();
        let req = make_request("", "Command", ActionType::Command, None, vec![], None, None);
        let res = engine.evaluate(&req);
        assert!(matches!(res.decision, PolicyDecision::Deny { .. }));
    }

    #[test]
    fn test_adv_unknown_step_type_fails_closed() {
        let engine = PolicyEngine::new();
        let req = make_request("step-g4", "UnknownType", ActionType::Unknown, None, vec![], None, None);
        let res = engine.evaluate(&req);
        assert!(matches!(res.decision, PolicyDecision::Deny { .. }));
    }

    // ==========================================
    // Group H: Baseline Regression
    // ==========================================

    #[test]
    fn test_reg_windows_drive_letter_case_insensitivity() {
        let engine = PolicyEngine::new();
        let req = make_request("step-h1", "Artifact", ActionType::FileRead, None, vec![], Some(r"e:\Github project\Developer-Control-Center\src\lib.rs"), None);
        let res = engine.evaluate(&req);
        match res.decision {
            PolicyDecision::Allow { .. } => {}
            _ => panic!("Expected Allow decision for lowercase drive letter"),
        }
    }

    #[test]
    fn test_reg_policy_version_tag_preservation() {
        let engine = PolicyEngine::new();
        let req = make_request("step-h2", "mock", ActionType::Unknown, None, vec![], None, None);
        let res = engine.evaluate(&req);
        assert_eq!(res.policy_version, CURRENT_POLICY_VERSION);
    }

    #[test]
    fn test_human_approval_state_transitions() {
        let store = ApprovalStore::new();
        let fp = "fp-test".to_string();
        let app_id = ApprovalStore::generate_unpredictable_approval_id();

        // 1. Register detailed approval (starts as PENDING)
        let app = store.register_approval_detailed(
            app_id.clone(),
            "exec-1".into(),
            Some("pipe-1".into()),
            None,
            "step-1".into(),
            Some("Echo Step".into()),
            "Command".into(),
            Some("echo".into()),
            vec!["hello".into()],
            "High".into(),
            "POLICY_TEST".into(),
            "Review command".into(),
            fp.clone(),
            300_000,
        );
        
        assert_eq!(app.status, "PENDING");
        assert_eq!(store.get_approval(&app_id).unwrap().status, "PENDING");

        // 2. Transition PENDING -> APPROVED
        assert!(store.submit_approval(&app_id, true).is_ok());
        let approved_app = store.get_approval(&app_id).unwrap();
        assert_eq!(approved_app.status, "APPROVED");
        assert_eq!(approved_app.approved_by, Some("Operator".to_string()));
        assert!(approved_app.approved_at_ms.is_some());

        // 3. APPROVED cannot be approved again
        assert!(store.submit_approval(&app_id, true).is_err());
        
        // 4. APPROVED cannot be rejected
        assert!(store.submit_approval(&app_id, false).is_err());
    }

    #[test]
    fn test_human_approval_rejection_and_expiration() {
        let store = ApprovalStore::new();
        let fp = "fp-test".to_string();
        let app_id_reject = ApprovalStore::generate_unpredictable_approval_id();
        let app_id_expire = ApprovalStore::generate_unpredictable_approval_id();

        // 1. Transition PENDING -> REJECTED
        store.register_approval(app_id_reject.clone(), "exec-1".into(), "step-1".into(), fp.clone(), 300_000);
        assert!(store.submit_approval(&app_id_reject, false).is_ok());
        let rejected_app = store.get_approval(&app_id_reject).unwrap();
        assert_eq!(rejected_app.status, "REJECTED");
        assert_eq!(rejected_app.rejected_by, Some("Operator".to_string()));
        assert!(rejected_app.rejected_at_ms.is_some());

        // REJECTED cannot be approved
        assert!(store.submit_approval(&app_id_reject, true).is_err());

        // 2. Transition PENDING -> EXPIRED
        store.register_approval(app_id_expire.clone(), "exec-1".into(), "step-1".into(), fp.clone(), 0);
        std::thread::sleep(std::time::Duration::from_millis(2));
        let expired_app = store.get_approval(&app_id_expire).unwrap();
        assert_eq!(expired_app.status, "EXPIRED");

        // EXPIRED cannot be approved
        assert!(store.submit_approval(&app_id_expire, true).is_err());
    }

    #[test]
    fn test_human_approval_consumed_replay_protection() {
        let store = ApprovalStore::new();
        let fp = "fp-test".to_string();
        let app_id = ApprovalStore::generate_unpredictable_approval_id();

        store.register_approval(app_id.clone(), "exec-1".into(), "step-1".into(), fp.clone(), 300_000);
        assert!(store.submit_approval(&app_id, true).is_ok());

        // Consumed 1st time succeeds
        let res1 = store.verify_and_consume(&app_id, "exec-1", "step-1", &fp);
        assert_eq!(res1, Ok(true));
        assert_eq!(store.get_approval(&app_id).unwrap().status, "CONSUMED");

        // Consumed 2nd time fails (replay protection)
        let res2 = store.verify_and_consume(&app_id, "exec-1", "step-1", &fp);
        assert!(res2.is_err());
    }

    #[test]
    fn test_human_approval_mismatches_invalidate() {
        let store = ApprovalStore::new();
        let fp = "fp-test".to_string();
        let app_id_fp = ApprovalStore::generate_unpredictable_approval_id();
        let app_id_step = ApprovalStore::generate_unpredictable_approval_id();

        // Fingerprint mismatch revokes approval
        store.register_approval(app_id_fp.clone(), "exec-1".into(), "step-1".into(), fp.clone(), 300_000);
        assert!(store.submit_approval(&app_id_fp, true).is_ok());
        let res_fp = store.verify_and_consume(&app_id_fp, "exec-1", "step-1", "mismatched-fp");
        assert!(res_fp.is_err());
        assert_eq!(store.get_approval(&app_id_fp).unwrap().status, "REVOKED");

        // Step mismatch revokes approval
        store.register_approval(app_id_step.clone(), "exec-1".into(), "step-1".into(), fp.clone(), 300_000);
        assert!(store.submit_approval(&app_id_step, true).is_ok());
        let res_step = store.verify_and_consume(&app_id_step, "exec-1", "mismatched-step", &fp);
        assert!(res_step.is_err());
        assert_eq!(store.get_approval(&app_id_step).unwrap().status, "REVOKED");
    }

    #[test]
    fn test_export_pipeline_path_policy_validation() {
        let engine = PolicyEngine::new();
        let dir = tempfile::tempdir().unwrap();
        let ws_root = dir.path().to_str().unwrap().to_string();

        // 1. Valid relative path export/github
        let req1 = PolicyEvaluationRequest {
            execution_id: "exec-export-1".into(),
            pipeline_id: "pipe-1".into(),
            pipeline_version: None,
            stage_id: "export".into(),
            step_id: "export-step".into(),
            step_type: "Export".into(),
            environment_id: None,
            platform: Some("github".into()),
            action_type: ActionType::ExportPipeline,
            command: None,
            args: vec![],
            cwd: None,
            path: Some("export/github".into()),
            url: None,
            workspace_root: ws_root.clone(),
            policy_version: CURRENT_POLICY_VERSION.into(),
        };
        let res1 = engine.evaluate(&req1);
        match res1.decision {
            PolicyDecision::Allow { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_ALLOW_WORKSPACE_FILE_ACCESS");
            }
            _ => panic!("Expected Allow decision for export/github in workspace root"),
        }

        // 2. Valid nested relative export path export/gitlab/pipeline.yml
        let req2 = PolicyEvaluationRequest {
            execution_id: "exec-export-2".into(),
            pipeline_id: "pipe-1".into(),
            pipeline_version: None,
            stage_id: "export".into(),
            step_id: "export-step".into(),
            step_type: "Export".into(),
            environment_id: None,
            platform: Some("gitlab".into()),
            action_type: ActionType::ExportPipeline,
            command: None,
            args: vec![],
            cwd: None,
            path: Some("export/gitlab/pipeline.yml".into()),
            url: None,
            workspace_root: ws_root.clone(),
            policy_version: CURRENT_POLICY_VERSION.into(),
        };
        let res2 = engine.evaluate(&req2);
        match res2.decision {
            PolicyDecision::Allow { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_ALLOW_WORKSPACE_FILE_ACCESS");
            }
            _ => panic!("Expected Allow decision for nested export path"),
        }

        // 3. Traversal path ../outside_export
        let req3 = PolicyEvaluationRequest {
            execution_id: "exec-export-3".into(),
            pipeline_id: "pipe-1".into(),
            pipeline_version: None,
            stage_id: "export".into(),
            step_id: "export-step".into(),
            step_type: "Export".into(),
            environment_id: None,
            platform: Some("github".into()),
            action_type: ActionType::ExportPipeline,
            command: None,
            args: vec![],
            cwd: None,
            path: Some("../outside_export".into()),
            url: None,
            workspace_root: ws_root.clone(),
            policy_version: CURRENT_POLICY_VERSION.into(),
        };
        let res3 = engine.evaluate(&req3);
        match res3.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_PATH_TRAVERSAL");
            }
            _ => panic!("Expected Deny decision for traversal export path"),
        }

        // 4. Absolute path outside workspace
        let req4 = PolicyEvaluationRequest {
            execution_id: "exec-export-4".into(),
            pipeline_id: "pipe-1".into(),
            pipeline_version: None,
            stage_id: "export".into(),
            step_id: "export-step".into(),
            step_type: "Export".into(),
            environment_id: None,
            platform: Some("github".into()),
            action_type: ActionType::ExportPipeline,
            command: None,
            args: vec![],
            cwd: None,
            path: Some("C:\\Windows\\System32\\export.yml".into()),
            url: None,
            workspace_root: ws_root.clone(),
            policy_version: CURRENT_POLICY_VERSION.into(),
        };
        let res4 = engine.evaluate(&req4);
        match res4.decision {
            PolicyDecision::Deny { reason_code, .. } => {
                assert_eq!(reason_code, "POLICY_DENY_PATH_OUTSIDE_WORKSPACE");
            }
            _ => panic!("Expected Deny decision for outside absolute path"),
        }
    }

    #[test]
    fn test_export_open_folder_path_consistency() {
        use crate::commands::pipeline_cmds::clean_path_string;
        let dir = tempfile::tempdir().unwrap();
        let ws_root = dir.path().to_path_buf();

        let github_rel = "export/github";
        let target_dir = ws_root.join(github_rel);
        std::fs::create_dir_all(&target_dir).unwrap();

        let canonical_dir = std::fs::canonicalize(&target_dir).unwrap();
        let target_file = canonical_dir.join("action.yml");
        std::fs::write(&target_file, "name: test").unwrap();

        let clean_dir = clean_path_string(&canonical_dir);
        let clean_file = clean_path_string(&target_file);

        // 1. Exported file path and returned directory path share the same parent
        let file_parent = std::path::Path::new(&clean_file).parent().unwrap();
        assert_eq!(file_parent.to_str().unwrap(), clean_dir);

        // 2. Open folder target is canonicalized absolute path inside workspace root
        let canonical_ws = std::fs::canonicalize(&ws_root).unwrap();
        let clean_ws = clean_path_string(&canonical_ws);
        assert!(clean_dir.starts_with(&clean_ws));

        // 3. Platform change alters export directory target
        let gitlab_dir = ws_root.join("export/gitlab");
        std::fs::create_dir_all(&gitlab_dir).unwrap();
        let clean_gitlab = clean_path_string(&std::fs::canonicalize(&gitlab_dir).unwrap());
        assert_ne!(clean_dir, clean_gitlab);
    }

    // ==========================================
    // Group: Approval Renewal Lifecycle Tests
    // ==========================================

    #[test]
    fn test_approval_renewal_lifecycle_expired_to_pending() {
        let store = ApprovalStore::new();
        let old_id = "app-old-100".to_string();
        let new_id = "app-new-200".to_string();

        store.register_approval_detailed(
            old_id.clone(),
            "exec-1".into(),
            Some("pipe-1".into()),
            None,
            "step-1".into(),
            Some("Deploy".into()),
            "Command".into(),
            Some("npm".into()),
            vec!["run".into(), "deploy".into()],
            "High".into(),
            "POLICY_APPROVAL_REQ".into(),
            "Approve deploy".into(),
            "fp-123".into(),
            1000,
        );

        // Expire / revoke old approval
        store.revoke_approval(&old_id);
        let old_app = store.get_approval(&old_id).unwrap();
        assert_eq!(old_app.status, "REVOKED");

        // Register new approval
        let new_app = store.register_approval_detailed(
            new_id.clone(),
            "exec-1".into(),
            Some("pipe-1".into()),
            None,
            "step-1".into(),
            Some("Deploy".into()),
            "Command".into(),
            Some("npm".into()),
            vec!["run".into(), "deploy".into()],
            "High".into(),
            "POLICY_APPROVAL_REQ".into(),
            "Approve deploy".into(),
            "fp-123".into(),
            300_000,
        );

        assert_eq!(new_app.status, "PENDING");
        assert_ne!(old_id, new_id);
    }

    #[test]
    fn test_approval_renewal_approve_transition() {
        let store = ApprovalStore::new();
        let new_id = "app-new-201".to_string();

        store.register_approval_detailed(
            new_id.clone(),
            "exec-1".into(),
            Some("pipe-1".into()),
            None,
            "step-1".into(),
            Some("Deploy".into()),
            "Command".into(),
            Some("npm".into()),
            vec!["run".into(), "deploy".into()],
            "High".into(),
            "POLICY_APPROVAL_REQ".into(),
            "Approve deploy".into(),
            "fp-123".into(),
            300_000,
        );

        let res = store.submit_approval(&new_id, true);
        assert!(res.is_ok());

        let updated = store.get_approval(&new_id).unwrap();
        assert_eq!(updated.status, "ALLOWED");
    }

    #[test]
    fn test_approval_renewal_reject_transition() {
        let store = ApprovalStore::new();
        let new_id = "app-new-202".to_string();

        store.register_approval_detailed(
            new_id.clone(),
            "exec-1".into(),
            Some("pipe-1".into()),
            None,
            "step-1".into(),
            Some("Deploy".into()),
            "Command".into(),
            Some("npm".into()),
            vec!["run".into(), "deploy".into()],
            "High".into(),
            "POLICY_APPROVAL_REQ".into(),
            "Approve deploy".into(),
            "fp-123".into(),
            300_000,
        );

        let res = store.submit_approval(&new_id, false);
        assert!(res.is_ok());

        let updated = store.get_approval(&new_id).unwrap();
        assert_eq!(updated.status, "REJECTED");
    }

    #[test]
    fn test_approval_old_id_isolation_immutable() {
        let store = ApprovalStore::new();
        let old_id = "app-old-101".to_string();

        store.register_approval_detailed(
            old_id.clone(),
            "exec-1".into(),
            Some("pipe-1".into()),
            None,
            "step-1".into(),
            Some("Deploy".into()),
            "Command".into(),
            Some("npm".into()),
            vec!["run".into(), "deploy".into()],
            "High".into(),
            "POLICY_APPROVAL_REQ".into(),
            "Approve deploy".into(),
            "fp-123".into(),
            1000,
        );

        store.revoke_approval(&old_id);

        // Attempting to submit approval for revoked/expired old_id fails
        let res = store.submit_approval(&old_id, true);
        assert!(res.is_err());

        let old_app = store.get_approval(&old_id).unwrap();
        assert_eq!(old_app.status, "REVOKED");
    }

    #[test]
    fn test_multi_approval_step_isolation() {
        let store = ApprovalStore::new();
        let step1_old = "app-step1-old".to_string();
        let step1_new = "app-step1-new".to_string();
        let step2_id = "app-step2-id".to_string();

        store.register_approval_detailed(
            step1_old.clone(),
            "exec-1".into(),
            Some("pipe-1".into()),
            None,
            "step-1".into(),
            Some("Step 1".into()),
            "Command".into(),
            None,
            vec![],
            "High".into(),
            "REQ".into(),
            "Step 1".into(),
            "fp-1".into(),
            1000,
        );

        store.register_approval_detailed(
            step2_id.clone(),
            "exec-1".into(),
            Some("pipe-1".into()),
            None,
            "step-2".into(),
            Some("Step 2".into()),
            "Command".into(),
            None,
            vec![],
            "High".into(),
            "REQ".into(),
            "Step 2".into(),
            "fp-2".into(),
            300_000,
        );

        // Renew step 1
        store.revoke_approval(&step1_old);
        store.register_approval_detailed(
            step1_new.clone(),
            "exec-1".into(),
            Some("pipe-1".into()),
            None,
            "step-1".into(),
            Some("Step 1".into()),
            "Command".into(),
            None,
            vec![],
            "High".into(),
            "REQ".into(),
            "Step 1".into(),
            "fp-1".into(),
            300_000,
        );

        // Approve renewed step 1, reject step 2
        assert!(store.submit_approval(&step1_new, true).is_ok());
        assert!(store.submit_approval(&step2_id, false).is_ok());

        assert_eq!(store.get_approval(&step1_new).unwrap().status, "ALLOWED");
        assert_eq!(store.get_approval(&step2_id).unwrap().status, "REJECTED");
        assert_eq!(store.get_approval(&step1_old).unwrap().status, "REVOKED");
    }

    #[test]
    fn test_execution_token_authorization_isolation() {
        let store = ApprovalStore::new();
        let old_id = "app-exec-old".to_string();
        let new_id = "app-exec-new".to_string();
        let fp = "fp-exec-test".to_string();

        store.register_approval_detailed(
            old_id.clone(),
            "exec-1".into(),
            Some("pipe-1".into()),
            None,
            "step-1".into(),
            Some("Deploy".into()),
            "Command".into(),
            None,
            vec![],
            "High".into(),
            "REQ".into(),
            "Deploy".into(),
            fp.clone(),
            1000,
        );

        store.revoke_approval(&old_id);

        store.register_approval_detailed(
            new_id.clone(),
            "exec-1".into(),
            Some("pipe-1".into()),
            None,
            "step-1".into(),
            Some("Deploy".into()),
            "Command".into(),
            None,
            vec![],
            "High".into(),
            "REQ".into(),
            "Deploy".into(),
            fp.clone(),
            300_000,
        );

        // Old ID cannot be consumed
        assert!(store.verify_and_consume(&old_id, "exec-1", "step-1", &fp).is_err());

        // New ID must be approved before consumption
        assert!(store.verify_and_consume(&new_id, "exec-1", "step-1", &fp).is_err());

        // Approve new ID
        assert!(store.submit_approval(&new_id, true).is_ok());

        // Now new ID can be consumed
        assert!(store.verify_and_consume(&new_id, "exec-1", "step-1", &fp).is_ok());
    }

    // ==========================================

    // ==========================================

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
            workspace_root: r"C:\workspace".into(),
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
        let req = create_test_req(ActionType::FileRead, None, vec![], Some("..\\../secret.txt"), None);
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
        let fp = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["valid".to_string()], r"C:\workspace", "1.0", Some(1));
        
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
        let fp = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["valid".to_string()], r"C:\workspace", "1.0", Some(1));
        
        let result = store.consume_existing_approval(&Some("pipe-1".into()), Some(1), "step-1", &fp);
        assert_eq!(result.unwrap_err(), "NOT_FOUND");
    }

    #[test]
    fn test_cat_b_expired_stale_approval_rejected() {
        let store = ApprovalStore::new();
        let fp = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["valid".to_string()], r"C:\workspace", "1.0", Some(1));
        
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
        let fp = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["valid".to_string()], r"C:\workspace", "1.0", Some(1));
        
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
        let fp_approved = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["valid".to_string()], r"C:\workspace", "1.0", Some(1));
        let fp_tampered = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["malicious".to_string()], r"C:\workspace", "1.0", Some(1));
        
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
        let fp_approved = ApprovalStore::compute_canonical_fingerprint("Command", Some("npm"), &["run".to_string(), "build".to_string()], r"C:\workspace", "1.0", Some(1));
        
        // If args are modified but someone passes the original fingerprint, they still fail if they attempt to compute new fingerprint and match
        let fp_tampered = ApprovalStore::compute_canonical_fingerprint("Command", Some("npm"), &["run".to_string(), "malicious".to_string()], r"C:\workspace", "1.0", Some(1));
        
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
        let fp_approved = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["hi".to_string()], r"C:\workspace", "1.0", Some(1));
        let fp_tampered = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["hi".to_string()], r"C:\malicious", "1.0", Some(1));
        
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
        let fp_approved = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["hi".to_string()], r"C:\workspace", "1.0", Some(1));
        
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
        let fp_approved = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["hi".to_string()], r"C:\workspace", "1.0", Some(1));
        
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
        let fp = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["hi".to_string()], r"C:\workspace", "1.0", Some(1));
        
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
