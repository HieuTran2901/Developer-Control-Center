# AG-9.89 — GOOGLE OAUTH ACCOUNT ADD UI VISIBILITY FORENSIC AUDIT REPORT

```text
STATUS:               AUDIT_COMPLETED
DATE:                 2026-08-17
AUDIT MODE:           STRICT READ-ONLY FORENSIC AUDIT (ZERO SOURCE CODE MODIFIED)
CLASSIFICATION:       ROOT_CAUSE_PROVEN
FIRST_DIVERGENCE:     T9 (AddAccountModal OAuth Success Handler) & T10 (Dashboard Event Listener Discarding New Accounts)

REGISTRY:             PRESENT (Backend successfully persists new account in account_registry.json)
KEYRING:              PRESENT (Backend successfully persists credentials in OS Keyring namespace)
SNAPSHOT:             PRESENT (Backend initializes snapshot and emits quota:account-updated)
IPC:                  PASS (quota_connect_google_account_cmd returns OAuthConnectionResult with accountId)
FRONTEND_STATE:       FAIL (snapshots array in React state is never updated with the new account)
UI_RENDER:            FAIL (Table does not render the new account because it is absent from React state)

ACCOUNT_ISOLATION:    PASS (Existing accounts remain completely unaffected)
OAUTH_SECURITY:       PASS (PKCE S256, state validation, and token isolation preserved)
I1_I18:               PRESERVED (All 18 AI Quota release freeze invariants intact)
ZERO_IDE_DEPENDENCY:  PASS (Zero language_server.exe involved)

PROTECTED BASELINES:  1. AG-9.41 AI Quota Subsystem Release Freeze (Commit: 18acaa6, Invariants I1-I18)
                      2. AG-9.47 Multi-Instance Runtime Discovery
                      3. AG-9.49 Google OAuth Primary + Antigravity Fallback
                      4. AG-9.50 OAuth Security & Correctness Audit
                      5. AG-9.51 Google OAuth Connect UI/UX
                      6. AG-9.52 Post-OAuth Persistence Forensic Audit
                      7. AG-9.53 Google Cloud Code Quota API Correction
                      8. AG-9.54 Google OAuth Client Pairing & State Hardening
                      9. AG-9.55 Invalid-Grant Forensic Finding
                      10. AG-9.56 Google OAuth Reauthorization Hardening
                      11. AG-9.57 Post-Reauth Credential Consumption Audit
                      12. AG-9.58 OAuth Credential Lifecycle Repair
                      13. AG-9.59 Google OAuth Client Compatibility Audit
                      14. AG-9.60 DCC-Owned Google OAuth Multi-Account Production
                      15. AG-9.61 DCC Google OAuth Environment Credential Migration
                      16. AG-9.61A Google Primary Runtime Authorization Forensic Audit
                      17. AG-9.62 Antigravity Multi-Account Runtime Audit
                      18. AG-9.63 Cloud Quota Multi-Account Architecture Pre-Implementation Audit
                      19. AG-9.64 Cloud Quota Multi-Account Runtime Hardening
                      20. AG-9.65 Multi-Account Quota Management UI & Account Lifecycle
                      21. AG-9.66 Production Validation & Observability Phase
                      22. AG-9.67 Antigravity Multi-Runtime Identity Binding
                      23. AG-9.68 Cloud-Direct Multi-Account Quota Provider
                      24. AG-9.69 Cloud Quota Runtime Truth Verification
                      25. AG-9.70 Intelligent Multi-Account Quota Orchestration
                      26. AG-9.71 Multi-Account Quota Dashboard V2
                      27. AG-9.72 Cloud Credential Binding Implementation
                      28. AG-9.72A OAuth Regression Forensic Audit
                      29. AG-9.73 Cloud Credential Recovery & UI State Correction
                      30. AG-9.74 Production Multi-Account Validation & UX Hardening
                      31. AG-9.75 Post-OAuth Credential Binding Forensic Audit
                      32. AG-9.76 Cloud Code Response Compatibility & Provisioning Handling
                      33. AG-9.77 V1 Antigravity vs Google Cloud Code Quota Path Forensic Comparison
                      34. AG-9.78 Antigravity Quota Backend Extraction & Cloud-Direct Feasibility Forensic Audit
                      35. AG-9.79 Antigravity Cloud-Direct Quota Provider Implementation & Runtime Verification
                      36. AG-9.80 Production Multi-Account Cloud-Direct Validation & Regression Audit
                      37. AG-9.81 Account Lifecycle & Quota Availability UX Hardening Forensic Audit
                      38. AG-9.82 Pending Quota UX Enhancement & Regression Guard
                      39. AG-9.83 Production Account Lifecycle Interaction & UX Regression Audit
                      40. AG-9.84 Antigravity Instance ↔ DCC Account Identity Binding Forensic Audit
                      41. AG-9.85 Google OAuth Reauthorization Credential Lifecycle Repair
                      42. AG-9.86 Post-Reconnect Account 3 Auth Required Root-Cause Forensic Audit
                      43. AG-9.87 Account Reconnect Credential Lifecycle Fix
                      44. AG-9.88 Account 3 OAuth Reconnect Transaction Forensic Audit
                      45. AG-9.89 Google OAuth Account Add UI Visibility Forensic Audit
```

