use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use keyring::Entry;
use serde::{Deserialize, Serialize};

use crate::error::DesktopError;

pub const SERVICE_NAME: &str = "developer-control-center:ai-provider";

pub trait CredentialStoreTrait: Send + Sync {
    fn save_secret(&self, provider_id: &str, secret: &str) -> Result<(), DesktopError>;
    fn get_secret(&self, provider_id: &str) -> Result<Option<String>, DesktopError>;
    fn delete_secret(&self, provider_id: &str) -> Result<(), DesktopError>;
    fn exists(&self, provider_id: &str) -> bool;
}

pub struct OsCredentialStore;

impl OsCredentialStore {
    pub fn new() -> Self {
        Self
    }
}

impl CredentialStoreTrait for OsCredentialStore {
    fn save_secret(&self, provider_id: &str, secret: &str) -> Result<(), DesktopError> {
        let entry = Entry::new(SERVICE_NAME, provider_id).map_err(|e| DesktopError {
            kind: "CredentialStoreError".into(),
            message: format!("Failed to create keyring entry: {}", e),
        })?;

        entry.set_password(secret).map_err(|e| DesktopError {
            kind: "CredentialSaveFailed".into(),
            message: format!("Failed to save credential to OS Keyring: {}", e),
        })
    }

    fn get_secret(&self, provider_id: &str) -> Result<Option<String>, DesktopError> {
        let entry = Entry::new(SERVICE_NAME, provider_id).map_err(|e| DesktopError {
            kind: "CredentialStoreError".into(),
            message: format!("Failed to create keyring entry: {}", e),
        })?;

        match entry.get_password() {
            Ok(pass) => Ok(Some(pass)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(DesktopError {
                kind: "CredentialAccessDenied".into(),
                message: format!("Failed to read credential from OS Keyring: {}", e),
            }),
        }
    }

    fn delete_secret(&self, provider_id: &str) -> Result<(), DesktopError> {
        let entry = Entry::new(SERVICE_NAME, provider_id).map_err(|e| DesktopError {
            kind: "CredentialStoreError".into(),
            message: format!("Failed to create keyring entry: {}", e),
        })?;

        match entry.delete_password() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(DesktopError {
                kind: "CredentialDeleteFailed".into(),
                message: format!("Failed to delete credential from OS Keyring: {}", e),
            }),
        }
    }

    fn exists(&self, provider_id: &str) -> bool {
        match self.get_secret(provider_id) {
            Ok(Some(s)) => !s.is_empty(),
            _ => false,
        }
    }
}

pub struct MockCredentialStore {
    cache: Mutex<HashMap<String, String>>,
}

impl MockCredentialStore {
    pub fn new() -> Self {
        Self {
            cache: Mutex::new(HashMap::new()),
        }
    }
}

impl CredentialStoreTrait for MockCredentialStore {
    fn save_secret(&self, provider_id: &str, secret: &str) -> Result<(), DesktopError> {
        let mut cache = self.cache.lock().unwrap();
        cache.insert(provider_id.to_string(), secret.to_string());
        Ok(())
    }

    fn get_secret(&self, provider_id: &str) -> Result<Option<String>, DesktopError> {
        let cache = self.cache.lock().unwrap();
        Ok(cache.get(provider_id).cloned())
    }

    fn delete_secret(&self, provider_id: &str) -> Result<(), DesktopError> {
        let mut cache = self.cache.lock().unwrap();
        cache.remove(provider_id);
        Ok(())
    }

    fn exists(&self, provider_id: &str) -> bool {
        let cache = self.cache.lock().unwrap();
        cache.contains_key(provider_id)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MigrationMarker {
    pub credential_storage_version: u32,
    pub migrated_at: u64,
}

pub struct LegacyXorMigrator;

impl LegacyXorMigrator {
    fn deobfuscate(hex: &str) -> Result<String, DesktopError> {
        let key: &[u8] = b"DEVCTRL_SECURE_SALT_KEY_2026";
        if hex.len() % 2 != 0 {
            return Err(DesktopError {
                kind: "CredentialError".into(),
                message: "Invalid credential encoding".into(),
            });
        }
        let mut bytes = Vec::with_capacity(hex.len() / 2);
        for i in (0..hex.len()).step_by(2) {
            let b = u8::from_str_radix(&hex[i..i + 2], 16).map_err(|e| DesktopError {
                kind: "CredentialError".into(),
                message: e.to_string(),
            })?;
            bytes.push(b);
        }
        let mut deobfuscated = Vec::with_capacity(bytes.len());
        for (i, &b) in bytes.iter().enumerate() {
            deobfuscated.push(b ^ key[i % key.len()]);
        }
        String::from_utf8(deobfuscated).map_err(|e| DesktopError {
            kind: "CredentialError".into(),
            message: e.to_string(),
        })
    }

    pub fn migrate<S: CredentialStoreTrait + ?Sized>(
        app_data_dir: &PathBuf,
        target_store: &S,
    ) -> Result<bool, DesktopError> {
        let sec_dir = app_data_dir.join("security");
        let legacy_file = sec_dir.join("ai_credentials.dat");
        let marker_file = sec_dir.join("migration.json");

        if marker_file.exists() && !legacy_file.exists() {
            return Ok(false); // Already migrated
        }

        if !legacy_file.exists() {
            return Ok(false);
        }

        let content = fs::read_to_string(&legacy_file).map_err(|e| DesktopError {
            kind: "IOError".into(),
            message: e.to_string(),
        })?;

        let mut migrated_count = 0;

        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let parts: Vec<&str> = line.splitn(2, ':').collect();
            if parts.len() == 2 {
                let id = parts[0];
                if let Ok(secret) = Self::deobfuscate(parts[1]) {
                    if !secret.is_empty() {
                        target_store.save_secret(id, &secret)?;
                        // Verify write success
                        let read_back = target_store.get_secret(id)?;
                        if read_back.as_deref() == Some(&secret) {
                            migrated_count += 1;
                        } else {
                            return Err(DesktopError {
                                kind: "MigrationFailed".into(),
                                message: format!("Verification failed for migrated key '{}'", id),
                            });
                        }
                    }
                }
            }
        }

        // Write migration marker ONLY after 100% verified write
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let marker = MigrationMarker {
            credential_storage_version: 2,
            migrated_at: now,
        };
        let marker_json = serde_json::to_string_pretty(&marker).map_err(|e| DesktopError {
            kind: "SerializeError".into(),
            message: e.to_string(),
        })?;

        if !sec_dir.exists() {
            let _ = fs::create_dir_all(&sec_dir);
        }
        fs::write(&marker_file, marker_json).map_err(|e| DesktopError {
            kind: "IOError".into(),
            message: e.to_string(),
        })?;

        // Safely remove legacy XOR file AFTER marker is persisted
        let _ = fs::remove_file(&legacy_file);

        Ok(migrated_count > 0)
    }
}
