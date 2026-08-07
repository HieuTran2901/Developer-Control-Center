use crate::error::DesktopError;
use tokio::process::Command;

#[cfg(target_os = "windows")]
pub async fn force_kill_process_tree(pid: u32) -> Result<(), DesktopError> {
    // taskkill /PID <pid> /T /F
    let output = Command::new("taskkill")
        .args(&["/PID", &pid.to_string(), "/T", "/F"])
        .output()
        .await
        .map_err(|e| DesktopError {
            kind: "KillFailed".into(),
            message: e.to_string(),
        })?;
    if !output.status.success() {
        return Err(DesktopError {
            kind: "KillFailed".into(),
            message: String::from_utf8_lossy(&output.stderr).to_string(),
        });
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub async fn force_kill_process_tree(pid: u32) -> Result<(), DesktopError> {
    // For Unix systems, kill the process tree
    let _ = Command::new("pkill")
        .args(&["-9", "-P", &pid.to_string()])
        .output()
        .await;

    let output = Command::new("kill")
        .args(&["-9", &pid.to_string()])
        .output()
        .await
        .map_err(|e| DesktopError {
            kind: "KillFailed".into(),
            message: e.to_string(),
        })?;

    if !output.status.success() {
        return Err(DesktopError {
            kind: "KillFailed".into(),
            message: String::from_utf8_lossy(&output.stderr).to_string(),
        });
    }
    Ok(())
}
