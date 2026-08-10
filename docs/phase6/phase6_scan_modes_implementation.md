# Phase 6A: Scan Modes Implementation

## 1. ScanMode Model
The `SecurityScanMode` enum has been introduced to the core domain model in both Rust and TypeScript:
- `QUICK`: Optimized for speed. Focuses solely on finding exposed secrets and analyzing configuration files.
- `GIT_EXPOSURE`: Focuses purely on Git-related exposures (e.g., credentials embedded in Git remote URLs).
- `FULL`: The default mode. Runs all available scanners (Secrets, Configuration, Dependency, Git).

## 2. Scanner Mapping (SecurityEngine Orchestrator)
The backend `SecurityEngine` dynamically filters the registered scanners based on the requested `SecurityScanMode`:
- **Quick Scan**: Filters to `core_secret_scanner` and `configuration_scanner`.
- **Git Exposure Scan**: Filters to `git_scanner`.
- **Full Security Scan**: Invokes all scanners.

By orchestrating the filtering at the `engine.rs` level, the system cleanly isolates the business logic, adhering strictly to "R014 — Architecture First". No modifications were required within the individual scanners themselves.

## 3. IPC Contract
The Tauri command `start_security_scan_cmd` has been updated to accept the `mode` parameter:
```rust
pub async fn start_security_scan_cmd(
    project_id: String,
    root_path: String,
    mode: Option<SecurityScanMode>,
    ...
)
```
The frontend API (`securityApi.ts`) perfectly mirrors this signature, establishing a seamless strongly-typed boundary.

## 4. UI Behavior
- A new interactive `SecurityScanTarget` component was implemented using CSS Grid to closely align with the provided mockup.
- The component exposes 4 sub-panels: Target Info, Scan Mode Selector, Configuration (Mock), and Last Scan (Mock).
- The dropdown cleanly utilizes absolute positioning to prevent disrupting the layout or stretching the underlying cards.
- Mode changes immediately update the React state (`scanMode`) which is passed to the execution hook.

## 5. Performance Semantics
- **Quick Scan**: Avoids OSV dependency resolution and `.git/config` reads. This guarantees highly responsive feedback for rapid secret detection.
- **Git Exposure Scan**: Skips heavy file-tree traversal entirely, evaluating only the `.git` directory and tracked metadata.
- **Full Scan**: Retains the previous robust behavior.

## 6. Tests and Validation
- `cargo check` and `npm run build` executed successfully.
- No regressions were introduced into the legacy code.
- Types align flawlessly across the full stack.

## 7. Known Limitations
- The "Configuration" and "Last Scan" UI panels inside the Scan Target block are currently placeholders per the design requirements. The history store needs to be implemented in a future phase to populate "Last Scan".
- Concurrent scanning is still managed linearly by the engine.

## 8. Final Implementation Notes
- **AI Integration**: STRICTLY NOT IMPLEMENTED as per Phase 6A rules.
- No new dependencies were introduced.
- Native tailwind was used over heavy component libraries.
