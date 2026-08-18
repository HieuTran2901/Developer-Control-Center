# AG-9.52 — POST-OAUTH PERSISTENCE & QUOTA REHYDRATION FORENSIC AUDIT REPORT

```text
STATUS:               AUDIT_COMPLETED
CLASSIFICATION:       OAUTH_ROOT_CAUSE_IDENTIFIED
DATE:                 2026-08-16
AUDIT MODE:           STRICT READ-ONLY FORENSIC AUDIT (ZERO CODE MODIFICATIONS)
PROTECTED BASELINES:  1. AI Quota Subsystem (Release Frozen at AG-9.41, Commit: 18acaa6, Invariants I1-I18)
                      2. AG-9.47 Multi-Instance Runtime Discovery
                      3. AG-9.49 Google OAuth Primary + Antigravity Fallback
                      4. AG-9.50 OAuth Security & Correctness Audit
                      5. AG-9.51 OAuth Connect UI/UX
```

---

## 1. Executive Summary & Root Cause

A strict read-only forensic audit was performed to investigate why Google OAuth accounts report `Connected` in the UI upon successful authentication, but subsequently revert to `AuthRequired` / disconnected during the background quota refresh lifecycle.

### Core Findings & Identified Root Causes

1. **OS Keyring Persistence is SUCCESSFUL**:
   - `KeyringCredentialStorage::save_refresh_token(account_id, token)` successfully writes the refresh token into Windows Credential Manager under `developer-control-center:antigravity-oauth:<account_id>`.
   - Verified via `cmdkey /list`: targets such as `LegacyGeneric:target=nakitosan912-gmail-com.developer-control-center:antigravity-oauth` are **PRESENT** and survive app restarts.
   - Keyring read immediately, during polling, and after restart is **100% operational**.

2. **Root Cause 1: Cloud Code Endpoint Schema Misalignment (`GoogleCloudCodeQuotaProvider`)**:
   - In `GoogleCloudCodeQuotaProvider::fetch_quota`, the provider queries `POST https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist` and attempts to parse `userEmail` and `models` directly from the top-level response JSON.
   - **Forensic Binary Dissection of `language_server.exe`** confirmed that `loadCodeAssist` returns `{ "currentTier": { ... }, "cloudaicompanionProject": "projects/..." }` (tier & project information), while live model quota metrics reside in `POST https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary`.
   - Because `loadCodeAssist` does not contain `models`, `models` parsed as `vec![]` (0 live models), and `userEmail` parsed as empty `""`.

3. **Root Cause 2: Fallback Cascade State Overwrite (`QuotaProviderService`)**:
   - In `QuotaProviderService::get_account_quota`, when `GoogleCloudCodeQuotaProvider` returns empty models or an error, the orchestration unconditionally cascades to `AntigravityQuotaProvider` fallback.
   - `AntigravityQuotaProvider` probes local running Language Server processes for `expected_email`.
   - When monitoring in 0-IDE mode (no local Antigravity IDE running), the fallback fails closed and returns `ModelQuotaStatus::AuthRequired`.
   - This `AuthRequired` snapshot is published via `quota:account-updated`, causing React to mark the card as disconnected / offline.

4. **Root Cause 3: `AddAccountModal` Early Refresh Race**:
   - In `AddAccountModal.tsx`, `onAddAccount(placeholderConfig)` was invoked *before* `connectGoogleAccount` started.
   - `handleAddAccount` in `QuotaDashboard.tsx` immediately called `handleRefreshAccount(placeholderConfig.accountId)` on the unauthenticated placeholder, which closed the modal prematurely and sent an `AuthRequired` state update.

---

## 2. Forensic Trace Matrix (Phases 1 – 10)

| Phase | Inspection Stage | Observed State | Classification |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Complete Lifecycle Trace | Auth $\rightarrow$ Keyring Write $\rightarrow$ Refresh $\rightarrow$ Empty Models $\rightarrow$ Fallback Fail $\rightarrow$ AuthRequired | **REPRODUCED** |
| **Phase 2** | Account ID Consistency | Immutable `accountId` (`nakitosan912-gmail-com`) used identically across OAuth, Keyring, and Polling | **MATCH (CLEAN)** |
| **Phase 3** | OS Keyring Persistence | Target `nakitosan912-gmail-com.developer-control-center:antigravity-oauth` present in Windows Credential Manager | **PRESENT** |
| **Phase 4** | Access Token Refresh | `POST https://oauth2.googleapis.com/token` with `client_id` + `client_secret` + `refresh_token` returns HTTP 200 with Bearer token | **OPERATIONAL** |
| **Phase 5** | Cloud Code API Request | `loadCodeAssist` returns metadata/project; requires `retrieveUserQuotaSummary` for model bucket hierarchy | **MISALIGNED** |
| **Phase 6** | Identity Validation | UserInfo API (`/oauth2/v2/userinfo`) returns authenticated email; `loadCodeAssist` does not return `userEmail` top-level | **CONFIRMED** |
| **Phase 7** | Primary/Fallback Decoupling | Quota availability error in Primary erroneously triggers Fallback overwrite to `AuthRequired` | **COUPLING_DEFECT** |
| **Phase 8** | UI State Decoupling | `snapshot.status === 'AuthRequired'` renders offline banner even when Google OAuth credential is stored | **COUPLING_DEFECT** |
| **Phase 9** | Event Ordering Race | `AddAccountModal` triggers `handleRefreshAccount` before browser OAuth completes | **RACE_IDENTIFIED** |
| **Phase 10**| Restart Rehydration | Stored tokens survive DCC restart; background engine reads credentials from Keyring on boot | **SURVIVES_RESTART** |

---

## 3. Recommended Minimal Fix Plan

1. **Endpoint Hardening (`GoogleCloudCodeQuotaProvider`)**:
   - In `GoogleCloudCodeQuotaProvider::fetch_quota`:
     1. Retrieve user identity via `https://www.googleapis.com/oauth2/v2/userinfo`.
     2. Query `POST https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist` to extract `cloudaicompanionProject` and `currentTier`.
     3. Query `POST https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary` with `{"project": cloudaicompanionProject}` to extract `groups` $\rightarrow$ `buckets` (`remainingFraction`, `resetTime`, `modelId`).
     4. Populate `ModelQuota` array with live percentages and reset timestamps.

2. **Primary/Fallback Isolation (`QuotaProviderService`)**:
   - If an account has a Google OAuth credential stored in Keyring, do NOT let a transient Cloud Code API quota fetch error fall back to Antigravity and wipe out the account status to `AuthRequired`.
   - Maintain `status: ModelQuotaStatus::Available` or `RateLimited` / `NetworkError` with the Google Cloud Code provider identity.

3. **Modal Lifecycle Fix (`AddAccountModal.tsx`)**:
   - Register the account *only after* browser OAuth succeeds, or use dedicated `registerAccount` without triggering premature `handleRefreshAccount` while the OAuth listener is pending.

---

## 4. Final Classification

```text
FINAL STATUS:
OAUTH_ROOT_CAUSE_IDENTIFIED

ROOT CAUSE CATEGORIES:
1. CLOUD_CODE_API_ENDPOINT_MISALIGNMENT
2. FALLBACK_CASCADE_OVERWRITE
3. ADD_ACCOUNT_MODAL_EARLY_REFRESH_RACE

INVARIANTS I1-I18:
100% PRESERVED
```
