# AG-9.34 — DETERMINISTIC ACCOUNT ORDERING & STABLE MODAL IDENTITY REPORT

## 1. Executive Summary

- **Status**: `COMPLETED`
- **Classification**: `DETERMINISTIC_ACCOUNT_UI_COMPLETE`
- **Objective**: Eliminate account card position instability, modal/diagnostic identity swapping, and quota group permutation identified during the AG-9.33 forensic audit.

---

## 2. Implemented Strategies

### A. Backend Canonical Account Ordering (`createdAt ASC -> accountId ASC`)
- In `AccountRegistry::list(&self)` (`quota_polling.rs`):
  Accounts retrieved from `HashMap<String, AccountMonitorConfig>` are explicitly sorted using `a.created_at.cmp(&b.created_at).then_with(|| a.account_id.cmp(&b.account_id))`.
- In `AccountRegistry::save_internal(&self)` (`quota_polling.rs`):
  Accounts are deterministically sorted before serialization to `account_registry.json`, ensuring the disk representation remains invariant across saves.
- In `QuotaPollingEngine::get_all_states(&self)` & `refresh_all_now()`:
  Accounts inherit and preserve this canonical ordering without deviation.

### B. Frontend Canonical Snapshot Merging (`QuotaDashboard.tsx`)
- Introduced canonical sorting helper `sortSnapshots(snapshots)` in `QuotaDashboard.tsx`.
- Applied `sortSnapshots()` across all hydration and lifecycle entry points:
  - Initial load (`loadDashboardData`)
  - Real-time event updates (`onAccountUpdated`)
  - Manual single account refresh (`handleRefreshAccount`)
  - Manual Refresh All (`handleRefreshAll`)
  - Account registration (`handleAddAccount`)
- Invariant: Asynchronous event completion order can **never** reorder cards.

### C. Explicit Diagnostic & Modal Target Resolution
- Replaced dangerous `snapshots[0]?.accountId` fallback in `handleVerifyProviderPath` with explicit account resolution.
- Added an interactive account selector dropdown in the Advanced Diagnostics panel when multiple accounts exist.

### D. Deterministic Quota Group & Model Hierarchy (`QuotaAccountCard.tsx`)
- In `groupModelsIntoQuotaPools(models)`:
  - Ranked model families canonically: `Gemini (1) -> Claude (2) -> GPT (3) -> DeepSeek (4) -> Other (5)`.
  - Group tiles sorted by `rank ASC` then `groupName ASC`.
  - Models inside each shared pool sorted by `displayName ASC` then `modelId ASC`.

---

## 3. Verification & Build Results

| Verification Target | Command / Script | Result |
| :--- | :--- | :--- |
| **Rust Backend Check** | `cargo check --manifest-path src-tauri/Cargo.toml` | **PASS (Exit 0)** |
| **Frontend Production Build** | `npm run build` | **PASS (Exit 0, 1981 modules)** |
| **Backend Unit Tests** | `test_account_registry_list_is_deterministic_across_instances`, `test_get_all_states_preserves_deterministic_order`, `test_save_internal_preserves_deterministic_disk_order` | **PASS** |
| **E2E Runtime Verification** | `python verify_deterministic_account_ordering.py` | **PASS (All scenarios)** |

---

## 4. Acceptance Criteria Checklist

- [x] Account card order is identical across application restarts.
- [x] Account card order is identical across frontend reloads.
- [x] Async quota events cannot reorder cards.
- [x] Auto-refresh completion order cannot reorder cards.
- [x] Modal identity is based exclusively on `accountId`.
- [x] No account-specific modal falls back to `snapshots[0]`.
- [x] No account-specific operation uses array index as identity.
- [x] Quota group order is deterministic (`Gemini -> Claude -> GPT -> DeepSeek -> Other`).
- [x] Model order inside groups is deterministic.
- [x] `account_registry.json` is persisted deterministically.
- [x] Existing account IDs and quota values remain 100% unchanged.
- [x] AG-9.32 auto-refresh engine remains 100% intact.
