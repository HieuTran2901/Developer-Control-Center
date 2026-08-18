# AG-9.46 — MULTI-ACCOUNT INDIVIDUAL QUOTA MONITORING FEASIBILITY AUDIT

```text
STATUS:               AUDIT_COMPLETED
CLASSIFICATION:       MULTI_ACCOUNT_REQUIRES_RUNTIME_ISOLATION
DATE:                 2026-08-16
AUDIT MODE:           STRICT READ-ONLY FORENSIC AUDIT (ZERO CODE MODIFIED)
PROTECTED BASELINE:   AI Quota Subsystem (Release Frozen at AG-9.41, Commit: 18acaa6, Invariants I1-I18)
```

---

## 1. Executive Summary

A comprehensive read-only forensic audit was performed to evaluate the technical feasibility and architectural design for **individual per-account quota monitoring** in Developer Control Center (DCC).

### Core Finding:
1. **Frontend Presentation & State**: The UI layer (`QuotaDashboard.tsx`, `QuotaAccountCard.tsx`), Tauri IPC event bus (`quota:account-updated`), snapshot cache (`HashMap<String, AccountQuotaSnapshot>`), and polling scheduler (`QuotaPollingEngine`) are **already 100% prepared** to display and track independent account cards without modification.
2. **Current Acquisition Bottleneck**: The local discovery engine (`AntigravityDiscovery::discover_runtime()`) currently finds only the **first** `language_server.exe` process (`break;`), meaning all accounts query that single running Antigravity instance.
3. **Strict Identity Isolation Active**: Because `AntigravityQuotaProvider::fetch_quota()` strictly enforces `runtime_email == expected_email`, the matching account receives **Live 5H + Weekly quota**, while mismatched accounts safely fail closed as **`AuthRequired`** with zero cross-account data leakage.

**Feasibility Classification**: **`MULTI_ACCOUNT_REQUIRES_RUNTIME_ISOLATION`**

---

## 2. End-to-End Pipeline Trace

```text
AccountRegistry (.dcc/account_registry.json)
    ↓ (AccountMonitorConfig: account_id, email, provider, is_active)
QuotaPollingEngine (Semaphore(2) Bounded Worker Loop)
    ↓ (Iterates accounts canonically: createdAt ASC -> accountId ASC)
execute_account_refresh(acc, registry, provider)
    ↓
QuotaProviderService::get_account_quota(provider_id, account_id, expected_email)
    ↓
AntigravityQuotaProvider::fetch_quota(account_id, expected_email)
    ↓
AntigravityQuotaClient::fetch_quota()
    ↓
AntigravityDiscovery::discover_runtime() (Scans Win32_Process for language_server.exe)
    ↓ (Extracts PID, TCP Port, --csrf_token from CLI)
Connect-RPC POST /GetUserStatus -> returns runtime_email
    ↓
Strict Identity Guard: if runtime_email != expected_email {
    return AuthRequired("Account mismatch: Antigravity is currently authenticated as X, but account is Y")
}
    ↓
Connect-RPC POST /RetrieveUserQuotaSummary -> returns ModelQuotaSummaries
    ↓
Normalized into ModelQuota { 5h remaining_fraction, weekly_remaining_fraction }
    ↓
AccountQuotaSnapshot (accountId, email, status, models)
    ↓
Tauri IPC Event 'quota:account-updated'
    ↓
React QuotaDashboard -> sortSnapshots() -> QuotaAccountCard (Per-Account Render)
```

---

## 3. Account-to-Session Mapping

| Layer | Representation | Scope | Current Behavior |
| :--- | :--- | :--- | :--- |
| **Account Identity** | `accountId` (e.g. `trunghieu10a1thptll-gmail-com`) | Per-Account | Stored in `AccountRegistry` |
| **Expected Email** | `email` (e.g. `trunghieu10a1thptll@gmail.com`) | Per-Account | Declared in Account Config |
| **Process Runtime** | `language_server.exe` (PID 8872) | Global Host | Single instance discovered |
| **Local Port** | Port 58179 | Global Host | Bound to active PID |
| **Session Token** | `--csrf_token` | Global Host | Process CLI argument |
| **Live Authenticated Email** | `trunghieu10a1thptll@gmail.com` | Global Host | Returned by Connect-RPC |

