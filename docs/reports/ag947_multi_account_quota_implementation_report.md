# AG-9.47 — MULTI-INSTANCE RUNTIME DISCOVERY & INDIVIDUAL ACCOUNT QUOTA ROUTING IMPLEMENTATION REPORT

```text
STATUS:               COMPLETED
CLASSIFICATION:       MULTI_ACCOUNT_INDIVIDUAL_ROUTING_COMPLETE
DATE:                 2026-08-16
SUBSYSTEM:            Antigravity Discovery, Quota Provider, Polling Engine, IPC, React UI
```

---

## 1. Executive Summary

AG-9.47 successfully implements the next-generation **Multi-Instance Runtime Discovery and Individual Account Quota Routing** architecture in Developer Control Center (DCC).

Each configured account (`AccountMonitorConfig`) now dynamically resolves to its matching running Antigravity Language Server instance:
```text
Account A -> Runtime A -> Quota Snapshot A -> QuotaAccountCard A
Account B -> Runtime B -> Quota Snapshot B -> QuotaAccountCard B
Account C -> Runtime C -> Quota Snapshot C -> QuotaAccountCard C
```

Zero quota aggregation, zero cross-account snapshot contamination, and zero positional array-index dependencies exist.

---

## 2. Key Architectural Enhancements

### A. Multi-Instance Discovery Engine (`AntigravityDiscovery`)
- Replaced the single-instance `break;` discovery loop with `discover_all_runtimes() -> Result<Vec<AntigravityRuntime>, DiscoveryError>`.
- Discovers all running `language_server.exe` processes, extracts individual `--csrf_token` arguments, and finds dynamic listening TCP ports.
- Sorts discovered runtimes canonically by `process_id ASC`.

### B. Dynamic Runtime Identity Probing (`AntigravityQuotaClient`)
- Added `get_runtime_email(&runtime)`: Directly queries Connect-RPC `/GetUserStatus` for any given runtime instance to extract its live authenticated `userStatus.email`.
- Added `find_matching_runtime_for_email(expected_email, runtimes)`: Probes discovered runtimes to find the instance matching `expected_email` with a deterministic lowest-PID tie-breaker.

### C. Targeted Quota Dispatch (`AntigravityQuotaProvider`)
- Updated `fetch_quota(account_id, expected_email)`:
  1. Calls `discover_all_runtimes()`.
  2. Resolves the specific runtime instance matching `expected_email`.
  3. Queries Connect-RPC `/RetrieveUserQuotaSummary` from that exact runtime.
  4. If no matching runtime is running, safely fails closed as `ModelQuotaStatus::AuthRequired` with 0 live models.

---

## 3. Invariants & Stability (I1–I18)

- **I1–I5 (Identity)**: `accountId` remains immutable; each account card binds exclusively to `snap.accountId`.
- **I6–I8 (Ordering)**: Canonical sort `createdAt ASC -> accountId ASC`; Quota groups `Gemini -> Claude -> GPT -> DeepSeek -> Other`.
- **I9–I10 (Provider Isolation)**: Runtime email matching strictly enforced per instance.
- **I11–I13 (Polling Concurrency)**: Bounded semaphore (`MAX_CONCURRENT_REFRESHES = 2`) with zero account starvation.
- **I14–I18 (Removal & Lifecycle)**: Dual-layer gate prevents late-event resurrection upon account removal.

---

## 4. Verification Summary

- **Rust Compiler**: `cargo check --manifest-path src-tauri/Cargo.toml` $\rightarrow$ **PASS (Exit 0)**
- **Frontend Production**: `npm run build` $\rightarrow$ **PASS (Exit 0, 1981 modules, 8.68s)**
- **E2E Runtime Test**: `verify_ag947_multi_account_quota.py` $\rightarrow$ **PASS (All scenarios validated)**
- **Architectural Decision**: Decision #39 recorded in `docs/decisions.md`.
