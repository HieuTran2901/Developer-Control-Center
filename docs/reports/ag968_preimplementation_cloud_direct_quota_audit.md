# AG-9.68 — PRE-IMPLEMENTATION CLOUD-DIRECT QUOTA AUDIT REPORT

```text
STATUS:               STAGE_1_AUDIT_COMPLETED
DATE:                 2026-08-17
AUDIT MODE:           STRICT READ-ONLY FORENSIC AUDIT (ZERO SOURCE CODE MODIFIED)
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
```

---

## 1. Executive Summary & Required Audit Answers

| Forensic Audit Question | Audit Finding & Evidence |
| :--- | :--- |
| **1. Is Google OAuth already sufficient for Cloud Code quota access?** | **YES, CONFIRMED.** The DCC-owned OAuth 2.0 PKCE client requests scopes `https://www.googleapis.com/auth/cloud-platform`, `https://www.googleapis.com/auth/userinfo.email`, and `openid`, which grants authorization to query Google Cloud Code internal APIs. |
| **2. Which scopes are currently requested?** | `https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/cloud-platform openid` ([`quota_oauth.rs:28-29`](file:///E:/Github%20project/Developer-Control-Center/src-tauri/src/monitor/quota_oauth.rs#L28-L29)). |
| **3. Which token is used for `loadCodeAssist`?** | The ephemeral `access_token` generated in memory via `POST https://oauth2.googleapis.com/token` (`grant_type=refresh_token`) using the account's refresh token from Windows Credential Manager. |
| **4. Which token is used for `retrieveUserQuotaSummary`?** | The same ephemeral `access_token` passed as `Authorization: Bearer <access_token>`. |
| **5. How is `cloudaicompanionProject` obtained?** | Parsed from the response body of `POST https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist` (`cloudaicompanionProject` field). |
| **6. How is quota mapped into `ModelQuota`?** | Parsed from `groups[].buckets[]` in `retrieveUserQuotaSummary` and mapped into 5H and Weekly buckets with reset countdowns. |
| **7. Can the existing provider support multiple accounts?** | **YES.** Storage is strictly keyed by `<accountId>.developer-control-center:antigravity-oauth`, polling executes concurrently via `tokio::sync::Semaphore(2)`, and each account carries its own `expected_email`. |
| **8. Where does `language_server.exe` enter the execution path?** | Only if `provider == Antigravity` (explicit user selection) or as an optional fallback when Google Cloud Code returns an error and a matching local runtime is running. In healthy Google Primary operation, `language_server.exe` is **100% bypassed**. |
| **9. Which components must be changed/verified?** | The existing [`GoogleCloudCodeQuotaProvider`](file:///E:/Github%20project/Developer-Control-Center/src-tauri/src/monitor/providers/google_cloud_code_provider.rs) already embodies the Cloud-Direct architecture. Stage 2 will verify full multi-account operation with 0 running IDEs and document all invariants. |

---

## 2. Request Flow Architecture

```text
DCC Account (accountId, expectedEmail)
              │
              ▼
    QuotaPollingEngine
(MAX_CONCURRENT_REFRESHES = 2)
              │
              ▼
GoogleCloudCodeQuotaProvider::fetch_quota()
              │
  1. Keyring Lookup (<accountId>.developer-control-center:antigravity-oauth)
  2. POST https://oauth2.googleapis.com/token (grant_type=refresh_token)
     -> Ephemeral access_token (in-memory only)
  3. GET https://www.googleapis.com/oauth2/v2/userinfo
     -> Verify userinfo.email == expectedEmail
  4. POST https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist
     -> Extract cloudaicompanionProject + currentTier
  5. POST https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary
     -> Extract groups[].buckets[] (5H & Weekly)
              │
              ▼
Canonical ModelQuota Snapshot
(AccountQuotaSnapshot -> QuotaAccountCard)
```

---

## 3. Zero-IDE Independence Confirmation

In Google Primary mode:
- **Zero** calls to `discover_all_runtimes()`.
- **Zero** calls to `language_server.exe`.
- **Zero** local TCP port scans or Netstat invocations.
- **Zero** local Connect-RPC queries.

Google Primary is 100% Cloud-Direct over HTTPS.
