# Phase 4: Static Architecture Audit

## 1. Goal and Scope of Phase 4
**Goal**: Implement the `ConfigurationScanner` and `EnvironmentScanner` to identify insecure settings, misconfigurations, and dangerous environmental defaults across the target repository.
**Scope**: 
- Parse and analyze structured configuration files (JSON, YAML, TOML, XML).
- Detect common misconfigurations such as:
  - `debug: true` in production configs.
  - Permissive CORS policies (e.g., `Access-Control-Allow-Origin: *`).
  - Disabled CSRF protections.
  - Hardcoded default passwords or fallback secrets in config files.

## 2. Review of Existing Architecture (Phases 1-3)
- **SecurityEngine**: Orchestrates scans using `tauri::async_runtime::spawn`. Recursively walks the directory (excluding `node_modules`, `.git`, etc.) and passes each file path to all registered `SecurityScanner` implementations.
- **SecurityScanner Trait**: The core abstraction requiring `scanner_id()`, `supported_categories()`, and an async `scan(path, cancel_token)` method.
- **SecurityFinding / IPC**: Strong domain types exist (`SecuritySeverity`, `SecurityCategory`, `FindingMetadata`). Findings are streamed via `SecurityScanEvent::FindingsChunk` over Tauri's EventBus.
- **Frontend**: `SecurityOverview.tsx` successfully consumes IPC events and renders findings dynamically.

## 3. Reusability Assessment
- **Sufficient**: The `SecurityScanner` trait is fully sufficient for `ConfigurationScanner`. No changes are needed to the trait.
- **Sufficient**: The `SecurityFinding` domain model is sufficient. `SecurityCategory::Configuration` and `SecurityCategory::Environment` already exist.
- **Sufficient**: The IPC and EventBus bridging mechanism is complete. The frontend will automatically display Configuration findings without any React code changes.
- **Sufficient**: The cancellation token mechanism `Arc<AtomicBool>` is sufficient to interrupt config parsing.

## 4. Files That Must Change
- `src-tauri/Cargo.toml` (May need to add `serde_yaml` or `toml` if not already present).
- `src-tauri/src/security/mod.rs` (Export new scanner module).
- `src-tauri/src/security/domain.rs` (Optional: add `ConfigurationMetadata` to `FindingMetadata` enum if specific metadata is desired).
- `src-tauri/src/security/engine.rs` (Instantiate and register `ConfigurationScanner`).
- **New Files**:
  - `src-tauri/src/security/configuration_scanner/mod.rs`
  - `src-tauri/src/security/configuration_scanner/scanner.rs`
  - `src-tauri/src/security/configuration_scanner/rules.rs`

## 5. Files That MUST NOT Change
- React Frontend (`SecurityOverview.tsx`, `SecurityService.ts`, etc.)
- Tauri IPC Command (`start_security_scan_cmd`)
- Core Orchestrator logic (`SecurityEngine::start_scan` loop)
- Existing Scanners (`CoreSecretScanner`, `DependencyScanner`)

## 6. Risk Analysis
### Architectural Risks
- **Dynamic Typing Parsing**: Parsing arbitrary YAML/JSON into a generic format (like `serde_json::Value`) can be difficult to query uniformly without a complex rule engine. 
- **Mitigation**: Implement a simple, targeted key-path traversal system (e.g., checking `["server"]["debug"] == true`) rather than building a full JSONPath interpreter.

### Performance Risks
- **File Size**: Parsing a 500MB JSON database dump will consume massive memory and freeze the scanner.
- **Mitigation**: Introduce a strict file size limit (e.g., `MAX_FILE_SIZE = 5MB`) within `ConfigurationScanner`. Any config file exceeding this is skipped.
- **Redundant Parsing**: Scanning non-config files (like `.png` or `.exe`).
- **Mitigation**: Filter early by file extension (`.json`, `.yml`, `.yaml`, `.xml`, `.toml`, `.properties`) before initiating `fs::read_to_string`.

### Regression Risks
- Adding a new scanner adds another sequential `await` in the `SecurityEngine` file loop. If `serde_yaml::from_str` blocks the thread on a huge file, it could stall the tokio worker.
- **Mitigation**: Use `tokio::task::spawn_blocking` if parsing heavy YAML files becomes a CPU bottleneck, or rely on the strict 5MB size limit to guarantee fast parsing on the async thread.

## 7. Implementation Gate
This audit confirms that the foundation laid in Phases 1-3 is exceptionally robust. Phase 4 requires **zero structural refactoring** of the existing pipeline. It is a pure horizontal extension (adding a new implementation of `SecurityScanner`).
