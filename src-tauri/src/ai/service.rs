use std::path::PathBuf;
use std::sync::Arc;
use crate::ai::credential_store::{CredentialStoreTrait, LegacyXorMigrator, OsCredentialStore};
use crate::ai::metadata_store::MetadataStore;
use crate::ai::models::{AIProviderConfig, AIProviderStatus, CreateAIProviderInput, UpdateAIProviderInput};
use crate::error::DesktopError;

pub struct AIProviderService {
    app_data_dir: PathBuf,
    metadata_store: MetadataStore,
    credential_store: Arc<dyn CredentialStoreTrait>,
}

impl AIProviderService {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let credential_store = Arc::new(OsCredentialStore::new());
        // Run safe legacy XOR migration on startup if legacy credential file exists
        let _ = LegacyXorMigrator::migrate(&app_data_dir, credential_store.as_ref());

        Self {
            app_data_dir: app_data_dir.clone(),
            metadata_store: MetadataStore::new(app_data_dir),
            credential_store,
        }
    }

    pub fn with_store(app_data_dir: PathBuf, credential_store: Arc<dyn CredentialStoreTrait>) -> Self {
        let _ = LegacyXorMigrator::migrate(&app_data_dir, credential_store.as_ref());

        Self {
            app_data_dir: app_data_dir.clone(),
            metadata_store: MetadataStore::new(app_data_dir),
            credential_store,
        }
    }

    pub fn list(&self) -> Vec<AIProviderConfig> {
        self.metadata_store.list()
    }

    pub fn create(&self, input: CreateAIProviderInput) -> Result<AIProviderConfig, DesktopError> {
        let secret = input.secret_key.clone();
        let config = self.metadata_store.create(input)?;
        if let Some(sec) = secret {
            if !sec.trim().is_empty() {
                let _ = self.credential_store.save_secret(&config.id, &sec);
            }
        }
        Ok(config)
    }

    pub fn update(&self, input: UpdateAIProviderInput) -> Result<AIProviderConfig, DesktopError> {
        let secret = input.secret_key.clone();
        let config = self.metadata_store.update(input)?;
        if let Some(sec) = secret {
            if !sec.trim().is_empty() && sec != "••••••••" {
                let _ = self.credential_store.save_secret(&config.id, &sec);
            }
        }
        Ok(config)
    }

    pub fn delete(&self, id: &str) -> Result<(), DesktopError> {
        self.metadata_store.delete(id)?;
        let _ = self.credential_store.delete_secret(id);
        Ok(())
    }

    pub fn set_default(&self, id: &str) -> Result<AIProviderConfig, DesktopError> {
        self.metadata_store.set_default(id)
    }

    pub async fn test_connection(&self, id: &str) -> Result<AIProviderConfig, DesktopError> {
        let _provider = self.metadata_store.get(id).ok_or_else(|| DesktopError {
            kind: "NotFound".into(),
            message: format!("AI Provider '{}' not found", id),
        })?;

        let _ = self.metadata_store.update_status(id, AIProviderStatus::Testing, None);

        let gateway = crate::ai::gateway::AIGateway::with_stores(
            self.app_data_dir.clone(),
            self.credential_store.clone(),
        );

        let request = crate::ai::gateway::models::AIRequest {
            provider_id: id.to_string(),
            model: None,
            messages: vec![crate::ai::gateway::models::AIMessage {
                role: crate::ai::gateway::models::AIRole::User,
                content: "Test connection. Reply 'OK'.".into(),
            }],
            options: None,
        };

        let test_result = gateway.send_request(request).await;

        match test_result {
            Ok(_) => {
                let _ = self.metadata_store.update_status(id, AIProviderStatus::Connected, None);
            }
            Err(ref err) => {
                let _ = self.metadata_store.update_status(
                    id,
                    AIProviderStatus::Failed,
                    Some(err.to_string()),
                );
            }
        }

        self.metadata_store.get(id).ok_or_else(|| DesktopError {
            kind: "NotFound".into(),
            message: format!("AI Provider '{}' not found", id),
        })
    }
}