---

## 1. Executive Summary & Forensic Findings

When a user adds a new Google Account via the **Add AI Quota Account** modal by clicking **"Connect with Google (Recommended)"**:
1. **The Backend Operation Succeeds Completely**:
   - Google browser login completes.
   - Loopback callback receives the authorization code.
   - Token exchange succeeds, UserInfo identity is verified.
   - The account is registered in `account_registry.json`.
   - Credentials are saved in the OS Keyring.
   - `refresh_account_now` initializes the snapshot and emits the `quota:account-updated` event.
2. **The Frontend Fails to Ingest the New Account into React State**:
   - **Flaw 1 (`AddAccountModal.tsx` lines 36–41)**: When `quotaPollingService.connectGoogleAccount('new', true)` succeeds, `AddAccountModal` does **not** call `onAddAccount` and does **not** trigger any account refetch callback. It only runs `setTimeout(() => { onClose(); }, 600);`.
   - **Flaw 2 (`MultiAccountQuotaDashboard.tsx` lines 71–81 & `QuotaDashboard.tsx` lines 68–73)**: In the real-time `onAccountUpdated` listener:
     ```typescript
     setSnapshots((prev) => {
       const index = prev.findIndex((s) => s.accountId === updatedSnapshot.accountId);
       if (index >= 0) {
         const next = [...prev];
         next[index] = updatedSnapshot;
         return next;
       } else {
         return prev; // <--- DEFECT: DISCARDS NEW ACCOUNTS!
       }
     });
     ```
     Because the newly created account was not previously in the `prev` array, the listener **discards the new account snapshot**.
3. **Result**: The React `snapshots` state never receives the new account, causing it to remain completely invisible in `AccountQuotaTable` until the entire application is restarted or reloaded.

---

## 2. Complete Lifecycle Forensic Trace (T1 → T12)

