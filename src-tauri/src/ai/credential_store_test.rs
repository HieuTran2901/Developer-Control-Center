#[cfg(test)]
mod tests {
    use crate::ai::credential_store::{
        CredentialStoreTrait, LegacyXorMigrator, MockCredentialStore,
    };
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_mock_credential_store_crud() {
        let store = MockCredentialStore::new();
        let provider_id = "openai_test_1";

        assert!(!store.exists(provider_id));
        assert_eq!(store.get_secret(provider_id).unwrap(), None);

        // Save secret
        store.save_secret(provider_id, "sk-test-key-12345").unwrap();
        assert!(store.exists(provider_id));
        assert_eq!(
            store.get_secret(provider_id).unwrap(),
            Some("sk-test-key-12345".to_string())
        );

        // Delete secret
        store.delete_secret(provider_id).unwrap();
        assert!(!store.exists(provider_id));
        assert_eq!(store.get_secret(provider_id).unwrap(), None);
    }

    #[test]
    fn test_provider_isolation() {
        let store = MockCredentialStore::new();

        store.save_secret("openai_1", "key-1").unwrap();
        store.save_secret("anthropic_1", "key-2").unwrap();

        assert_eq!(store.get_secret("openai_1").unwrap(), Some("key-1".into()));
        assert_eq!(store.get_secret("anthropic_1").unwrap(), Some("key-2".into()));

        store.delete_secret("openai_1").unwrap();
        assert_eq!(store.get_secret("openai_1").unwrap(), None);
        assert_eq!(store.get_secret("anthropic_1").unwrap(), Some("key-2".into()));
    }

    #[test]
    fn test_legacy_xor_migration_and_cleanup() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let sec_dir = app_data_dir.join("security");
        fs::create_dir_all(&sec_dir).unwrap();

        // Construct legacy obfuscated file
        // XOR helper matching LegacyXorMigrator
        fn obfuscate(data: &str) -> String {
            let key: &[u8] = b"DEVCTRL_SECURE_SALT_KEY_2026";
            let bytes = data.as_bytes();
            let mut obfuscated = Vec::with_capacity(bytes.len());
            for (i, &b) in bytes.iter().enumerate() {
                obfuscated.push(b ^ key[i % key.len()]);
            }
            use std::fmt::Write;
            let mut hex = String::with_capacity(obfuscated.len() * 2);
            for b in obfuscated {
                let _ = write!(hex, "{:02x}", b);
            }
            hex
        }

        let legacy_file = sec_dir.join("ai_credentials.dat");
        let legacy_content = format!(
            "provider_1:{}\nprovider_2:{}\n",
            obfuscate("sk-legacy-key-1"),
            obfuscate("sk-legacy-key-2")
        );
        fs::write(&legacy_file, legacy_content).unwrap();

        let store = MockCredentialStore::new();

        // Run migration
        let migrated = LegacyXorMigrator::migrate(&app_data_dir, &store).unwrap();
        assert!(migrated);

        // Verify secrets in target store
        assert_eq!(store.get_secret("provider_1").unwrap(), Some("sk-legacy-key-1".into()));
        assert_eq!(store.get_secret("provider_2").unwrap(), Some("sk-legacy-key-2".into()));

        // Verify legacy file deleted & marker created
        assert!(!legacy_file.exists());
        assert!(sec_dir.join("migration.json").exists());

        // Second run should be idempotent (no-op)
        let retry_migrated = LegacyXorMigrator::migrate(&app_data_dir, &store).unwrap();
        assert!(!retry_migrated);
    }
}
