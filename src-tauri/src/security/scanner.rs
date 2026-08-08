use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use crate::security::domain::{SecurityCategory, SecurityFinding};

pub trait SecurityScanner: Send + Sync {
    /// Returns the unique ID of the scanner.
    fn scanner_id(&self) -> &'static str;

    /// Returns the categories this scanner can detect.
    fn supported_categories(&self) -> Vec<SecurityCategory>;

    /// Scans a file or directory. 
    /// The `path` provided is guaranteed to be within the project root.
    /// The scanner should check `cancel_token` periodically if doing heavy work.
    fn scan(
        &self,
        path: &Path,
        cancel_token: Arc<AtomicBool>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Vec<SecurityFinding>, String>> + Send>>;
}
