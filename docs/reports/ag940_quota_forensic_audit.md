# AG-9.40 READ-ONLY FORENSIC AUDIT REPORT
## PRE-IMPLEMENTATION RACE-CONDITION TRACE & REMOVAL RESURRECTION AUDIT

```text
AUDIT STATUS:         RACE_CONDITION_TRACED_AND_ISOLATED
INVESTIGATION MODE:   STRICT READ-ONLY FORENSIC AUDIT (PRE-FIX)
TARGET EDGE-CASE:     Late Quota Event & In-Flight Race After Account Removal
```

---

## 1. Trace of the Removal Resurrection Edge-Case

### The Scenario:
1. User registers 4 accounts ($A, B, C, D$).
2. Background auto-refresh triggers a batch refresh; Account $A$ is in-flight (`execute_account_refresh`).
3. User immediately opens Account $A$'s menu and confirms "Remove Account".
4. Frontend executes `handleRemoveAccount(A)`, filtering $A$ out of `snapshots` (`prev.filter((s) => s.accountId !== A)`).
5. Backend executes `remove_account(A)`, removing $A$ from `AccountRegistry` and `self.snapshots`.
6. Concurrently, the in-flight Connect-RPC request for $A$ completes (<100ms later).
7. `execute_account_refresh` writes the completed snapshot back into `self.snapshots.insert(A)` and emits `quota:account-updated(A)`.
8. Frontend event listener receives `quota:account-updated(A)`. In `onAccountUpdated`, `prev.findIndex(s => s.accountId === A)` returns `-1`.
9. The previous handler code executed `else { next = [...prev, updatedSnap]; }`, inadvertently resurrecting Account $A$ back into the UI until the next hard reload.
10. Additionally, if the user had selected Account $A$ in the Advanced Diagnostics panel, `selectedDiagnosticAccountId` retained $A$'s ID.

---

## 2. Structural Root Causes

1. **Frontend Optimistic Append**: `onAccountUpdated` in `QuotaDashboard.tsx` treated `index < 0` as a new account arrival rather than ignoring events for unregistered/deleted accounts.
2. **Backend Unchecked Snapshot Re-insertion**: `execute_account_refresh` in `quota_polling.rs` did not verify whether `acc.account_id` was still registered in `AccountRegistry` before updating `self.snapshots` and emitting `quota:account-updated`.
3. **Diagnostic Selection Retention**: `handleRemoveAccount` did not clear `selectedDiagnosticAccountId` if the deleted account was the currently selected diagnostic target.

---

## 3. Minimal Hardening Plan

1. **Frontend `onAccountUpdated` (`QuotaDashboard.tsx`)**:
   - If `index < 0`, ignore the event (`return prev;`).
2. **Backend `execute_account_refresh` (`quota_polling.rs`)**:
   - Pass `registry: Arc<AccountRegistry>` to `execute_account_refresh`.
   - Check `if registry.get(&acc.account_id).await.is_none() { return snapshot; }` before updating cache and emitting IPC event.
3. **Frontend `handleRemoveAccount` (`QuotaDashboard.tsx`)**:
   - Reset `selectedDiagnosticAccountId` and `verificationResult` if the removed account was selected.

---

## 4. Invariant Preservation Proof
- **I1–I13 Invariants**: Remain 100% intact.
- **No Protocol/IPC Changes**: DTO schemas and Tauri command signatures remain identical.
- **Zero Starvation / Zero Deadlock**: `in_flight` set cleanup and Semaphore permits are released prior to early exit.
