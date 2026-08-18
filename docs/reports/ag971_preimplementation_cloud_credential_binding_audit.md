# AG-9.71 — PRE-IMPLEMENTATION AUDIT: LIVE ANTIGRAVITY CLOUD CREDENTIAL BINDING

```text
STATUS:               AUDIT_COMPLETED
DATE:                 2026-08-17
AUDIT MODE:           STRICT READ-ONLY FORENSIC INVESTIGATION (ZERO CODE MODIFIED)
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
```

---

## 1. Executive Summary

This forensic audit investigates the live runtime state observed across 4 configured accounts:
- **`account 2` (`trunghieu10a1thptll@gmail.com`)**: Displays `Connected` with live quota.
- **`account 1` (`tranhuuhaidh@gmail.com`)**, **`account 3` (`nakitosan912@gmail.com`)**, and **`account 4` (`hieutrankrm204t@gmail.com`)**: Display `Account Identity Mismatch`.

### Key Forensic Finding
The `Account Identity Mismatch` on accounts 1, 3, and 4 is **NOT a quota computation bug or security failure**, but the direct consequence of:
1. **Single Local Runtime Dependency**: Only one `language_server.exe` instance is running on the host system (PID 15252), which is authenticated as `trunghieu10a1thptll@gmail.com`.
2. **Provider Routing Divergence**: When accounts 1, 3, and 4 triggered "Connect Antigravity" or lacked an account-specific OAuth refresh token in Keyring, their quota evaluation routed to the local Antigravity runtime fallback.
3. **Strict Mismatch Protection (AG-9.67)**: Because `tranhuuhaidh@gmail.com != trunghieu10a1thptll@gmail.com`, DCC strictly rejected binding PID 15252's quota to Account 1/3/4, preventing cross-account data contamination.

---

## 2. Current Successful Account 2 Pipeline

```text
[Account 2: trunghieu10a1thptll@gmail.com]
          │
          ▼
QuotaProviderService::get_account_quota()
          │
  ┌───────┴─────────────────────────────────────────┐
  ▼                                                 ▼
Google Cloud Code Primary                 Antigravity Local Runtime Fallback
(Keyring refresh token)                   (PID 15252 on Port 49802)
  │                                                 │
  ▼                                                 ▼
POST https://oauth2.googleapis.com/token  POST /GetUserStatus
-> access_token (in-memory)               -> userStatus.email: "trunghieu10a1thptll@gmail.com"
  │                                                 │
  ▼                                                 ▼
loadCodeAssist & retrieveUserQuotaSummary  find_matching_runtime_for_email()
-> 79.4% 5H / 100.0% Weekly Quota         -> Exact match! (trunghieu == trunghieu)
          │                                         │
          └────────────────┬────────────────────────┘
                           ▼
                 Status: Online (Connected)
                 Live Quota Rendered in UI
```

---

## 3. Current Failing Account 1, 3, 4 Pipeline

```text
[Account 1/3/4: user_other@gmail.com]
          │
          ▼
QuotaProviderService::get_account_quota()
          │
  ┌───────┴─────────────────────────────────────────┐
  ▼                                                 ▼
Google Cloud Code Primary                 Antigravity Local Runtime Fallback
(Keyring refresh token missing or         (PID 15252 on Port 49802)
 provider set to Antigravity)                       │
  │                                                 ▼
  │                                       POST /GetUserStatus
  │                                       -> userStatus.email: "trunghieu10a1thptll@gmail.com"
  │                                                 │
  ▼                                                 ▼
Fallback to Antigravity Provider          find_matching_runtime_for_email()
                                          -> user_other != trunghieu!
                                                    │
                                                    ▼
                                          Status: AuthRequired
                                          Diagnostic: "Account Identity Mismatch"
                                          (Safe rejection: Quota NOT assigned)
```

---

## 4. Root Cause Analysis

