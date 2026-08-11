use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use crate::ai::models::{AIProviderConfig, AIProviderStatus, CreateAIProviderInput, UpdateAIProviderInput};
use crate::error::DesktopError;

pub struct MetadataStore {
    file_path: PathBuf,
    providers: Mutex<Vec<AIProviderConfig>>,
}

impl MetadataStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let file_path = app_data_dir.join("ai_providers.json");
        let store = Self {
            file_path,
            providers: Mutex::new(Vec::new()),
        };
        let _ = store.load();
        store
    }

    fn now_secs() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    }

    fn load(&self) -> Result<(), DesktopError> {
        if !self.file_path.exists() {
            return Ok(());
        }
        let content = fs::read_to_string(&self.file_path).map_err(|e| DesktopError {
            kind: "IOError".into(),
            message: e.to_string(),
        })?;

        let list: Vec<AIProviderConfig> = serde_json::from_str(&content).map_err(|e| DesktopError {
            kind: "ParseError".into(),
            message: e.to_string(),
        })?;

        let mut providers = self.providers.lock().unwrap();
        *providers = list;
        Ok(())
    }

    fn persist(&self) -> Result<(), DesktopError> {
        let providers = self.providers.lock().unwrap();
        let content = serde_json::to_string_pretty(&*providers).map_err(|e| DesktopError {
            kind: "SerializeError".into(),
            message: e.to_string(),
        })?;

        if let Some(parent) = self.file_path.parent() {
            if !parent.exists() {
                let _ = fs::create_dir_all(parent);
            }
        }

        fs::write(&self.file_path, content).map_err(|e| DesktopError {
            kind: "IOError".into(),
            message: e.to_string(),
        })
    }

    pub fn list(&self) -> Vec<AIProviderConfig> {
        let providers = self.providers.lock().unwrap();
        providers.clone()
    }

    pub fn get(&self, id: &str) -> Option<AIProviderConfig> {
        let providers = self.providers.lock().unwrap();
        providers.iter().find(|p| p.id == id).cloned()
    }

    pub fn create(&self, input: CreateAIProviderInput) -> Result<AIProviderConfig, DesktopError> {
        let now = Self::now_secs();
        let id = format!("provider_{}", now);

        let is_default = input.is_default.unwrap_or(false);

        let config = AIProviderConfig {
            id: id.clone(),
            name: input.name,
            provider_type: input.provider_type,
            model: input.model,
            base_url: input.base_url,
            enabled: true,
            is_default,
            status: AIProviderStatus::Untested,
            created_at: now,
            updated_at: now,
            last_error: None,
        };

        {
            let mut providers = self.providers.lock().unwrap();
            if is_default || providers.is_empty() {
                for p in providers.iter_mut() {
                    p.is_default = false;
                }
            }
            let mut new_config = config.clone();
            if providers.is_empty() {
                new_config.is_default = true;
            }
            providers.push(new_config.clone());
        }

        self.persist()?;
        Ok(self.get(&id).unwrap_or(config))
    }

    pub fn update(&self, input: UpdateAIProviderInput) -> Result<AIProviderConfig, DesktopError> {
        let now = Self::now_secs();
        let updated_config: AIProviderConfig;

        {
            let mut providers = self.providers.lock().unwrap();
            let target_idx = providers.iter().position(|p| p.id == input.id).ok_or_else(|| DesktopError {
                kind: "NotFound".into(),
                message: format!("AI Provider with ID '{}' not found", input.id),
            })?;

            if let Some(true) = input.is_default {
                for p in providers.iter_mut() {
                    p.is_default = false;
                }
            }

            let provider = &mut providers[target_idx];
            if let Some(name) = input.name { provider.name = name; }
            if let Some(provider_type) = input.provider_type { provider.provider_type = provider_type; }
            if let Some(model) = input.model { provider.model = model; }
            if let Some(base_url) = input.base_url { provider.base_url = base_url; }
            if let Some(enabled) = input.enabled { provider.enabled = enabled; }
            if let Some(is_default) = input.is_default { provider.is_default = is_default; }
            provider.updated_at = now;

            updated_config = provider.clone();
        }

        self.persist()?;
        Ok(updated_config)
    }

    pub fn delete(&self, id: &str) -> Result<(), DesktopError> {
        let mut was_default = false;
        {
            let mut providers = self.providers.lock().unwrap();
            if let Some(pos) = providers.iter().position(|p| p.id == id) {
                was_default = providers[pos].is_default;
                providers.remove(pos);
            }
            if was_default && !providers.is_empty() {
                providers[0].is_default = true;
            }
        }
        self.persist()
    }

    pub fn set_default(&self, id: &str) -> Result<AIProviderConfig, DesktopError> {
        let mut updated: Option<AIProviderConfig> = None;
        {
            let mut providers = self.providers.lock().unwrap();
            let exists = providers.iter().any(|p| p.id == id);
            if !exists {
                return Err(DesktopError {
                    kind: "NotFound".into(),
                    message: format!("AI Provider '{}' not found", id),
                });
            }

            for p in providers.iter_mut() {
                if p.id == id {
                    p.is_default = true;
                    updated = Some(p.clone());
                } else {
                    p.is_default = false;
                }
            }
        }
        self.persist()?;
        Ok(updated.unwrap())
    }

    pub fn update_status(&self, id: &str, status: AIProviderStatus, error_msg: Option<String>) -> Result<(), DesktopError> {
        {
            let mut providers = self.providers.lock().unwrap();
            if let Some(p) = providers.iter_mut().find(|p| p.id == id) {
                p.status = status;
                p.last_error = error_msg;
                p.updated_at = Self::now_secs();
            }
        }
        self.persist()
    }
}