| Step | Stage | Forensic Evidence | Result |
| :--- | :--- | :--- | :--- |
| **T1** | Add Account Modal Opened | User clicks "Add Account" button; modal opens | **PASS** |
| **T2** | "Connect with Google" Clicked | `handleConnectGoogleOAuth` invokes `connectGoogleAccount('new', true)` | **PASS** |
| **T3** | OAuth Browser Authentication | User signs in; Google redirects to loopback callback server | **PASS** |
| **T4** | Callback & Token Exchange | Code exchanged for tokens; Google UserInfo verified | **PASS** |
| **T5** | Backend Account Registration | `AccountMonitorConfig` created and saved to `account_registry.json` | **PASS** |
| **T6** | Keyring Persistence | Refresh token saved to `accountId.developer-control-center:antigravity-oauth` | **PASS** |
| **T7** | Initial Snapshot Initialization | `refresh_account_now` creates snapshot & emits `quota:account-updated` | **PASS** |
| **T8** | IPC Response to Frontend | `quota_connect_google_account_cmd` returns `OAuthConnectionResult { success: true }` | **PASS** |
| **T9** | AddAccountModal Success Handling | Modal executes `onClose()` without calling refresh or `onAddAccount` | **FAIL (FIRST DIVERGENCE)** |
| **T10**| `onAccountUpdated` Event Handling | Listener checks `if (index < 0)` and returns `prev`, dropping new account | **FAIL (SECOND DIVERGENCE)** |
| **T11**| Dashboard React State Mutation | `setSnapshots` is never updated with the new account | **FAIL** |
| **T12**| UI Render in `AccountQuotaTable` | React renders existing snapshots array; new account is **INVISIBLE** | **FAIL** |

---

## 3. Detailed Component Audit

### 1. `AddAccountModal.tsx` (`src/features/settings/components/AddAccountModal.tsx`)
- Lines 27–51:
  ```typescript
  const handleConnectGoogleOAuth = async () => {
    setIsConnectingOAuth(true);
    setError(null);
    setOauthStatusMessage('Opening browser for Google OAuth authorization...');
    try {
      setOauthStatusMessage('Waiting for browser authentication callback...');
      const res = await quotaPollingService.connectGoogleAccount('new', true);
      if (res.success) {
        setOauthStatusMessage('✓ Connected Google account successfully!');
        setTimeout(() => {
          onClose(); // BUG: Does not refresh accounts or invoke parent callback!
        }, 600);
      } else {
        setError(res.message || 'Google OAuth connection failed.');
      }
    } ...
  };
  ```

### 2. `MultiAccountQuotaDashboard.tsx` (`src/features/quota/v2/MultiAccountQuotaDashboard.tsx`)
- Lines 71–82:
  ```typescript
  const unsubUpdated = quotaPollingService.onAccountUpdated((updatedSnapshot) => {
    setSnapshots((prev) => {
      const index = prev.findIndex((s) => s.accountId === updatedSnapshot.accountId);
      if (index >= 0) {
        const next = [...prev];
        next[index] = updatedSnapshot;
        return next;
      } else {
        return prev; // BUG: Discards newly added account snapshots!
      }
    });
  });
  ```

### 3. `QuotaDashboard.tsx` (V1) (`src/features/settings/components/QuotaDashboard.tsx`)
- Lines 66–77: Same discarding behavior on `index < 0`.

---

## 4. Authoritative Sources of Truth

- **Authoritative Backend Source**: `AccountRegistry` (`account_registry.json`) + `PollingEngine` snapshots.
- **Authoritative Frontend Source**: `snapshots` state in `MultiAccountQuotaDashboard`.
- **Divergence**: The backend accurately registers and initializes the account, but the frontend React state fails to ingest it.

---

## 5. Recommended Fix Scope (Future Implementation Phase)

1. **Update `AddAccountModal.tsx`**:
   - Add `onAccountAdded?: () => void` prop to `AddAccountModal`.
   - In `handleConnectGoogleOAuth`, when `res.success` is true, trigger `onAccountAdded?.()` or refetch `getAllStates()` before closing.
2. **Update `MultiAccountQuotaDashboard.tsx` & `QuotaDashboard.tsx`**:
   - In `onAccountUpdated`: If `index < 0`, append the new snapshot:
     ```typescript
     if (index >= 0) {
       const next = [...prev];
       next[index] = updatedSnapshot;
       return next;
     } else {
       return [...prev, updatedSnapshot]; // Append new account!
     }
     ```
   - In `MultiAccountQuotaDashboard`: Pass a refresh handler `onAccountAdded={loadData}` to `AddAccountModal`.

---

## 6. Final Classification

```text
FINAL CLASSIFICATION:
ROOT_CAUSE_PROVEN
EXECUTION_STOPPED_AFTER_FORENSIC_AUDIT
```
