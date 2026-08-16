# Security Center — Phase 3D: Scan Plan Explainability & Execution Consistency

## 1. Overview
Phase 3D establishes complete observability, explainability, and backend-authoritative execution consistency across the Security Center pipeline:

```
Project Intelligence
        ↓
SecurityProjectContext
        ↓
SecurityScanPlanner
        ↓
SecurityScanPlan (PLAN)
        ↓
SecurityEngine (EXECUTION)
        ↓
Security Findings & Execution Summary (RESULT)
```

---

## 2. Core Concepts: Plan vs Execution vs Result

1. **PLAN (Intended Scan)**:
   - Generated deterministically by `SecurityScanPlanner` from `SecurityProjectContext`.
   - Explains what capabilities are planned (`secrets`, `configuration`, `dependencies`, `git_exposure`), manifests targeted for OSV lookup, and Git repository availability.
   - Explains why capabilities are included or excluded without executing the scan.

2. **EXECUTION (Actual Execution)**:
   - Authoritative backend representation created by `SecurityEngine`.
   - Captured in `SecurityScanExecutionSummary` and attached to `SecurityScanSummary`.
   - Details exact scanner execution states:
     - `EXECUTED`: Scanner successfully executed during scan.
     - `NOT_INCLUDED`: Scanner not included in the selected scan mode.
     - `UNAVAILABLE`: Capability unavailable (e.g. Git scanner on non-Git project, Dependency scanner on project without manifests).
     - `CANCELLED`: Scan cancelled by user.
     - `FAILED`: Scan failed due to runtime error.
   - Preserves execution telemetry: `files_examined`, `duration_ms`, `findings_count`, `git_checked`.

3. **RESULT (Detected Findings)**:
   - The security findings and vulnerabilities detected by the executed scanners.
   - Evidence redaction and bounding preserved (Phase 2B).
   - Finding metadata (e.g. OSV CVE details, package advisory info) linked directly to findings.

---

## 3. Data Structures & IPC Contracts

### A. Rust Domain Types (`src-tauri/src/security/domain.rs`)

```rust
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ScannerExecutionState {
    Executed,
    NotIncluded,
    Unavailable,
    Cancelled,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScannerExecutionDetail {
    pub scanner_id: String,
    pub scanner_name: String,
    pub category: String,
    pub state: ScannerExecutionState,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct SecurityScanExecutionSummary {
    pub scan_id: String,
    pub mode: SecurityScanMode,
    pub project_id: String,
    pub project_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub planned_capabilities: Option<SecurityCapabilities>,
    pub executed_scanners: Vec<String>,
    pub skipped_scanners: Vec<String>,
    pub scanner_details: Vec<ScannerExecutionDetail>,
    pub git_checked: bool,
    pub files_examined: usize,
    pub findings_count: usize,
    pub duration_ms: u64,
    pub status: SecurityScanStatus,
}
```

### B. TypeScript Mirrors (`src/domain/entities/SecurityFinding.ts`)

- `ScannerExecutionState`: `'EXECUTED' | 'NOT_INCLUDED' | 'UNAVAILABLE' | 'CANCELLED' | 'FAILED'`
- `ScannerExecutionDetail`: Scanner metadata, state, and human-readable explanation reason.
- `SecurityScanExecutionSummary`: Full scan execution telemetry.

---

## 4. UI Observability & Explainability

[`SecurityScanPlanCard.tsx`](file:///E:/Github%20project/Developer-Control-Center/src/features/security/components/SecurityScanPlanCard.tsx) presents the three unified sections:
1. **Planned Capabilities**: Grid showing Secrets, Configuration, Dependencies, Git Exposure.
2. **Authoritative Execution Summary**: Displayed when a scan has executed or is executing, showing status badge, duration, files examined, findings count, and scanner-by-scanner execution state badges (`Executed`, `Not included`, `Unavailable`, `Cancelled`, `Failed`).
3. **Explainability & Default Exclusions**:
   - OSV manifest targets identified.
   - Planning notes and Git repository status reasons.
   - Centralized default exclusion list: `node_modules`, `dist`, `build`, `target`, `.next`, `coverage`, `.cache`, `out`.

---

## 5. Project Switching & State Isolation
When switching between projects (`Project A` → `Project B`):
- `SecurityOverview.tsx` immediately resets `scanPlan`, `summary`, `findings`, and `status`.
- `SecurityService.ts` cache resets on target path change.
- No execution metadata or findings from Project A remain attached to Project B.

---

## 6. Verification & Test Suite
- Rust unit tests in `src-tauri/src/security/engine.rs`:
  - `test_phase3d_1_quick_execution_summary`: QUICK mode execution summary validation.
  - `test_phase3d_2_git_exposure_execution_summary`: Git fast-path execution telemetry.
  - `test_phase3d_3_full_execution_summary`: Full scan execution of all registered scanners.
  - `test_phase3d_4_non_git_project_execution_summary`: Non-Git repository explanation.
  - `test_phase3d_5_no_manifest_project_execution_summary`: Dependency scanner unavailability explanation.
  - `test_phase3d_6_cancelled_execution_summary`: Cancelled scan state propagation.
  - `test_phase3d_7_failed_execution_summary`: Failed scan state propagation.
  - `test_phase3d_8_project_isolation`: Multi-project execution summary isolation.
- `cargo check --tests --manifest-path src-tauri/Cargo.toml` passed with 0 errors.
- `npm run build` passed with 0 errors.
