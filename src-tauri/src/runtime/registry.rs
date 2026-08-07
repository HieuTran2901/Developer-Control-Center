use super::model::ProcessModel;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

pub struct RuntimeRegistry {
    processes: RwLock<HashMap<String, ProcessModel>>,
}

impl RuntimeRegistry {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            processes: RwLock::new(HashMap::new()),
        })
    }

    pub fn add(&self, process: ProcessModel) {
        if let Ok(mut map) = self.processes.write() {
            map.insert(process.id.clone(), process);
        }
    }

    pub fn remove(&self, id: &str) {
        if let Ok(mut map) = self.processes.write() {
            map.remove(id);
        }
    }

    pub fn find_by_id(&self, id: &str) -> Option<ProcessModel> {
        if let Ok(map) = self.processes.read() {
            map.get(id).cloned()
        } else {
            None
        }
    }

    pub fn get_all(&self) -> Vec<ProcessModel> {
        if let Ok(map) = self.processes.read() {
            map.values().cloned().collect()
        } else {
            Vec::new()
        }
    }
}
