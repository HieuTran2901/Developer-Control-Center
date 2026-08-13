import os

path = r'E:\Github project\Developer-Control-Center\src-tauri\src\policy\tests.rs'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find('// Group J: Approval & Binding Validation (Category B)')
if start_idx != -1:
    content = content[:start_idx]

tests = """    // Group J: Approval & Binding Validation (Category B)
    #[test]
    fn test_phase7_cat_b_01_version_mismatch() {
        let mut store = ApprovalStore::new();
        let fp = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["hello".to_string()], r"E:\\Github project\\Developer-Control-Center", "1.0", Some(1));
        
        let _ = store.register_approval_detailed(
            "app-1".into(),
            "exec-1".into(),
            Some("pipe-1".into()),
            Some(1),
            "step-1".into(),
            Some("step1".into()),
            "Command".into(),
            Some("echo".into()),
            vec!["hello".into()],
            "Low".into(),
            "OK".into(),
            "echo hello".into(),
            fp.clone(),
            3600
        );
        
        assert_eq!(store.consume_existing_approval(&Some("pipe-1".into()), Some(2), "step-1", &fp).unwrap_err(), "VERSION_MISMATCH");
    }
    
    #[test]
    fn test_phase7_cat_b_02_fingerprint_mismatch() {
        let mut store = ApprovalStore::new();
        let fp1 = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["hello".to_string()], r"E:\\Github project\\Developer-Control-Center", "1.0", Some(1));
        let fp2 = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["world".to_string()], r"E:\\Github project\\Developer-Control-Center", "1.0", Some(1));
        
        let _ = store.register_approval_detailed(
            "app-2".into(),
            "exec-1".into(),
            Some("pipe-1".into()),
            Some(1),
            "step-1".into(),
            Some("step1".into()),
            "Command".into(),
            Some("echo".into()),
            vec!["hello".into()],
            "Low".into(),
            "OK".into(),
            "echo hello".into(),
            fp1.clone(),
            3600
        );
        
        assert_eq!(store.consume_existing_approval(&Some("pipe-1".into()), Some(1), "step-1", &fp2).unwrap_err(), "FINGERPRINT_MISMATCH");
    }

    #[test]
    fn test_phase7_cat_b_03_missing_version() {
        let mut store = ApprovalStore::new();
        let fp = ApprovalStore::compute_canonical_fingerprint("Command", Some("echo"), &["hello".to_string()], r"E:\\Github project\\Developer-Control-Center", "1.0", None);
        
        let _ = store.register_approval_detailed(
            "app-3".into(),
            "exec-1".into(),
            Some("pipe-1".into()),
            None,
            "step-1".into(),
            Some("step1".into()),
            "Command".into(),
            Some("echo".into()),
            vec!["hello".into()],
            "Low".into(),
            "OK".into(),
            "echo hello".into(),
            fp.clone(),
            3600
        );
        
        assert_eq!(store.consume_existing_approval(&Some("pipe-1".into()), Some(1), "step-1", &fp).unwrap_err(), "VERSION_MISMATCH");
    }
}
"""

content = content + tests

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Tests rewritten successfully")
