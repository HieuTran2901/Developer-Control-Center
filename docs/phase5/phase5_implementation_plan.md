# Phase 5: Implementation Plan

## Objective
Replace the naive filesystem traversal logic with a `.gitignore`-aware implementation using the `ignore` crate, and introduce the foundational `GitSecurityScanner` to detect basic version control misconfigurations (e.g., exposed credentials in `.git/config`).

## User-Visible Capabilities
- Security scans will now correctly ignore files specified in `.gitignore` (e.g., `node_modules`, `build/`, `dist/`), drastically reducing scan time and memory consumption on large projects.
- New `Git` category findings will appear in the Security Center for version control misconfigurations.

## Backend Capabilities
- **Traversal Optimization**: `SecurityEngine` will use `ignore::WalkDir` instead of `std::fs::read_dir`.
- **Git Scanner**: A new `GitSecurityScanner` module.

## Frontend Capabilities
- The frontend inherently supports the `Git` category since `SecurityCategory::Git` was defined in Phase 1. No major UI code changes are expected, but manual testing will verify the rendering of Git findings.

## IPC / Domain / Security / Performance
- **Domain/IPC**: Unchanged.
- **Security**: Reduces risk of scanning sensitive ignored files (like local `.env.local` if gitignored).
- **Performance**: High impact. Memory usage during the file collection phase will plummet for large repos. Time-to-First-Finding (TTFF) will improve.
- **Error/Cancellation**: The `ignore::WalkDir` iterator yields entries synchronously. We will check the `cancel_token` periodically during traversal.

## Milestones

### Milestone 1: The `ignore` Crate Integration
- **Objective**: Replace the custom traversal loop in `SecurityEngine::get_files_in_bounds` with `ignore::WalkDir`.
- **Backend Changes**: Add `ignore = "0.4"` to `src-tauri/Cargo.toml`. Rewrite `get_files_in_bounds` to use `WalkDir::new(root).into_iter()`. Filter out directories, keeping only files.
- **Acceptance Criteria**: The scan successfully ignores `node_modules` and files listed in `.gitignore`.
- **Regression Risks**: Existing tests must still find files that are not gitignored. 

### Milestone 2: GitSecurityScanner Scaffolding
- **Objective**: Implement `GitSecurityScanner`.
- **Backend Changes**:
  - Create `src-tauri/src/security/git_scanner/mod.rs` and `scanner.rs`.
  - Implement `SecurityScanner` for `GitSecurityScanner`.
  - Register it in `SecurityEngine::new()`.
- **Acceptance Criteria**: The scanner compiles and can be registered.

### Milestone 3: Git Config Validation Rules
- **Objective**: Detect credentials in `.git/config`.
- **Backend Changes**: 
  - Add logic in `GitSecurityScanner` to exclusively target `.git/config` files (bypassing the standard ignore rules for this specific scanner, or allowing `.git/config` to pass through the walker specifically).
  - *Correction*: The `ignore` crate skips `.git` by default. To scan `.git/config`, `GitSecurityScanner` can simply construct the path `project_root/.git/config` independently of the main file walker and scan it directly.
- **Acceptance Criteria**: Emits a `SecurityFinding` if `.git/config` contains HTTP basic auth credentials (e.g., `https://user:password@github.com`).
- **Regression Risks**: Minimal, as it operates on a single deterministic file path.
