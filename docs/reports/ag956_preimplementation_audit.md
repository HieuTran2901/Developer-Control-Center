# AG-9.56 — PRE-IMPLEMENTATION AUDIT REPORT

```text
STATUS:               AUDIT_VERIFIED
DATE:                 2026-08-16
PROTECTED BASELINES:  1. AG-9.41 AI Quota Subsystem Release Freeze (Commit: 18acaa6, Invariants I1-I18)
                      2. AG-9.47 Multi-Instance Runtime Discovery
                      3. AG-9.49 Google OAuth Primary + Antigravity Fallback
                      4. AG-9.50 OAuth Security & Correctness Audit
                      5. AG-9.51 Google OAuth Connect UI/UX
                      6. AG-9.52 Post-OAuth Persistence Forensic Audit
                      7. AG-9.53 Cloud Code Quota API Correction
                      8. AG-9.54 Google OAuth Client Pairing & State Hardening
                      9. AG-9.55 Forensic Finding: invalid_grant
```

---

## 1. Verified Audit Targets & Root Cause Analysis

### Target 1: `invalid_grant` Specific Classification (`GoogleCloudCodeQuotaProvider`)
- **Current Defect**: When Google Token Endpoint returns `HTTP 400 Bad Request: {"error": "invalid_grant"}`, `refresh_access_token` treats it as generic `OAuthRefreshFailed`, which collapses into generic `Unsupported` / `AuthRequired`.
- **Required Implementation**:
  - Parse the error response from `https://oauth2.googleapis.com/token`.
  - When `error == "invalid_grant"`, emit `QuotaProviderErrorKind::ReauthorizationRequired`.
  - Map `ReauthorizationRequired` to `ModelQuotaStatus::ReauthorizationRequired` and `AccountPollingState::ReauthorizationRequired`.

### Target 2: Stop Refresh Storms (`QuotaPollingEngine`)
- **Current Defect**: Background polling loop repeatedly tries to refresh invalid refresh tokens every interval (e.g. 120s/300s).
- **Required Implementation**:
  - Skip automatic polling attempts for accounts with `status == AccountPollingState::ReauthorizationRequired` until explicit user reconnect or fresh credential save.

### Target 3: Atomic Keyring Credential Replacement (`GoogleOAuthService::start_oauth_flow`)
- **Safety Rule**:
  - Never delete the old credential before new OAuth exchange succeeds.
  - On callback, validate identity `expected_email == auth_email` (mismatch fails closed, old credential is kept).
  - On success, atomically overwrite Keyring entry for the target `accountId`.
  - Immediately trigger `refresh_account_now(account_id)` to rehydrate live quota snapshot.

### Target 4: UI Recovery UX (`QuotaAccountCard.tsx`)
- **Required Implementation**:
  - For `ReauthorizationRequired`, display:
    - Title: `"Google Reauthorization Required"`
    - Message: `"Your Google authorization has expired or been revoked. Please reconnect your account."`
    - Action: `"Reconnect Google Account"` (Primary button).
  - Upon reconnection, transition state to `Checking` $\rightarrow$ `Online: Google Cloud Code · Primary`.

---

## 2. Invariants & Multi-Account Isolation Verification

- **Invariants I1–I18**: 100% Preserved. Max concurrent refreshes (2), deterministic ordering, and removal protection intact.
- **Account Scoping**: Reauthorizing Account A will never alter Account B's credential, status, or quota snapshot.
