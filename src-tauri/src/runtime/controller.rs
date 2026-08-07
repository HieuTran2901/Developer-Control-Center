use super::manager::ProcessManager;
use crate::error::DesktopError;
use std::sync::Arc;

pub struct ProcessController {
    pub manager: Arc<ProcessManager>,
}

impl ProcessController {
    pub fn new(manager: Arc<ProcessManager>) -> Self {
        Self { manager }
    }

    pub async fn start(
        &self,
        project_id: String,
        profile_id: String,
        command: String,
        cwd: String,
    ) -> Result<(), DesktopError> {
        self.manager.start(project_id, profile_id, command, cwd).await
    }

    pub async fn stop(&self, project_id: String, profile_id: String) -> Result<(), DesktopError> {
        self.manager.stop(project_id, profile_id).await
    }

    pub async fn force_stop(
        &self,
        project_id: String,
        profile_id: String,
    ) -> Result<(), DesktopError> {
        self.manager.force_stop(project_id, profile_id).await
    }

    pub async fn restart(
        &self,
        project_id: String,
        profile_id: String,
        command: String,
        cwd: String,
    ) -> Result<(), DesktopError> {
        self.manager.restart(project_id, profile_id, command, cwd).await
    }
}
