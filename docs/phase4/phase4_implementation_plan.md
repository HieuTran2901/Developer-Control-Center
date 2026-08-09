# Phase 4: Implementation Plan

## Goal Description
Implement `ConfigurationScanner` to statically analyze configuration files (YAML, JSON, XML, Properties) for security misconfigurations and insecure defaults.

## User Review Required
> [!IMPORTANT]
> - Do we need to parse `.toml` files for this phase, or are `.json`, `.yaml`/`.yml`, `.xml`, and `.properties` sufficient for MVP?
> - Should we enforce a strict 5MB limit on configuration files to prevent OOM / CPU stalling?

## Proposed Changes

---
### 1. Configuration Scanner Setup

#### [MODIFY] [Cargo.toml](file:///E:/Github%20project/Developer-Control-Center/src-tauri/Cargo.toml)
- Add `serde_yaml` dependency to parse YAML configurations safely.

#### [NEW] [mod.rs](file:///E:/Github%20project/Developer-Control-Center/src-tauri/src/security/configuration_scanner/mod.rs)
- Export the `scanner` and `rules` modules.

#### [MODIFY] [mod.rs](file:///E:/Github%20project/Developer-Control-Center/src-tauri/src/security/mod.rs)
- Add `pub mod configuration_scanner;`

#### [MODIFY] [engine.rs](file:///E:/Github%20project/Developer-Control-Center/src-tauri/src/security/engine.rs)
- Instantiate `ConfigurationScanner::new()` and register it in `SecurityEngine::new()`.

---
### 2. Implementation of Rules Engine

#### [NEW] [rules.rs](file:///E:/Github%20project/Developer-Control-Center/src-tauri/src/security/configuration_scanner/rules.rs)
- Define a `ConfigRule` struct mapping a target key/pattern to a `SecurityFinding`.
- Implement specific misconfiguration checks:
  - `debug: true`
  - `cors: "*"` or `Access-Control-Allow-Origin: "*"`
  - `csrf: false` or `csrf_protection: disabled`
- Provide specialized parsing checks for `serde_json::Value` and `serde_yaml::Value`.

---
### 3. Scanner Implementation

#### [NEW] [scanner.rs](file:///E:/Github%20project/Developer-Control-Center/src-tauri/src/security/configuration_scanner/scanner.rs)
- Implement the `SecurityScanner` trait for `ConfigurationScanner`.
- Define `supported_categories()` to return `vec![SecurityCategory::Configuration]`.
- In `scan()`:
  - Check `cancel_token`.
  - Filter files by extensions (`.json`, `.yml`, `.yaml`).
  - Read file metadata. If file size > 5MB, return empty findings to prevent DOS.
  - Read file content into memory.
  - Parse content using `serde_json` or `serde_yaml` dynamically.
  - Execute `ConfigRule`s against the parsed structure.
  - Emit mapped `SecurityFinding`s.

## Verification Plan

### Automated Tests
- Unit tests in `rules.rs` to verify positive and negative hits on mocked JSON/YAML objects.
- `cargo test` to verify `SecurityEngine` and trait integrations.
- `cargo check` and `npm run build` to ensure no IPC / compilation regressions.

### Manual Verification
- Provide a fixture folder `security-test-fixtures/configuration-scanner-test` containing:
  - `prod.json` (with `debug: true`)
  - `config.yml` (with permissive CORS)
  - `large_file.json` (10MB file, ensuring it is skipped).
- Trigger a real filesystem scan via the UI.
- Verify that `Configuration` findings appear in the dashboard alongside Dependency and Secret findings.
