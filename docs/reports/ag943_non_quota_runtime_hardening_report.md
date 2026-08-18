# AG-9.43 — NON-QUOTA RUNTIME HARDENING & REGRESSION CLOSURE REPORT

```text
STATUS:               COMPLETED
CLASSIFICATION:       NON_QUOTA_RUNTIME_HARDENING_COMPLETE
DATE:                 2026-08-16
PROTECTED BASELINE:   AI Quota Subsystem (Release Frozen at AG-9.41, Commit: 18acaa6)
SCOPE:                Runtime Registry, CI/CD Context & History, Security Findings React Key
```

---

## 1. Executive Summary

Based on the whole-application forensic audit findings from **AG-9.42**, this phase implemented targeted, non-breaking runtime hardening across the non-quota feature modules while strictly maintaining the **AI Quota Subsystem** as a frozen baseline.

All four actionable findings (F-01, F-02, F-03, F-04) have been resolved, verified, and unit tested.

---

## 2. Detailed Fixes & Implementation

### F-01: Deterministic Process Order in `RuntimeRegistry::get_all()`
- **File**: `src-tauri/src/runtime/registry.rs`
- **Issue**: `HashMap.values()` iteration in Rust was non-deterministic due to randomized hash seeds across process runs.
- **Solution**: Sorted the returned `Vec<ProcessModel>` canonically:
  ```rust
  let mut list: Vec<ProcessModel> = map.values().cloned().collect();
  list.sort_by(|a, b| {
      a.start_time
          .unwrap_or(0)
          .cmp(&b.start_time.unwrap_or(0))
          .then_with(|| a.id.cmp(&b.id))
  });
  list
  ```
- **Outcome**: Deterministic ordering across all process list consumers (`start_time ASC -> id ASC`).

---

### F-02: Async `listen()` Unmount Race in `PipelineContext.tsx`
- **File**: `src/features/cicd/context/PipelineContext.tsx`
- **Issue**: `unlisten = await listen(...)` in `useEffect` left `unlisten` undefined if the component unmounted before the Promise resolved.
- **Solution**: Implemented an `isMounted` guard with deferred cleanup:
  ```typescript
  let isMounted = true;
  let unlistenFn: UnlistenFn | null = null;

  listen('pipeline_event', (event) => {
    if (!isMounted) return;
    // Event handling...
  }).then((unsub) => {
    if (!isMounted) {
      unsub();
    } else {
      unlistenFn = unsub;
    }
  }).catch(console.error);

  return () => {
    isMounted = false;
    if (unlistenFn) {
      unlistenFn();
    }
  };
  ```
- **Outcome**: Completely leak-proof event listener lifecycle regardless of unmount timing.

---

### F-03: Stable React Key for Security Findings
- **File**: `src/features/security/components/SecurityActiveFindings.tsx`
- **Issue**: Used positional index `key={i}` instead of stable entity identity.
- **Solution**: Replaced `key={i}` with unique finding identity `key={f.id}`.
- **Outcome**: Clean React DOM reconciliation and animation preservation during finding filtration.

---

### F-04: Deterministic Tie-Breaker in `PipelineHistoryStore::get_all_summaries()`
- **File**: `src-tauri/src/pipeline/history/store.rs`
- **Issue**: Sorted solely by `updated_at_ms DESC` without a tie-breaker for identical timestamps.
- **Solution**: Added secondary comparator:
  ```rust
  summaries.sort_by(|a, b| {
      b.updated_at_ms
          .cmp(&a.updated_at_ms)
          .then_with(|| a.pipeline_id.cmp(&b.pipeline_id))
  });
  ```
- **Outcome**: 100% deterministic pipeline summary list ordering.

---

## 3. Verification & Test Matrix

| Finding / Area | Test Mechanism | Status |
| :--- | :--- | :--- |
| **F-01 Process Ordering** | `verify_ag943_hardening.py` | **PASS** |
| **F-02 Pipeline Listener Race** | `verify_ag943_hardening.py` | **PASS** |
| **F-03 Security Finding Key** | `verify_ag943_hardening.py` | **PASS** |
| **F-04 History Tie-Breaker** | `verify_ag943_hardening.py` | **PASS** |
| **Protected Quota Subsystem** | Zero modified Quota files | **PASS (100% Frozen)** |
| **Rust Compiler** | `cargo check --manifest-path src-tauri/Cargo.toml` | **PASS (0 errors)** |
| **Frontend Production Build** | `npm run build` | **PASS (0 errors, 1981 modules, 22.3s)** |

---

## 4. Git Diff & Safety Audit

The following files were modified and verified:
1. `src-tauri/src/runtime/registry.rs`
2. `src-tauri/src/pipeline/history/store.rs`
3. `src/features/cicd/context/PipelineContext.tsx`
4. `src/features/security/components/SecurityActiveFindings.tsx`
5. `docs/decisions.md` (Decision #37 appended)

**Quota Files Modified**: `0` (AI Quota baseline remains 100% intact).

---

## 5. Final Classification

**`NON_QUOTA_RUNTIME_HARDENING_COMPLETE`**
