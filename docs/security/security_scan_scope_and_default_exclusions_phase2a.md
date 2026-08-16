# Security Center — Phase 2A: Security Scan Scope & Default Exclusions

## 1. Overview

In Phase 2A, the **Security Center** scan scope mechanism was enhanced to decouple scanning traversal from exclusive reliance on `.gitignore`. 

Prior to this update, `SecurityEngine` relied on `ignore::Walk::new(&canonical_root)`. When target repositories had missing or incomplete `.gitignore` rules (or when scanning monorepos/bundled directories), generated build artifacts (such as `dist/assets/index-xxxxx.js`, `build/`, `.next/`, or `node_modules/`) were traversed by the secret scanner, resulting in false positives on minified chunks.

Phase 2A introduces a **centralized default exclusion policy** implemented directly within the file traversal engine (`create_security_walker`).

---

## 2. Default Excluded Directories

The scanner defines a centralized exclusion list in [`src-tauri/src/security/engine.rs`](file:///E:/Github%20project/Developer-Control-Center/src-tauri/src/security/engine.rs):

```rust
pub const DEFAULT_SECURITY_EXCLUDED_DIRS: &[&str] = &[
    "node_modules",
    "dist",
    "build",
    "target",
    ".next",
    "coverage",
    ".cache",
    "out",
];
```

### Matching Rule
- Directory exclusion applies to **directory names/components at any depth** in the tree (e.g. `project/node_modules`, `project/apps/web/.next`, `project/crates/backend/target`).
- Helper function `is_default_security_excluded_dir(dir_name: &str) -> bool` performs case-sensitive exact matching against the excluded folder name.

---

## 3. Directory Pruning Architecture

Rather than scanning files and discarding findings post-scan, the walker prunes excluded directory subtrees at traversal time to maximize performance and minimize disk I/O.

### Walker Implementation
```rust
pub fn create_security_walker(root: &std::path::Path) -> ignore::Walk {
    ignore::WalkBuilder::new(root)
        .filter_entry(|entry| {
            if entry.depth() > 0 && entry.file_type().map_or(false, |ft| ft.is_dir()) {
                if let Some(name) = entry.file_name().to_str() {
                    if is_default_security_excluded_dir(name) {
                        return false; // Prunes directory and all descendants
                    }
                }
            }
            true
        })
        .build()
}
```

---

## 4. Preservation of Git & Environment Inspection

- **Git Exposure Mode (`GIT_EXPOSURE` & `FULL`)**:
  - The crawler explicitly probes for `<dir>/.git/config` for every yielded directory that is not excluded.
  - `.git` is not globally ignored in a manner that obstructs explicit configuration reading.
- **Environment Files (`.env*`)**:
  - `.env*` discovery is preserved for root and sub-project directories.

---

## 5. Test Suite & Verification

The implementation in `src-tauri/src/security/engine.rs` is covered by focused unit tests:

1. `test_is_default_security_excluded_dir_matching`: Verifies exact matching for all 8 default exclusion names.
2. `test_is_default_security_excluded_dir_allow_legitimate`: Verifies non-excluded names (`src`, `lib`, `config`, `components`, etc.) are allowed.
3. `test_walker_excludes_node_modules`: Verifies `node_modules` directory subtree is skipped.
4. `test_walker_excludes_dist`: Verifies `dist/` and `dist/assets/` are skipped.
5. `test_walker_excludes_build`: Verifies `build/` is skipped.
6. `test_walker_excludes_target`: Verifies `target/` and `target/debug/` are skipped.
7. `test_walker_excludes_next`: Verifies `.next/` is skipped.
8. `test_walker_excludes_coverage`: Verifies `coverage/` is skipped.
9. `test_walker_excludes_cache`: Verifies `.cache/` is skipped.
10. `test_walker_excludes_out`: Verifies `out/` is skipped.
11. `test_walker_excludes_nested_dirs`: Verifies deep subdirectories like `packages/frontend/dist` and `crates/backend/target` are skipped.
12. `test_walker_allows_legitimate_source_files`: Verifies legitimate source files (`src/config.ts`, `lib/auth.js`) are collected.
13. `test_git_exposure_preservation_and_git_config_check`: Verifies `.git/config` access and path resolution.

---

## 6. Boundaries Maintained

- **Detection Rules & Regexes**: No modifications to secret scanning regexes, CORS rules, or severity algorithms.
- **Scan Modes**: `QUICK`, `GIT_EXPOSURE`, and `FULL` mode definitions remain unmodified.
- **Finding Pipeline**: Processing, aggregation, and redaction logic remain untouched.
