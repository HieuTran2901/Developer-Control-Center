# Phase 5: Architecture Audit

## 1. Capabilities Overview

### What already exists?
- **SecurityEngine**: Orchestrates scanning using `tokio::spawn`. Manages cancellation tokens and multiplexes file paths to multiple scanners.
- **Scanners**: `CoreSecretScanner`, `DependencyScanner`, `ConfigurationScanner`.
- **Domain & IPC**: Robust models (`SecurityFinding`, `SecuritySeverity`, `SecurityCategory`) and an EventBus to stream chunks of findings to the frontend.
- **Frontend**: A complete React interface (`SecurityOverview.tsx`) that handles scanning state, rendering findings by category, and calculating metrics.

### What is incomplete?
- **File Traversal**: The `SecurityEngine::get_files_in_bounds` method is extremely naive. It recursively buffers *all* file paths into a `Vec<PathBuf>` in memory before scanning starts. It uses a hardcoded ignore list (`node_modules`, `target`, `.git`, `dist`) and **completely ignores `.gitignore`**. This guarantees severe performance degradation and memory bloat on large repositories with generated artifacts (e.g., `coverage/`, `build/`).
- **Git Security**: The `SecurityCategory::Git` enum variant exists, but no scanner produces it.
- **Streaming Files**: The engine collects all files upfront instead of streaming paths to scanners, increasing Time-to-First-Finding (TTFF).

## 2. Next Logical Capability (Phase 5 Scope)
The next logical capability is the **Git Security Interface & Traversal Optimization**. 

### Why it belongs in Phase 5:
1. **Stability & Performance**: With Phase 2-4 adding more scanners, the naive file walker is becoming a critical bottleneck. Implementing `.gitignore` awareness is mandatory before DCC can safely scan massive enterprise repositories.
2. **Roadmap Alignment**: The `security_implementation_plan.md` explicitly defines Phase 5 as laying the groundwork for version control scanning and implementing `.gitignore` awareness to optimize scan speed.

### What must explicitly NOT be included:
- **Full Git History Parsing**: Traversing the entire commit tree for leaked secrets is computationally expensive and complex. It must be deferred.
- **Streaming Traversal Refactor**: While buffering paths is sub-optimal, rewriting `SecurityEngine` to use async streams (e.g., `async-stream`) across threads is a massive architectural shift that violates the 1,000–2,000 LOC limit and risks Phase 3/4 regressions. We will stick to the `Vec<PathBuf>` interface for now but populate it using the `ignore` crate.

## 3. Architecture Audit Findings

### Backend Strengths
- **Clean Traits**: The `SecurityScanner` trait `scan(path, cancel_token)` is perfectly isolated.
- **Cancellation**: `Arc<AtomicBool>` provides rapid, reliable cancellation across async boundaries.
- **Evidence Redaction**: The `SecurityRedactor` properly sanitizes findings before IPC transmission.

### Hidden Technical Debt & Risks
- **Filesystem Risks**: `std::fs::read_dir` is used inside a while loop, buffering all valid paths. If a user has a massive auto-generated folder not in the hardcoded list, the application will freeze collecting paths.
- **Coupling**: The file traversal logic is tightly coupled inside `SecurityEngine`. It should be extracted to a `FilesystemWalker` or use the `ignore` crate natively.
- **Binary File Risks**: The `ConfigurationScanner` checks for `.json`/`.yml`, but the `CoreSecretScanner` uses regex on file contents. Currently, the Secret Scanner attempts to `fs::read_to_string` on *every* file not caught by the hardcoded ignore list. This will crash or panic on binary files (e.g., `.png`, `.dll`) if they contain invalid UTF-8.

### UI / Frontend Risks
- **UI State**: The frontend correctly processes findings, but the `SecurityCategory::Git` icon and filtering logic might be missing or untested since no findings of that category have ever been emitted.

## 4. Phase 5 Scope Proposal
Based on the audit, Phase 5 will focus on **Traversal Optimization and Git Groundwork**:
1. **Implement `ignore` crate**: Replace the naive custom walker in `SecurityEngine` with the `ignore::WalkDir` crate to automatically respect `.gitignore`, `.ignore`, and global git configurations.
2. **Binary File Safeguard**: Implement a unified check in the file walker to skip binary files (or files with invalid UTF-8) *before* passing them to text-based scanners like `CoreSecretScanner`.
3. **GitSecurityScanner**: Introduce the scaffolding for `GitSecurityScanner` to scan `.git/config` for exposed credentials or insecure remote URLs.

This precisely adheres to the R012 (Stability Before Features) and R014 (Architecture First) governance rules.