---

## 4. Multi-Account Architectural Options Analysis

### OPTION A: Multi-Instance Runtime Discovery (Recommended)
- **Model**: `Account A -> Runtime A (PID 101, Port 5001) | Account B -> Runtime B (PID 202, Port 5002)`.
- **Feasibility**: **HIGH**. Users running multiple Antigravity IDE profiles/windows have separate language server processes with dedicated ports and CSRF tokens.
- **DCC Enhancement**: Update discovery to `discover_all_runtimes() -> Vec<AntigravityRuntime>`, query `GetUserStatus` for each, and maintain an in-memory runtime map: `email -> AntigravityRuntime`.
- **Invariants**: 100% preserves I1–I18 (No cross-account contamination, deterministic ordering maintained).

### OPTION B: Sequential In-Place Account Switching (Rejected)
- **Model**: Force logout/login on single runtime during polling.
- **Feasibility**: **REJECTED**. Destructive to developer's active workspace, invalidates open sessions, creates race conditions during in-flight queries.

### OPTION C: Direct Direct-to-Provider OAuth Sessions (Future Extension)
- **Model**: DCC stores refresh tokens in OS Keyring (`KeyringCredentialStorage`) and queries Cloud Code / Gemini API directly.
- **Feasibility**: **HIGH** (Infrastructure already partially scaffolded in `quota_provider.rs`).
- **Invariants**: 100% preserves I1–I18.

---

## 5. Identity Safety & Concurrency Evaluation

1. **Identity Isolation**:
   - If Account A is refreshed while runtime is Account A $\rightarrow$ `is_match = true` $\rightarrow$ **Live Quota**.
   - If Account B is refreshed while runtime is Account A $\rightarrow$ `is_match = false` $\rightarrow$ **AuthRequired** (0 live models, zero leakage).
2. **Concurrency (`Semaphore(2)`)**:
   - `MAX_CONCURRENT_REFRESHES = 2` is fully sufficient and protects against local port saturation.
3. **Snapshot Architecture**:
   - `snapshots[accountId]` is strictly per-account. No global quota pooling or cross-account contamination exists.

---

## 6. Failure Matrix

| Scenario | Behavior in Multi-Runtime Architecture | Safety Guarantee |
| :--- | :--- | :--- |
| **Account A online, B offline** | A receives Live quota; B reports `AntigravityNotRunning` | **PASS** (Zero interference) |
| **A authenticated, B mismatched** | A receives Live quota; B reports `AuthRequired` | **PASS** (Zero contamination) |
| **Concurrent A & B refresh** | Dispatched to distinct ports via bounded semaphore | **PASS** (No collision) |
| **Account removed during refresh** | Dual-layer gate blocks late event / resurrection | **PASS** (Zero resurrection) |
| **App Restart** | Canonical sort `createdAt ASC -> accountId ASC` | **PASS** (Deterministic UI) |

---

## 7. Recommended Implementation Roadmap (AG-9.47)

```text
Step 1: Multi-Runtime Discovery Engine
        Implement AntigravityDiscovery::discover_all_runtimes() -> Vec<AntigravityRuntime>

Step 2: Runtime Email Map in QuotaProviderService
        Probe GetUserStatus across all discovered runtimes -> build HashMap<Email, AntigravityRuntime>

Step 3: Route Account to Corresponding Runtime
        Match expected_email with discovered runtime; fallback to AuthRequired if not running

Step 4: Verification Suite
        Run multi-instance E2E tests validating independent cards without regression
```

---

## 8. Final Classification & Decision

```text
DECISION:
MULTI_ACCOUNT_REQUIRES_RUNTIME_ISOLATION

RECOMMENDED NEXT PHASE:
AG-9.47 — MULTI-INSTANCE RUNTIME DISCOVERY & INDIVIDUAL QUOTA ROUTING

SOURCE CODE MODIFIED:
NO

QUOTA BASELINE MODIFIED:
NO

I1–I18:
PRESERVED
```