| Factor | Investigation Evidence | Conclusion |
| :--- | :--- | :--- |
| **A. Refresh Token Existence** | Windows Credential Manager holds `tranhuuhaidh-gmail-com` and `nakitosan912-gmail-com`. | **Present but may differ in keying (`account_id` vs normalized email)**. |
| **B. Local Runtime State** | Only 1 `language_server.exe` (PID 15252) running, owned by `trunghieu10a1thptll@gmail.com`. | **Causes mismatch when local provider is queried for other emails**. |
| **C. OAuth Client / Scopes** | Scopes `cloud-platform`, `userinfo.email`, `openid` verified operational. | **Valid**. |
| **D. Cloud Code API Rejection** | Cloud Code internal endpoints respond with 200 OK for authenticated Bearer tokens. | **Valid**. |
| **E. Routing Mechanism** | Clicking "Connect Antigravity" sets `provider = Some(Antigravity)`, forcing local query. | **Root cause of persistent mismatch display**. |

---

## 5. End-to-End Credential & Pipeline Trace Table

| Step | Source File | Function | Input Data | Output Data | Account ID Bound | Language Server Dependency |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Add Account** | `AddAccountModal.tsx` | `handleConnectGoogleOAuth` | User input | `AccountMonitorConfig` | Account ID | No |
| **2. PKCE Init** | `quota_oauth.rs` | `PkceSession::new` | Random entropy | Verifier & Challenge | Account ID | No |
| **3. Browser OAuth** | `quota_oauth.rs` | `start_oauth_flow` | Google Auth URL | Authorization Code | Account ID | No |
| **4. Token Exchange** | `quota_oauth.rs` | `exchange_auth_code` | Auth Code + Verifier | Refresh & Access Tokens | Account ID | No |
| **5. UserInfo Check** | `quota_oauth.rs` | `fetch_user_email` | Ephemeral Access Token | Validated Google Email | Account ID | No |
| **6. Keyring Save** | `quota_oauth.rs` | `save_refresh_token` | Refresh Token | Windows Credential Target | `<accountId>` Key | No |
| **7. Token Refresh** | `google_cloud_code_provider.rs` | `refresh_access_token` | Stored Refresh Token | Ephemeral Access Token | Account ID | **NO (0 IDE)** |
| **8. Project Discovery** | `google_cloud_code_provider.rs` | `loadCodeAssist` | Access Token + IDE metadata | `cloudaicompanionProject` | Account ID | **NO (0 IDE)** |
| **9. Quota Summary** | `google_cloud_code_provider.rs` | `retrieveUserQuotaSummary` | Project ID + Access Token | Raw Quota Buckets | Account ID | **NO (0 IDE)** |
| **10. Model Mapping** | `google_cloud_code_provider.rs` | `parse_quota_summary` | Raw JSON | `ModelQuota` Array | Account ID | **NO (0 IDE)** |
| **11. Snapshot Build** | `quota_polling.rs` | `execute_account_refresh` | `ModelQuota` | `AccountQuotaSnapshot` | Account ID | **NO (0 IDE)** |
| **12. UI Render** | `AccountQuotaTable.tsx` | Component Render | Snapshot State | Visual Row & Progress Bars | Account ID | No |

---

## 6. Proposed AG-9.71 Architecture (Pure Cloud-Direct Binding)

1. **Default Provider Enforcement**: Every Google account registered in DCC defaults to `QuotaProviderId::GoogleCloudCode` (Cloud-Direct).
2. **Independent OAuth Binding**: When connecting an account, Google OAuth credentials are saved under the account's unique `accountId` in Keyring.
3. **Decoupled Error Reporting**: When an account lacks Google OAuth credentials, DCC displays `Google Auth Required` rather than querying local `language_server.exe` and producing a confusing `Account Identity Mismatch`.
4. **Isolated Fallback**: Antigravity Local Runtime is queried **only** if explicitly configured for that account or when Google Cloud Code Primary explicitly encounters an unexpected outage.

---

## 7. Final Classification

```text
FINAL CLASSIFICATION:
READY_FOR_IMPLEMENTATION
```
