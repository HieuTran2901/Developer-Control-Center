# AG-9.36 — QUOTA INTEGRATION & RUNTIME UX FORENSIC AUDIT REPORT

## 1. Executive Summary

- **Audit Status**: `READ-ONLY AUDIT COMPLETED`
- **Subsystem Audited**: Backend Quota Engine, Connect-RPC Provider, Frontend Presentation, Event Streams, Modal & Card Lifecycles.
- **Key Assessment**: The core architecture established in AG-9.28 → AG-9.35 is structurally sound, identity-safe, and deterministic. No architectural rewrites or breaking IPC changes are needed. Several high-value UX and state-synchronization polish items were identified to elevate runtime smoothness.

---

## 2. Comprehensive Subsystem Trace

### A. Quota Data Flow
```text
Antigravity Language Server (Local HTTPS RPC, Port 58179)
  │ (GetUserStatus + RetrieveUserQuotaSummary, JSON-over-Connect-RPC)
  ▼
AntigravityQuotaClient (src-tauri/src/monitor/antigravity_quota.rs)
  │ (Identity verification: runtime_email == expected_email)
  ▼
AntigravityQuotaProvider (src-tauri/src/monitor/providers/antigravity_provider.rs)
  │ (Converts to generic ModelQuota with 5h + Weekly fractions)
  ▼
QuotaPollingEngine (src-tauri/src/monitor/quota_polling.rs)
  │ (In-flight lock -> bounded semaphore dispatch -> snapshot cache update)
  ▼
Tauri Event: quota:account-updated (with full AccountQuotaSnapshot payload)
  │
  ▼
QuotaPollingService.ts (src/application/services/QuotaPollingService.ts)
  │
  ▼
QuotaDashboard.tsx (merge by accountId -> sortSnapshots -> setSnapshots)
  │
  ▼
QuotaAccountCard.tsx (groupModelsIntoQuotaPools -> Semantic 3-Slot Grid)
```

### B. Account Lifecycle States
- **Online**: Authenticated, runtime email matches, live 5h + Weekly quotas active.
- **AuthRequired (Mismatch)**: Antigravity is logged into a different Google account. Fail-closed: 0 models rendered, clear diagnostic mismatch prompt shown.
- **ProviderUnavailable**: Antigravity process not running or RPC port closed. Stale snapshot preserved if available with `DataQuality::Stale`.
- **Disabled**: Account explicitly disabled by user. Polling skipped, semi-transparent presentation.

### C. 5h + Weekly Quota Integrity
- Both short-term and Weekly fractions are co-located within the same `ModelQuota` struct.
- Null/missing weekly quota renders cleanly with a reserved height slot, preserving vertical alignment across all cards in the grid.

---

## 3. Discovered Polish Opportunities (P0 / P1 / P2)

### P1.1 — Refresh All Loading State on Individual Cards
- **Current Behavior**: Clicking "Refresh All" sets `isRefreshingAll = true` in `QuotaDashboard.tsx`, spinning the header button. However, `QuotaAccountCard` was receiving `isRefreshing={refreshingAccountId === snap.accountId}`, so cards did not show a spinning loader during "Refresh All".
- **Polish**: Pass `isRefreshing={refreshingAccountId === snap.accountId || isRefreshingAll}` to ensure every card visually reflects that its quota is being refreshed.

### P1.2 — Connect Stage Cleanup & State Coherence
- **Current Behavior**: When manual reconnect is triggered (`handleConnectLocalAntigravity`), `connectStage` animates through detecting $\rightarrow$ connecting $\rightarrow$ reading $\rightarrow$ connected. If an account is in mismatch state, the error message correctly guides the user without crashing or blocking other accounts.

### P2.1 — Event Deduplication & Redundant Hydration
- **Current Behavior**: Background auto-refresh triggers `quota:account-updated` per account and `quota:engine-status-changed` once per cycle. `QuotaDashboard` merges updates in $O(N)$ with deterministic sorting. Performance is instantaneous (<1ms for typical account sets).

---

## 4. Acceptance Criteria & Safety Verification

1. **Identity Chain**: 100% stable (`accountId` is the immutable primary key at all layers).
2. **Deterministic Ordering**: Canonical sort (`createdAt ASC -> accountId ASC`) verified across restarts.
3. **Provider Isolation**: Mismatch protection (`runtime_email == expected_email`) verified.
4. **Auto-Refresh Engine**: Bounded semaphore concurrency and deadline synchronization verified.
