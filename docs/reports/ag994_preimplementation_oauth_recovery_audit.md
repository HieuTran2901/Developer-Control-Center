# AG-9.94 — PRE-IMPLEMENTATION GOOGLE OAUTH GRANT RECOVERY & REFRESH TOKEN LIFECYCLE AUDIT REPORT

```text
STATUS:               PRE_IMPLEMENTATION_AUDIT_COMPLETED
DATE:                 2026-08-17
AUDIT MODE:           STRICT READ-ONLY FORENSIC & ARCHITECTURAL AUDIT
TARGET DEFECT:        Google OAuth Grant Recovery Stalemate (Consent Reuse + Dead Token)
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
                      46. AG-9.90 Google OAuth Account Add UI State Synchronization Fix
                      47. AG-9.91 New Google Account Auth Required Forensic Audit
                      48. AG-9.92 Google OAuth Refresh Token Acquisition & Credential Recovery Fix
                      49. AG-9.93 Post-AG-9.92 Auth Required Credential Identity & Runtime Path Forensic Audit
                      50. AG-9.94 Google OAuth Grant Recovery & Refresh Token Lifecycle Hardening
```

---

## 1. Forensic Audit of the Grant Recovery Defect

### Current Lifecycle Behavior:
1. When a user authenticates in Google's browser window, Google verifies the user's identity and returns an authorization code.
2. During code exchange (`POST https://oauth2.googleapis.com/token`), Google issues an ephemeral `access_token` (valid for 3600 seconds) but **omits `refresh_token`** because Google's Authorization Server already has consent recorded for that user on DCC's OAuth Client ID.
3. If the stored refresh token in DCC's OS Keyring was previously revoked or expired on Google's backend, DCC has **no working refresh token** for background monitoring.
4. On subsequent attempts to "Reconnect" or "Add Account", Google repeats the exact same response (`access_token` present, `refresh_token` absent), leaving the account stuck in `AuthRequired` indefinitely.

---

## 2. Root Cause & Solution: Programmatic Grant Revocation & Recovery

### Why `prompt=consent` is not sufficient alone:
In Google OAuth 2.0 architecture, when an OAuth grant exists on Google's backend, Google's Authorization Server may treat `prompt=consent` as an account confirmation step and still omit the `refresh_token` in the token exchange response unless the existing grant is formally revoked.

### Programmatic Grant Revocation Mechanism:
1. Google provides a standard Token Revocation Endpoint:
   `POST https://oauth2.googleapis.com/revoke` with `token={access_token}`.
2. When DCC receives an `access_token` from Google during code exchange, but Google omits `refresh_token` AND the existing Keyring token is dead (`invalid_grant`), DCC can programmatically revoke the grant using that `access_token`.
3. Calling `https://oauth2.googleapis.com/revoke` deletes the stale grant from Google's authorization servers.
4. On the subsequent user connection/reconnection attempt, Google detects that NO active consent grant exists, forces a full consent prompt, and **issues a brand new `refresh_token`**.
5. DCC receives the new `refresh_token`, validates it via `POST https://oauth2.googleapis.com/token`, commits it to Keyring, updates the registry, starts polling, and successfully transitions to `Connected`.

---

## 3. Explicit Credential State Architecture

| Credential State | Meaning | Action Taken |
| :--- | :--- | :--- |
| `Connected` | Valid refresh token persisted & validated; Cloud-Direct operational. | Background polling active |
| `MissingRefreshToken` | Google returned access token only for new account; grant reset triggered. | Atomic rollback, no broken account added |
| `ReauthorizationRequired` | Existing refresh token invalid; grant reset triggered. | Dead token purged, user prompted to re-grant |
| `GrantRecoveryRequired` | Stale grant detected; grant revoked on Google; ready for re-consent. | Dedicated UI button "Recover Google Authorization" |
| `TokenVerificationFailed` | Fresh refresh token rejected by Google Token Endpoint. | Rollback, credential not committed |

---

## 4. Implementation Plan

1. **Backend (`src-tauri/src/monitor/quota_oauth.rs`)**:
   - Add `GOOGLE_REVOKE_ENDPOINT` (`https://oauth2.googleapis.com/revoke`).
   - Implement `revoke_token(&self, token: &str) -> Result<bool, QuotaProviderError>`.
   - Update `start_oauth_flow`: When `refresh_token.is_empty()` and existing Keyring token is dead/missing, call `revoke_token(&access_token)` to reset Google's grant, purge dead Keyring credentials, and return `GrantRecoveryRequired`.
2. **Backend (`src-tauri/src/monitor/quota_polling.rs`)**:
   - Ensure accounts in `ReauthorizationRequired` / `AuthRequired` do not endlessly hammer Google Token Endpoint during periodic sweeps.
3. **Frontend (`AddAccountModal.tsx`, `MultiAccountQuotaDashboard.tsx`, `QuotaAccountCard.tsx`)**:
   - Render dedicated "Recover Google Authorization" / "Reconnect" recovery cards with automated 1-click retry.
