# AG-9.73 — PRE-IMPLEMENTATION AUDIT: CLOUD CREDENTIAL RECOVERY & UI STATE CORRECTION

```text
STATUS:               AUDIT_COMPLETED
DATE:                 2026-08-17
AUDIT MODE:           PRE-IMPLEMENTATION READ-ONLY INVESTIGATION
CLASSIFICATION:       READY_FOR_IMPLEMENTATION
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
```

---

## 1. Executive Summary

This audit establishes the pre-implementation baseline for AG-9.73 based on the proven findings of AG-9.72A:
1. **UI State Mapping Defect in `AccountQuotaTable.tsx`**:
   - Accounts in non-Online states (`Checking`, `Unknown`, `NetworkError`, `ProviderError`) with `quota == null` were incorrectly falling through to `Connected` and `Healthy` badges.
   - AG-9.73 will enforce the strict rule: `Connected` and `Healthy` may **ONLY** be rendered when `snapshot.status === 'Online' && snapshot.quota !== null`.
2. **Account-Scoped Credential Recovery**:
   - Each Google account (`account 1`, `account 2`, `account 3`, `account 4`) is independently managed under its dedicated Keyring namespace: `<accountId>.developer-control-center:antigravity-oauth`.
   - Google Cloud Code Primary remains 100% cloud-direct over HTTPS with 0 `language_server.exe` dependencies.
   - Provider precedence and strict identity mismatch protections remain 100% intact.

---

## 2. UI State Transition Matrix for `AccountQuotaTable.tsx`

| Snapshot Status | Snapshot Quota | Account Sub-Badge | Status Column Text | Status Dot Color | 5H Column Display | Recommendation Column |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`Online`** | Valid `ModelQuota` | `Connected` (Green) | `Healthy` / `Warning` | Green / Amber | `XX.X%` + Progress Bar | `#Rank` + Confidence |
| **`Online`** | `null` | `Connected` (Green) | `Data Pending` (Blue) | Blue | `Syncing...` | `Data unavailable` |
| **`Checking`** | Any | `Checking` (Blue) | `Checking...` (Blue) | Blue (Pulse) | `Checking...` | `Checking status` |
| **`AuthRequired`** | Any | `Auth Required` (Red) | `Auth Required` (Red) | Red | `— (Reauthenticate)` | `Auth required` |
| **`ReauthRequired`**| Any | `Reauth Required` (Red)| `Reauth Required` (Red)| Red | `— (Reauthenticate)` | `Auth required` |
| **`IdentityMismatch`**| Any | `Mismatch` (Amber) | `Account Mismatch` | Amber | `— (Identity mismatch)`| `Identity mismatch` |
| **`NetworkError`** | Stale quota | `Stale` (Purple) | `Stale (Network)` (Purple)| Purple | `XX.X%` (Stale) | `Sync delayed` |
| **`NetworkError`** | `null` | `Offline` (Amber) | `Network Error` (Amber) | Amber | `— (Network error)` | `Network error` |
| **`ProviderError`** | `null` | `Offline` (Amber) | `Provider Error` (Amber)| Amber | `— (Provider error)` | `Provider error` |
| **`RateLimited`** | Any | `Rate Limited` (Amber)| `Rate Limited` (Amber) | Amber | `— (Rate limited)` | `Rate limited` |
| **`Disabled`** | Any | `Disabled` (Muted) | `Disabled` (Muted) | Muted Gray | `— (Disabled)` | `Inactive` |

---

## 3. Account-Scoped Credential Recovery Workflow

```text
[User clicks "Connect Google" on Account X]
       ↓
[start_oauth_flow(accountId = X)]
       ↓
[Loopback TCP server on 127.0.0.1:<port> with 120s timer]
       ↓
[Browser Google Auth with prompt=select_account consent]
       ↓
[Code exchange -> access_token + refresh_token]
       ↓
[Google Userinfo API -> verifies user_email == target.email]
       ↓
[Save refresh_token -> Keyring: <accountId>.developer-control-center:antigravity-oauth]
       ↓
[Immediate CloudDirect Quota Verification]
  1. POST oauth2/token (refresh)
  2. GET oauth2/v2/userinfo
  3. POST loadCodeAssist
  4. POST retrieveUserQuotaSummary
  5. Build ModelQuota & AccountQuotaSnapshot
       ↓
[Account X transitions to Online with live quota]
```

---

## 4. Final Classification

```text
FINAL CLASSIFICATION:
READY_FOR_IMPLEMENTATION
```
