use developer_control_center_lib::security::engine::{
    is_default_security_excluded_dir, create_security_walker, DEFAULT_SECURITY_EXCLUDED_DIRS,
};
use std::fs::{self, File};
use std::io::Write;
use tempfile::tempdir;

#[test]
fn test_default_exclusion_policy_list() {
    let expected = ["node_modules", "dist", "build", "target", ".next", "coverage", ".cache", "out"];
    for dir in expected {
        assert!(
            is_default_security_excluded_dir(dir),
            "Expected default exclusion for directory '{}'",
            dir
        );
    }
}

#[test]
fn test_walker_pruning_all_excluded_directories() {
    let dir = tempdir().expect("create temp dir");
    let root = dir.path();

    for excluded in DEFAULT_SECURITY_EXCLUDED_DIRS {
        let nested_dir = root.join("packages").join("app").join(excluded);
        fs::create_dir_all(&nested_dir).unwrap();
        let mut file = File::create(nested_dir.join("bundle.js")).unwrap();
        writeln!(file, "aws_key = AKIAIOSFODNN7EXAMPLE").unwrap();
    }

    let src_dir = root.join("src");
    fs::create_dir_all(&src_dir).unwrap();
    let mut config_file = File::create(src_dir.join("config.ts")).unwrap();
    writeln!(config_file, "export const api = 'https://api.example.com';").unwrap();

    let git_dir = root.join(".git");
    fs::create_dir_all(&git_dir).unwrap();
    let mut git_config = File::create(git_dir.join("config")).unwrap();
    writeln!(git_config, "[remote \"origin\"]\n  url = https://github.com/org/repo.git").unwrap();

    let walker = create_security_walker(root);
    let mut scanned_paths = Vec::new();
    for entry in walker.flatten() {
        scanned_paths.push(entry.path().to_path_buf());
    }

    for path in &scanned_paths {
        let path_str = path.to_string_lossy();
        for excluded in DEFAULT_SECURITY_EXCLUDED_DIRS {
            let pattern = format!("{}{}", std::path::MAIN_SEPARATOR, excluded);
            assert!(
                !path_str.contains(&pattern),
                "Scanned path '{}' should not contain excluded directory '{}'",
                path_str,
                excluded
            );
        }
    }

    assert!(
        scanned_paths.iter().any(|p| p.ends_with("config.ts")),
        "Legitimate source file src/config.ts should be scanned"
    );
}
