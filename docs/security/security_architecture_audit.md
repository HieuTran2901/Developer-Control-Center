# Security Center Architecture Audit

**Target**: Developer Control Center (DCC)
**Date**: 2026-08-08

## 1. Executive Summary
This document outlines the architectural audit for introducing the new Epic: **Security Center**. The goal is to provide static security analysis (Dependencies, Secrets, Configuration, Git, Permissions) bounded strictly to the active Project Profile without blocking the Tauri main thread or violating clean architecture boundaries.

## 2. Current Architecture Context
- **Frontend**: Clean Architecture (Domain, Application, Infrastructure, Presentation) with a React/Tailwind UI.
- **Backend**: Rust using Tauri. Current folders include `commands`, `monitor`, `runtime`.
- **Workspace Model**: Projects are defined by a `Project` entity with a strict `rootPath`.

## 3. Architecture Decisions & Answers

### 1. Where should Security Center reside?
- **Domain Layer (Rust & TS)**: Definitions of `SecurityFinding`, `SecurityCategory`, `SecuritySeverity`, `SecurityScanSummary`.
- **Infrastructure Layer (Rust)**: The actual scanning logic (file reading, regex matching, Git parsing).
- **Presentation Layer (TS/React)**: A dedicated `SecurityPage` and `SecurityOverview` components.

### 2. Should the scan engine run in Rust or Frontend?
- **Rust**: It MUST run in Rust to handle thousands of files rapidly, bypass browser sandbox constraints, minimize memory footprint, and prevent freezing the UI thread. The frontend will merely act as a renderer and command dispatcher.

### 3. How does the frontend invoke the scanner?
- Through a Tauri command: `invoke("start_security_scan", { project_id })`.
- The Rust command handler immediately spawns an async `tokio::task` and returns a success acknowledgment to prevent blocking.

### 4. How are findings transmitted via IPC?
- Using Tauri's event bus (`app_handle.emit_all`). The payload will be strictly typed `SecurityScanEvent` enums (Started, Progress, FindingDetected, Completed, Failed, Cancelled).

### 5. How is the Project Profile scanned?
- The backend retrieves the `Project` entity from the `WorkspaceManager` using the provided `project_id`.
- The `rootPath` is extracted and used as the base anchor for all relative scans.

### 6. How is scanning outside the project root prevented?
- The engine will canonicalize the `rootPath`.
- All file access paths must be verified using a `starts_with(canonical_root)` check before reading. This mitigates `../` path traversal vulnerabilities. Symlinks escaping the root must be ignored.

### 7. How to avoid blocking the UI?
- Rust scanning logic must use async I/O (`tokio::fs`) and yield to the Tokio executor periodically.
- Emitted events must be chunked or rate-limited if thousands of findings occur, preventing IPC buffer overflows that could lag the frontend.

### 8. How to cancel a scan?
- Utilize Tokio's `CancellationToken`. The token is passed to all scanner workers. When the user triggers `cancel_security_scan`, the token is triggered, aborting the async tasks gracefully.

### 9. How to report progress?
- Emitting `SecurityScanProgress { scanned_files, total_estimated, current_scanner }` events via IPC.

### 10. How to cache results?
- Results can be cached in the workspace SQLite/JSON database per project. A checksum of critical files (e.g., `package.json`, `.git/HEAD`) can determine if a deep rescan is necessary.

## 4. Security Domain Design
- **SecurityFinding**: Core entity representing a vulnerability.
- **SecuritySeverity**: `INFO`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- **SecurityCategory**: `DEPENDENCY`, `SECRET`, `CONFIGURATION`, `ENVIRONMENT`, `GIT`, `PERMISSION`, `FILE_EXPOSURE`.
- **Scanner Abstraction**: `trait SecurityScanner` in Rust.
- **Engine**: `SecurityScanEngine` orchestrating multiple scanners concurrently.

## 5. Security Engine & Registry
- `ScannerRegistry`: Holds instances of `SecretScanner`, `DependencyScanner`, etc.
- **Flow**:
  1. Frontend calls `start_security_scan`.
  2. Backend spawns a dedicated Tokio task.
  3. Engine fetches scanners from the Registry.
  4. Engine creates a generic `WalkDir` iterator (skipping `node_modules`, `.git/objects`, `target`).
  5. Each file is passed asynchronously to applicable scanners.
  6. Findings are emitted via `emit_all("security_event", ...)`.

## 6. Open Questions & Limitations
- **Security Score**: The exact algorithm for the score will remain `Not Evaluated` until a strict threat model is defined.
- **Git History**: Scanning massive Git histories is computationally expensive. Phase 1 will design the interface but defer implementation.
- **Dependency VDB**: External vulnerability databases (OSV, NPM Audit) require network calls and caching, deferred to later phases.
