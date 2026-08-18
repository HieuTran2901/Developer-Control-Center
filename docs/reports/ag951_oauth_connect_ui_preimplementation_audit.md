# AG-9.51 — GOOGLE OAUTH MULTI-ACCOUNT CONNECT UI PRE-IMPLEMENTATION AUDIT

```text
STATUS:               AUDIT_COMPLETED
AUDIT MODE:           PHASE 0 READ-ONLY FORENSIC AUDIT
DATE:                 2026-08-16
PROTECTED BASELINES:  1. AI Quota Subsystem (Release Frozen at AG-9.41, Commit: 18acaa6, Invariants I1-I18)
                      2. AG-9.45 Release Candidate Ready
                      3. AG-9.47 Multi-Instance Runtime Routing Active
                      4. AG-9.49 Google OAuth Primary + Antigravity Fallback Quota Architecture
                      5. AG-9.50 OAuth Security & Correctness Audit (OAUTH_MULTI_ACCOUNT_SAFE)
```

---

## 1. Executive Summary

A comprehensive read-only audit of existing frontend components, Tauri commands, IPC interfaces, and OAuth services was completed.

The audit confirms:
- **Backend Capabilities Present**: `GoogleOAuthService` with RFC 7636 PKCE S256, dynamic loopback callback server, and `quota_connect_google_account_cmd` are already implemented.
- **Frontend Integration Required**:
  1. Add a **"Connect Google Account"** button and interactive OAuth status lifecycle inside `AddAccountModal.tsx` and `QuotaAccountCard.tsx`.
  2. Add `quota_disconnect_google_account_cmd` and `quota_get_google_connection_status_cmd` in `src-tauri/src/monitor/mod.rs` to allow users to disconnect Google OAuth without deleting the DCC account.
  3. Display clear **Primary / Fallback Provider Badges** (`Google Cloud Code (Primary)` vs `Antigravity (Fallback)`) on each account card without redesigning the dashboard or exposing credentials.

---

## 2. Files Inspected & Audit Findings

| File | Subsystem | Current State | Required Modification in AG-9.51 |
| :--- | :--- | :--- | :--- |
| `src-tauri/src/monitor/mod.rs` | Tauri IPC Commands | Has `quota_connect_google_account_cmd` | Add `quota_disconnect_google_account_cmd` & `quota_get_google_connection_status_cmd` |
| `src-tauri/src/monitor/quota_oauth.rs` | OAuth Service | Complete PKCE S256 Loopback Server | Add helper `disconnect_account(accountId)` |
| `src/application/services/QuotaPollingService.ts` | Frontend Service Gateway | Has `connectGoogleAccount()` | Add `disconnectGoogleAccount()` & `getGoogleConnectionStatus()` |
| `src/features/settings/components/AddAccountModal.tsx` | Account Registration Modal | Manual text inputs | Add one-click **"Connect with Google"** OAuth flow |
| `src/features/settings/components/QuotaAccountCard.tsx` | Account Quota Card | Shows status and quota pools | Add Provider Badge (`Primary` vs `Fallback`) and Connect / Disconnect Google actions |

---

## 3. Account Identity & Security Boundaries

- **Immutable Identity**: `accountId` remains the immutable DCC identifier throughout the OAuth flow.
- **Identity Invariant**: `authenticated_email == expected_email` is strictly verified. Mismatches prompt the user or fail closed.
- **Credential Storage**: Refresh tokens reside strictly in the OS Keyring (Windows Credential Manager via `KeyringCredentialStorage`). Zero tokens reach React state, IPC payloads, or persisted JSON.
- **Dual Resurrection Gate**: Late events are blocked by `AccountRegistry.get()` and frontend `index < 0` rejection.

---

## 4. Implementation Boundary Definition

- **Allowed Changes**:
  1. Frontend OAuth connect/disconnect workflow & state machine.
  2. Account card provider badge & action menu options.
  3. Tauri command registration for disconnect and connection status check.
  4. Documentation & Decision #41.
- **Strictly Prohibited**:
  1. Quota calculation algorithm refactoring.
  2. Quota aggregation or global pooling.
  3. Storing tokens in frontend state or JSON.
  4. Modifying invariants I1–I18.
