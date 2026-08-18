# AG-9.86 — POST-RECONNECT ACCOUNT 3 AUTH REQUIRED ROOT-CAUSE FORENSIC AUDIT REPORT

```text
STATUS:               AUDIT_COMPLETED
DATE:                 2026-08-17
AUDIT MODE:           STRICT READ-ONLY FORENSIC AUDIT (ZERO SOURCE CODE MODIFIED)
CLASSIFICATION:       ROOT_CAUSE_PROVEN
PRIMARY ROOT CAUSE:   D. Missing refresh_token & G. Credential reload/consumption failure
                      (Google omitted refresh_token on reauthorization; running binary preserved stale invalid_grant Keyring token)
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
```

---

## 1. Reconnect Transaction Timeline (T1 → T14)

| Step | Stage | Forensic Evidence | Result |
| :--- | :--- | :--- | :--- |
| **T1** | Reconnect Initiation | Target: `nakitosan912-gmail-com` (`nakitosan912@gmail.com`) | **PASS** |
| **T2** | OAuth Authorization Request | Google auth endpoint launched with PKCE S256 code challenge | **PASS** |
| **T3** | OAuth Callback | Loopback receiver accepted callback; state matched | **CALLBACK = SUCCESS** |
| **T4** | Token Exchange | Google returned `access_token`, but **omitted `refresh_token`** | **DIVERGENCE 1** |
| **T5** | Refresh Token Evaluation | Running binary preserved stale Keyring token without validity test | **DIVERGENCE 2** |
| **T6** | UserInfo Verification | Validated identity = `nakitosan912@gmail.com` | **IDENTITY_MATCH = PASS** |
| **T7** | Keyring Transaction | Keyring retained old token `1//...` (length 206 bytes) | **FAIL** |
| **T8** | Registry Update | Registry updated (`updatedAt: 1786946516`, `provider: google_cloud_code`) | **PASS** |
| **T9** | Snapshot Reset | Transient `Checking` state | **PASS** |
| **T10**| Polling Dispatch | `refresh_account_now` dispatched for `nakitosan912-gmail-com` | **PASS** |
| **T11**| Cloud-Direct Request | **BLOCKED** during token refresh; never reached Cloud-Direct backend | **BLOCKED** |
| **T12**| Final State Transition | Google rejected stale token with `HTTP 400 invalid_grant` $\rightarrow$ `AuthRequired` | **ROOT CAUSE EVENT** |
| **T13**| UI State Source | UI is truthful: renders backend snapshot `status: AuthRequired` | **PASS** |
| **T14**| Cross-Account Safety | Account 1 & Account 2 credentials and snapshots 100% untouched | **PASS** |

---

## 2. Expected vs Actual

```text
EXPECTED:
Reconnect -> Google OAuth -> fresh refresh_token written to Keyring -> token refresh PASS -> Cloud-Direct query -> Online (Sync Pending / Connected)

ACTUAL:
Reconnect -> Google OAuth -> Google omitted refresh_token -> running binary preserved old Keyring token -> token refresh FAIL (HTTP 400 invalid_grant) -> AuthRequired
```

---

## 3. First Divergence

- **First Divergence**: **Step T4 / T5**: During code exchange, Google returned `refresh_token: None`. The running binary did not detect that the existing Keyring token was dead (`invalid_grant`), preserved the dead token, and reported success to the frontend, which immediately triggered a poll with the dead token.

---

## 4. Exact Error

```json
HTTP 400 Bad Request
{
  "error": "invalid_grant",
  "error_description": "Bad Request"
}
```

---

## 5. Exact Component Responsible

- **`src-tauri/src/monitor/quota_oauth.rs`** (`start_oauth_flow` lines 398–414):
  - When `refresh_token.is_empty()`, the running binary previously preserved `existing_token` without verifying if `existing_token` could actually refresh an access token.
- **Process Compilation State**:
  - The running desktop process (`developer-control-center.exe` PID 9476, started at 1:00:57 PM) was launched before our AG-9.85 Rust source changes were built into the running executable binary.

---

## 6. Audit Questionnaire Answers

1. **Were AG-9.85 Claims Actually Verified at Runtime?**
   - Source code was updated, but the running Tauri process had not restarted with the newly built binary.
2. **Was Account 3 Keyring Updated?**
   - **NO**. The Keyring retains the old token `1//...` (length 206 bytes) which Google rejects with `HTTP 400 invalid_grant`.
3. **Did Account 3 Token Refresh Succeed?**
   - **NO**. Direct probe confirmed Google rejected the token with `HTTP 400 invalid_grant`.
4. **Did Account 3 Reach Cloud-Direct?**
   - **NO**. The request was blocked at Step T11 during token refresh before any HTTPS call to `daily-cloudcode-pa.googleapis.com` could be made.
5. **Is `AuthRequired` Backend-True or UI-Cached?**
   - **BACKEND-TRUE**. The backend polling engine genuinely received `HTTP 400 invalid_grant` and set `snapshot.status = AuthRequired`. The UI is rendering the accurate backend truth.

---

## 7. Root Cause Classification

```text
PRIMARY ROOT CAUSE CLASSIFICATION:
D. Missing refresh_token & G. Credential reload/consumption failure
```

---

## 8. Minimal Fix Scope

1. **Enforce `prompt=consent`**:
   - Ensure the Google OAuth URL always includes `prompt=consent select_account` so Google cannot omit `refresh_token`.
2. **Transactional Reconnect Rejection on Omitted Token**:
   - If Google ever returns `refresh_token.is_empty()` during reconnect on an `AuthRequired` account, DCC must immediately test the existing token. If invalid, purge it from Keyring and return `MissingRefreshToken` so the user is informed to consent, rather than falsely reporting `Connected`.
3. **Rebuild Binary**:
   - Ensure the updated Rust binary is compiled into `target/debug/developer-control-center.exe`.

---

## 9. Final Classification

```text
FINAL CLASSIFICATION:
ROOT_CAUSE_PROVEN
EXECUTION_STOPPED_AFTER_FORENSIC_AUDIT
```
