use std::path::{Path, PathBuf};
use std::fs;
use std::sync::RwLock;
use crate::deployment::domain::DeploymentRecord;

pub struct DeploymentStore {
    path: PathBuf,
    cache: RwLock<Vec<DeploymentRecord>>,
}

impl DeploymentStore {
    pub fn new(app_data_dir: &Path) -> Result<Self, String> {
        let dcc_dir = app_data_dir.join(".dcc");
        if !dcc_dir.exists() {
            fs::create_dir_all(&dcc_dir).map_err(|e| e.to_string())?;
        }
        
        let path = dcc_dir.join("deployment_history.json");
        let cache = if path.exists() {
            let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            serde_json::from_str(&data).unwrap_or_else(|_| vec![])
        } else {
            vec![]
        };
        
        Ok(Self {
            path,
            cache: RwLock::new(cache),
        })
    }
    
    pub fn save(&self, record: DeploymentRecord) -> Result<(), String> {
        let mut cache = self.cache.write().map_err(|_| "Failed to lock cache")?;
        
        // Update if exists, else push
        if let Some(pos) = cache.iter().position(|r| r.deployment_id == record.deployment_id) {
            cache[pos] = record;
        } else {
            cache.push(record);
        }
        
        // Limit history to 100 for bounding
        let len = cache.len();
        if len > 100 {
            cache.drain(0..(len - 100));
        }
        
        let json = serde_json::to_string_pretty(&*cache).map_err(|e| e.to_string())?;
        fs::write(&self.path, json).map_err(|e| e.to_string())?;
        
        Ok(())
    }
    
    pub fn get_all(&self) -> Result<Vec<DeploymentRecord>, String> {
        let cache = self.cache.read().map_err(|_| "Failed to lock cache")?;
        Ok(cache.clone())
    }
    
    pub fn get(&self, deployment_id: &str) -> Result<Option<DeploymentRecord>, String> {
        let cache = self.cache.read().map_err(|_| "Failed to lock cache")?;
        Ok(cache.iter().find(|r| r.deployment_id == deployment_id).cloned())
    }
}
