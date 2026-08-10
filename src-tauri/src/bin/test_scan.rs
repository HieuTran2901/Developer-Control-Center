use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use developer_control_center_lib::security::configuration_scanner::scanner::ConfigurationScanner;
use developer_control_center_lib::security::dependency_scanner::osv::OsvProvider;
use developer_control_center_lib::security::dependency_scanner::scanner::DependencyScanner;
use developer_control_center_lib::security::git_scanner::scanner::GitSecurityScanner;
use developer_control_center_lib::security::scanner::SecurityScanner;
use developer_control_center_lib::security::secret_scanner::CoreSecretScanner;

#[tokio::main]
async fn main() {
    let mode = std::env::args().nth(1).unwrap_or("FULL".to_string());
    let path = std::env::args().nth(2).unwrap_or("tests/security-fixtures/full-scan".to_string());
    
    let path_buf = std::fs::canonicalize(PathBuf::from(path)).unwrap();

    let mut scanners: Vec<Arc<dyn SecurityScanner>> = vec![];
    
    if mode == "QUICK" || mode == "FULL" {
        scanners.push(Arc::new(CoreSecretScanner::new()));
        scanners.push(Arc::new(ConfigurationScanner::new()));
    }
    if mode == "GIT" || mode == "FULL" {
        scanners.push(Arc::new(GitSecurityScanner::new()));
    }
    if mode == "FULL" {
        let osv = Arc::new(OsvProvider::new());
        scanners.push(Arc::new(DependencyScanner::new(osv)));
    }

    let cancel_token = Arc::new(AtomicBool::new(false));
    
    // Scan .git/config
    let git_config = path_buf.join(".git").join("config");
    if git_config.is_file() {
        for scanner in &scanners {
            if let Ok(findings) = scanner.scan(&git_config, cancel_token.clone()).await {
                for f in findings {
                    println!("[{}] {:?} - {}: {}", scanner.scanner_id(), f.category, f.title, f.file_path);
                }
            }
        }
    }
    
    // Walkdir
    let mut walk = ignore::Walk::new(&path_buf);
    while let Some(Ok(entry)) = walk.next() {
        if !entry.file_type().map_or(false, |ft| ft.is_file()) {
            continue;
        }
        for scanner in &scanners {
            if let Ok(findings) = scanner.scan(entry.path(), cancel_token.clone()).await {
                for f in findings {
                    println!("[{}] {:?} - {}: {}", scanner.scanner_id(), f.category, f.title, f.file_path);
                }
            }
        }
    }
}
