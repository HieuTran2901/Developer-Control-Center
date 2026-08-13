pub mod domain;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use crate::error::DesktopError;
use domain::ProjectCIConfig;

pub struct ConfigStore {
    file_path: PathBuf,
    config: Arc<Mutex<ProjectCIConfig>>,
}

impl ConfigStore {
    pub fn new(app_data_dir: &Path) -> Result<Self, DesktopError> {
        let dcc_dir = app_data_dir.parent().unwrap_or(app_data_dir).join("E:/Github project/Developer-Control-Center/.dcc");
        if !dcc_dir.exists() {
            fs::create_dir_all(&dcc_dir).map_err(|e| DesktopError {
                kind: "IoError".into(),
                message: e.to_string(),
            })?;
        }

        let file_path = dcc_dir.join("project_ci_config.json");
        
        let config = if file_path.exists() {
            let data = fs::read_to_string(&file_path).map_err(|e| DesktopError {
                kind: "IoError".into(),
                message: e.to_string(),
            })?;
            serde_json::from_str(&data).unwrap_or_else(|_| ProjectCIConfig { environments: vec![] })
        } else {
            ProjectCIConfig { environments: vec![] }
        };

        Ok(Self {
            file_path,
            config: Arc::new(Mutex::new(config)),
        })
    }

    pub fn get_config(&self) -> ProjectCIConfig {
        self.config.lock().unwrap().clone()
    }

    pub fn save_config(&self, config: ProjectCIConfig) -> Result<(), DesktopError> {
        let data = serde_json::to_string_pretty(&config).map_err(|e| DesktopError {
            kind: "SerializeError".into(),
            message: e.to_string(),
        })?;
        
        fs::write(&self.file_path, data).map_err(|e| DesktopError {
            kind: "IoError".into(),
            message: e.to_string(),
        })?;
        
        *self.config.lock().unwrap() = config;
        
        Ok(())
    }
}
