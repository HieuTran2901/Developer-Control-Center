# Phase 4: Test Plan

## 1. Unit Testing
### Target: `configuration_scanner/rules.rs`
- **Test Case 1**: Given a parsed JSON structure `{"debug": true}`, verify that the `DebugModeRule` successfully emits a `SecurityFinding` of High severity.
- **Test Case 2**: Given a parsed YAML structure `debug: false`, verify that no finding is emitted.
- **Test Case 3**: Given a YAML structure `cors: { origin: "*" }`, verify `PermissiveCORSRule` detects it.

## 2. Integration Testing
### Target: `ConfigurationScanner` integration with `SecurityEngine`
- **Test Case 1**: File Size Limit.
  - Create a mock `SecurityScanner` input for a 10MB JSON file.
  - Verify that the scanner skips parsing and returns `Ok(vec![])` instantly.
- **Test Case 2**: File Extension Filtering.
  - Send a `.png` file path to `ConfigurationScanner::scan`.
  - Verify it skips parsing instantly.
- **Test Case 3**: Invalid Format Handling.
  - Send a `.json` file that contains malformed/invalid JSON.
  - Verify the parser catches the error, does not panic, and returns `Ok(vec![])` or emits an `Info` level warning.

## 3. Real Filesystem Verification (Manual QA)
### Setup
Create a directory `security-test-fixtures/configuration-scanner-test` containing:
1. `valid_config.yml` (Proper config, no findings expected).
2. `vulnerable_api.json` (Contains `{"debug": true}`).
3. `serverless.yml` (Contains permissive CORS and missing CSRF).
4. `giant_dump.json` (10MB random data).
5. `README.md` (To verify text files are ignored by this specific scanner).

### Execution Steps
1. Open the Developer Control Center application.
2. Navigate to the `Security` tab.
3. Click `Change Target` and select `security-test-fixtures/configuration-scanner-test`.
4. Click `Run Security Scan`.

### Expected Results
- Scan transitions to `Scanning...` and then `Completed`.
- The scanner parses `vulnerable_api.json` and `serverless.yml` rapidly.
- The 10MB `giant_dump.json` is safely ignored without freezing the app.
- `SecurityOverview` dynamically updates to show the findings.
- The `Category` badge on the findings correctly displays `Configuration`.
- `cargo check`, `cargo test`, and `npm run build` must all pass.
