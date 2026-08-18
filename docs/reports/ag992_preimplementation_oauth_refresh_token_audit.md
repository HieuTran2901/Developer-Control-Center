# AG-9.92 — PRE-IMPLEMENTATION GOOGLE OAUTH REFRESH TOKEN AUDIT REPORT

```text
STATUS:               PRE_IMPLEMENTATION_AUDIT_COMPLETED
DATE:                 2026-08-17
AUDIT MODE:           STRICT READ-ONLY FORENSIC & DESIGN AUDIT
TARGET DEFECT:        Google OAuth Returns Access Token but Omits Refresh Token on Add Account / Reconnect
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
```

---

## 1. Forensic Audit of the Complete OAuth Chain

```text
Connect with Google ("new" or accountId)
    ↓
authorization URL construction (PKCE S256, access_type=offline, prompt=consent select_account)
    ↓
Browser authentication & consent
    ↓
Loopback callback (/oauth/callback)
    ↓
exchange_auth_code (POST https://oauth2.googleapis.com/token)
    ↓
TokenResponse deserialization (access_token: String, refresh_token: Option<String>)
    ↓
[DIVERGENCE POINT IN CURRENT SYSTEM]:
- If Google omits refresh_token (refresh_token: None):
  - For NEW accounts: System checked existing Keyring token under derived ID. If invalid or missing, it returned failure, but if previously registered in some flows, left a broken account.
  - For EXISTING accounts: Stale revoked token was preserved or unpurged due to Windows Credential Manager legacy target mismatch.
```

---

## 2. Root Cause Analysis: Why Google Omits `refresh_token`

1. **Google Identity Consent Model**:
   - Google's OAuth 2.0 Authorization Server issues a `refresh_token` **only upon first authorization** or when explicit consent is refreshed.
   - When an application OAuth Client ID already has active consent recorded in Google Account settings (`https://myaccount.google.com/connections`), subsequent authorizations often return **only an `access_token`** and set `refresh_token = null`, even when `prompt=consent` is present in the authorization URL.
2. **Revocation Desynchronization**:
   - If the refresh token was previously revoked or expired on Google's backend, but Google still considers the client app connected in the user's account settings:
     - Google authorization code exchange succeeds.
     - Google returns `access_token` and `refresh_token: null`.
     - DCC has no valid refresh token for background monitoring.
     - The account becomes `AuthRequired` on the very first background poll.

---

## 3. Architecture Specification for Credential Transaction & Recovery

### Case A: New Account (`target_account.is_none()`)
- If `refresh_token` is returned by Google:
  1. Perform transactional token refresh test against `https://oauth2.googleapis.com/token`.
  2. If test succeeds: Save to Keyring $\rightarrow$ Save to `account_registry.json` $\rightarrow$ Trigger initial quota refresh $\rightarrow$ Return `Connected` (`success: true`).
  3. If test fails: Rollback (do NOT save to Keyring, do NOT register account in registry) $\rightarrow$ Return `TokenVerificationFailed` (`success: false`).
- If `refresh_token` is **omitted** by Google (`refresh_token.is_empty()`):
  1. Rollback: Do NOT register account in `account_registry.json`.
  2. Do NOT create snapshot in `PollingEngine`.
  3. Return typed `MissingRefreshToken` (`success: false`) with clear user recovery instructions:
     *"Google authentication succeeded, but Google did not provide a refresh token for persistent background monitoring. Please revoke DCC access in https://myaccount.google.com/connections and connect again."*

### Case B: Reconnect Existing Account (`target_account.is_some()`)
- If `refresh_token` is returned by Google:
  1. Test token refresh $\rightarrow$ If valid, commit to Keyring, update registry timestamp, trigger quota refresh $\rightarrow$ Return `Connected` (`success: true`).
- If `refresh_token` is **omitted** by Google:
  1. Test existing Keyring token:
     - If existing token is **valid**: Preserve it, update registry timestamp, trigger quota refresh $\rightarrow$ Return `Connected` (`success: true`).
     - If existing token is **invalid** (`invalid_grant`): Purge stale token from Keyring (`delete_refresh_token`) $\rightarrow$ Return `ReauthorizationRequired` (`success: false`) with recovery instructions to revoke access at `https://myaccount.google.com/connections`.

---

## 4. Keyring Deletion Robustness on Windows

- On Windows, credentials may be written or indexed under `accountId.developer-control-center:antigravity-oauth` or `LegacyGeneric:target=accountId.developer-control-center:antigravity-oauth`.
- We will ensure `delete_refresh_token` attempts all known target variations so dead tokens are 100% removed and never resurrected.

---

## 5. UI Recovery Experience

- In `AddAccountModal.tsx` and `MultiAccountQuotaDashboard.tsx`:
  - When `connectGoogleAccount` fails with `MissingRefreshToken` or `ReauthorizationRequired`, display a prominent contextual alert with explicit recovery steps and link to Google Account Connections.
  - Never mark an un-persisted or un-credentialed account as connected.
