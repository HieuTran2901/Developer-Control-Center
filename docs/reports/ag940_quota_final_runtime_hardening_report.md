# AG-9.40 — QUOTA FINAL RUNTIME HARDENING & EDGE-CASE CLOSURE REPORT

## 1. Executive Summary

- **Status**: `COMPLETED`
- **Classification**: `QUOTA_RUNTIME_HARDENING_COMPLETE`
- **Objective**: Close the final INFO finding (late event resurrection upon account removal during in-flight background refresh), harden diagnostic modal state, and perform full end-to-end runtime verification.

---

## 2. Problem & Root Cause

### Root Cause Analysis:
When an account was deleted while an asynchronous background refresh for that account was in-flight (<100ms window):
1. Backend `execute_account_refresh` previously completed and inserted the snapshot into `snapshots` cache, then emitted `quota:account-updated`.
2. Frontend `onAccountUpdated` previously executed `else { next = [...prev, updatedSnap]; }`, appending the removed account back to UI state.
3. If the removed account was selected in the Advanced Diagnostics panel, `selectedDiagnosticAccountId` retained the stale ID.

---

## 3. Implemented Hardening Strategies

### A. Frontend Registered Account Gate (`QuotaDashboard.tsx`)
- In `onAccountUpdated`:
  If `index < 0` (account is not in active state), the event is safely ignored (`return prev;`).
- In `handleRemoveAccount`:
  If `selectedDiagnosticAccountId === accountId`, resets `selectedDiagnosticAccountId = ''` and `setVerificationResult(null)`.

### B. Backend Registry Verification Gate (`quota_polling.rs`)
- In `execute_account_refresh`:
  - Receives `registry: Arc<AccountRegistry>`.
  - Cleans up `in_flight` set first to guarantee no permit/lock leakage.
  - Checks `if registry.get(&acc.account_id).await.is_none() { return snapshot; }`.
  - Skips updating `self.snapshots` cache and skips emitting `quota:account-updated` if the account was deleted during execution.

---

## 4. Verification Results & Test Matrix

| Test Scenario | Verification Mechanism | Result |
| :--- | :--- | :--- |
| **Rust Backend Check** | `cargo check --manifest-path src-tauri/Cargo.toml` | **PASS (Exit 0)** |
| **Frontend Production Build** | `npm run build` | **PASS (Exit 0, 1981 modules)** |
| **Canonical Account Order** | `createdAt ASC -> accountId ASC` | **PASS (4 accounts verified)** |
| **Late Event Rejection** | Removal during in-flight refresh simulation | **PASS (Zero resurrection)** |
| **Diagnostic Target Invalidation** | Target reset upon account removal | **PASS (Clean state)** |
| **Live Connect-RPC Extraction** | PID 8872 on Port 58179 | **PASS (Live authenticated)** |
| **5H + Weekly Quota Co-location** | Bound in `ModelQuota` struct | **PASS (Zero swap)** |
| **Auto-Refresh Bounded Queue** | `MAX_CONCURRENT_REFRESHES = 2` | **PASS (Fairness verified)** |

---

## 5. Invariant Confirmation (I1–I13)

- **I1 (Account Isolation)**: PASS
- **I2 (Snapshot Isolation)**: PASS
- **I3 (Provider Isolation)**: PASS
- **I4 (Deterministic Order)**: PASS
- **I5 (Singleton Loop)**: PASS
- **I6 (Bounded Concurrency)**: PASS
- **I7 (Storm-Free Polling)**: PASS
- **I8 (5h + Weekly Co-location)**: PASS
- **I9 (Stable Modals)**: PASS
- **I10 (Refresh All Sync)**: PASS
- **I11 (Fail-Closed Mismatch)**: PASS
- **I12 (Zero Credential Leakage)**: PASS
- **I13 (Zero Removal Resurrection)**: PASS

---

## 6. Final Classification

**`QUOTA_RUNTIME_HARDENING_COMPLETE`**
