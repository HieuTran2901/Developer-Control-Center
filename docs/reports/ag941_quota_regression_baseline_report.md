# AG-9.41 — QUOTA REGRESSION BASELINE & RELEASE FREEZE REPORT

```text
STATUS:               QUOTA_SUBSYSTEM_RELEASE_FROZEN
CLASSIFICATION:       CANONICAL REGRESSION BASELINE ESTABLISHED
DATE:                 2026-08-16
SUBSYSTEM:            AI Quota Architecture, Connect-RPC Provider, Polling Engine, IPC, React State & UI
```

---

## 1. Subsystem Evolution History (AG-9.28 → AG-9.40)

| Phase | Milestone / Focus Area | Key Architectural Outcome |
| :--- | :--- | :--- |
| **AG-9.28** | Polling Engine Auto-Start | Application-level `QuotaPollingEngine` auto-start on startup |
| **AG-9.29** | Persistent Connection UX | Startup account reconnect and compact dashboard restructuring |
| **AG-9.30** | Card Vertical Alignment | Semantic 3-Slot Grid layout for uniform card height |
| **AG-9.31** | Auto-Refresh Forensic Audit | Identified background semaphore starvation & deadline desync |
| **AG-9.32** | Auto-Refresh Engine Fix | Bounded async semaphore queueing & dynamic deadline synchronization |
| **AG-9.33** | Identity Swapping Audit | Root-caused account card position jumping & modal index targeting |
| **AG-9.34** | Deterministic Account Ordering | Canonical sorting (`createdAt ASC -> accountId ASC`) & model ranking |
| **AG-9.35** | Identity & State Consistency | Proved zero cross-account data contamination across full pipeline |
| **AG-9.36** | Quota Integration Polish | Synchronized Refresh All loading spinners on individual cards |
| **AG-9.37** | Runtime UX & Lifecycle Audit | Comprehensive cold start, restart, and offline resilience audit |
| **AG-9.38** | Production Observability Audit | 3-tier error taxonomy, diagnostic verification path, and telemetry |
| **AG-9.39** | Production Readiness Audit | Validated zero critical/high/medium/low findings (`PRODUCTION_READY`) |
| **AG-9.40** | Final Runtime Hardening | Closed in-flight late event resurrection on account removal |

---

## 2. Canonical Release Invariants (I1–I18)

### Identity Invariants
- **I1**: `accountId` is the immutable primary key at all layers.
- **I2**: `AccountMonitorConfig.accountId == AccountQuotaSnapshot.accountId`.
- **I3**: `QuotaAccountCard key == accountId` (Never array index).
- **I4**: Modal / Diagnostic target strictly equals explicit `accountId`.
- **I5**: Zero array index dependencies across presentation or backend lookups.

### Ordering Invariants
- **I6**: Canonical account ordering: `createdAt ASC → accountId ASC`.
- **I7**: Deterministic quota group ordering: `Gemini (1) → Claude (2) → GPT (3) → DeepSeek (4) → Other (5)`.
- **I8**: Deterministic model alphabetical ordering inside quota pools.

### Provider Isolation Invariants
- **I9**: `runtime_email` must match expected account email at Connect-RPC boundary.
- **I10**: Mismatched identity fails closed as `AuthRequired` with 0 live models.

### Polling & Concurrency Invariants
- **I11**: Maximum concurrent refreshes = 2 (`tokio::sync::Semaphore(2)`).
- **I12**: Zero account starvation; queued tasks acquire permits asynchronously without dropping accounts.
- **I13**: Only one background polling loop may exist (Singleton engine).

### Removal & Lifecycle Invariants (AG-9.40)
- **I14**: Removed accounts cannot be resurrected by late events (`index < 0` ignored).
- **I15**: Removed accounts cannot be written back into snapshots cache (`registry.get() == None`).
- **I16**: Removed accounts cannot be refreshed in future polling cycles.
- **I17**: Removed diagnostic targets are immediately invalidated (`selectedDiagnosticAccountId = ''`).
- **I18**: Stale events must never create new account state.

---

## 3. Regression Matrix & Verification Results

| Scenario | Expected Result | Verification Mechanism | Status |
| :--- | :--- | :--- | :--- |
| **Cold Start** | Deterministic card order, auto-reconnect | `verify_ag941_regression_baseline.py` | **PASS** |
| **Restart** | Invariant card positions | `AccountRegistry` canonical sort | **PASS** |
| **Add Account** | Deterministic position insertion | `sortSnapshots()` merge | **PASS** |
| **Rename Account** | Preserves `accountId` & card position | `AccountRegistry::rename` | **PASS** |
| **Disable Account** | Preserves identity, skips polling | `AccountPollingState::Disabled` | **PASS** |
| **Auto-Connect ON** | Reconnects on startup pass | `reconnect_startup_accounts` | **PASS** |
| **Auto-Refresh ON** | Polling loop ticks every 1s | Tokio background loop | **PASS** |
| **30s Refresh** | Tickers reset after cycle | `QuotaSummary.tsx` countdown | **PASS** |
| **Dynamic Interval** | Deadlines recalculated immediately | `update_refresh_settings` | **PASS** |
| **Refresh Single** | Card loading spinner activates | `refresh_account_now` | **PASS** |
| **Refresh All** | All card loading spinners synchronize | `isRefreshingAll` prop | **PASS** |
| **4 Accounts / 2 Permits** | Zero starvation, FIFO queue | Bounded Semaphore | **PASS** |
| **Antigravity Offline** | Stale data preserved gracefully | `DataQuality::Stale` | **PASS** |
| **RPC Timeout** | 8s limit, `NetworkError` | `tokio::time::timeout` | **PASS** |
| **Identity Mismatch** | `AuthRequired`, 0 models | `AntigravityQuotaClient` | **PASS** |
| **Weekly Missing** | Reserved height, uniform layout | Semantic 3-Slot Grid | **PASS** |
| **Remove During Refresh** | Zero resurrection | Dual-layer Gate | **PASS** |
| **Late Event** | Ignored by frontend | `index < 0` return prev | **PASS** |
| **Security Isolation** | Zero CSRF/secret tokens in state | `sanitize_error_message` | **PASS** |

---

## 4. Build & Test Status

- **Rust Compiler**: `cargo check --manifest-path src-tauri/Cargo.toml` $\rightarrow$ **PASS (Exit 0)**
- **TypeScript / Vite**: `npm run build` $\rightarrow$ **PASS (Exit 0, 1981 modules, 13.5s)**
- **Live Antigravity Connect-RPC**: PID 8872 on Port 58179 $\rightarrow$ **PASS (HTTP 200)**

---

## 5. Architectural Guardrails for Future Work

1. **NO Array Indexing for Account Identification**: Never use `snapshots[0]` or array indexes to target accounts, modals, or diagnostics.
2. **NO Unchecked Event Merging**: Never optimistically append unknown account snapshots in `onAccountUpdated`.
3. **NO Unordered Account Iteration**: Never iterate `HashMap.values()` directly for UI presentation; always sort by `createdAt ASC -> accountId ASC`.
4. **NO Synchronous Semaphore Dropping**: Never use `try_acquire_owned()` with silent continue in background pollers.

---

## 6. Final Subsystem Classification

**`QUOTA_SUBSYSTEM_RELEASE_FROZEN`**
