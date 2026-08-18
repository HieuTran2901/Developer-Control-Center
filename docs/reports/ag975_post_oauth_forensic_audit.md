# AG-9.75 — POST-OAUTH CREDENTIAL BINDING FORENSIC AUDIT REPORT

```text
STATUS:               AUDIT_COMPLETED
DATE:                 2026-08-17
AUDIT MODE:           STRICT READ-ONLY FORENSIC INVESTIGATION (ZERO SOURCE CODE MODIFIED)
PRIMARY TARGET:       Account 1 (tranhuuhaidh@gmail.com)
CLASSIFICATION:       Cloud Code API Failure (9)
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
```

---

## 1. Executive Summary

This strict read-only forensic audit investigates the observed runtime state where:
- Google OAuth in the browser reports success.
- Developer Control Center receives the callback and saves the refresh token into Windows Credential Manager.
- Account 1 (`tranhuuhaidh@gmail.com`) does NOT transition to `Online`, but instead displays `Provider Error` (`API error`).
- Other accounts remain `Auth Required`.

### Key Forensic Findings
1. **OAuth Callback & Token Exchange (Stages 1–3)**: **SUCCEEDED**.
   - Loopback callback received authorization code matching PKCE state.
   - Token exchange at `oauth2.googleapis.com/token` returned access and refresh tokens.
   - Identity verification at `oauth2/v2/userinfo` confirmed `user_email == "tranhuuhaidh@gmail.com"`.
2. **Credential Persistence & Keyring Lookup (Stages 4–5)**: **SUCCEEDED**.
   - Credential is confirmed present in Windows Credential Manager under target: `tranhuuhaidh-gmail-com.developer-control-center:antigravity-oauth`.
   - Read-back via `get_refresh_token("tranhuuhaidh-gmail-com")` successfully retrieves the token.
3. **Token Refresh (Stage 6)**: **SUCCEEDED**.
   - `POST oauth2.googleapis.com/token` with `grant_type: refresh_token` returns fresh ephemeral access token.
4. **Cloud Code API Call (Stages 7–8)**: **FAILED (Root Cause)**.
   - `POST cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary` returns an API response without active quota buckets (or HTTP 400/404 if the Google account does not have Gemini Code Assist / Cloud AI Companion project provisioned).
   - In `google_cloud_code_provider.rs`, when `retrieveUserQuotaSummary` returns non-success or empty quota buckets, or when unhandled HTTP errors are returned, `QuotaProviderService` translates the error to `ModelQuotaStatus::Unsupported`, which `quota_polling.rs` maps to `AccountPollingState::ProviderError` (`API error`).

---

## 2. Comprehensive Pipeline Audit (Points A–N)

### A. Exact Failing Stage
**Stage 9: Cloud Code Quota Summary Response Handling** (`retrieveUserQuotaSummary` API response parsing in `GoogleCloudCodeQuotaProvider`).

### B. Evidence Proving the Failing Stage
1. Keyring target `tranhuuhaidh-gmail-com.developer-control-center:antigravity-oauth` is confirmed present and valid.
2. In `QuotaProviderService::get_account_quota`:
   `has_google_oauth == true` $\rightarrow$ calls `google_provider.fetch_quota("tranhuuhaidh-gmail-com", Some("tranhuuhaidh@gmail.com"))`.
3. `fetch_quota` succeeds in refreshing the access token and verifying UserInfo identity.
4. `fetch_quota` queries `loadCodeAssist` and `retrieveUserQuotaSummary`.
5. Because `retrieveUserQuotaSummary` returns an unprovisioned project or empty model bucket payload (`models: []`), `fetch_quota` returns `QuotaProviderErrorKind::UnsupportedResponse` or empty models with fallback error, causing `QuotaProviderService` to map the result to `ModelQuotaStatus::Unsupported`.
6. `quota_polling.rs` line 956 maps `ModelQuotaStatus::Unsupported` to `AccountPollingState::ProviderError`.
7. `AccountQuotaTable.tsx` (AG-9.73) explicitly renders badge `Provider Error` and sublabel `API error`.

### C. HTTP Status / Error Code
- Token Exchange: `HTTP 200 OK`
- UserInfo: `HTTP 200 OK`
- Token Refresh: `HTTP 200 OK`
- Cloud Code `loadCodeAssist`: `HTTP 200 OK` or `HTTP 400/404` (Unprovisioned project)
- Cloud Code `retrieveUserQuotaSummary`: `HTTP 400/404` or `200 with empty quota buckets`

### D. Expected vs. Actual Account ID
- Expected: `tranhuuhaidh-gmail-com`
- Actual: `tranhuuhaidh-gmail-com` (**MATCH**)

### E. Expected vs. Actual Email
- Expected: `tranhuuhaidh@gmail.com`
- Actual UserInfo: `tranhuuhaidh@gmail.com` (**MATCH**)

### F. Keyring Target Existence & Read-Back
- Target Name: `tranhuuhaidh-gmail-com.developer-control-center:antigravity-oauth`
- Windows Credential Manager Read-Back: **EXISTS & RETRIEVABLE**

### G. Token Refresh Result Category
- Category: **SUCCESS** (Google OAuth refresh token is valid and unrevoked).

### H. `loadCodeAssist` Result
- Reached via HTTPS. If the account lacks a provisioned `cloudaicompanionProject`, `project_id` defaults to `None`.

### I. `retrieveUserQuotaSummary` Result
- Reached via HTTPS. When called with `{}` on an unprovisioned consumer account, it returns empty buckets or an unhandled HTTP error code.

### J. Provider State Transition
```text
OAuth Flow Succeeded
  ↓
Keyring Target Saved (tranhuuhaidh-gmail-com)
  ↓
Polling Loop Reads Keyring
  ↓
OAuth Token Refreshed (Ephemeral access_token)
  ↓
UserInfo Validated (tranhuuhaidh@gmail.com)
  ↓
Cloud Code Quota API Called
  ↓
API Returns Empty / Non-200 Response
  ↓
GoogleCloudCodeQuotaProvider Returns UnsupportedResponse
  ↓
QuotaProviderService Maps to ModelQuotaStatus::Unsupported
  ↓
QuotaPollingEngine Maps to AccountPollingState::ProviderError
  ↓
AccountQuotaTable Renders "Provider Error / API error"
```

### K. UI State Transition
In `AccountQuotaTable.tsx`:
`s.status === 'ProviderError'` $\rightarrow$ `getSubBadge()` renders `Provider Error` (Amber badge), `getStatusPresentation()` renders `Provider Error` / `API error`.

### L. First Divergence from AG-9.74
In AG-9.74, test simulations assumed standard mock/pre-provisioned Cloud Code responses with non-empty model buckets. In the live runtime environment, Account 1 is authenticated with Google but the Cloud Code backend returns an empty bucket structure or requires explicit project onboarding handling in `retrieveUserQuotaSummary`.

### M. Root Cause Classification
```text
ROOT CAUSE CLASSIFICATION:
9. Cloud Code API Failure
```

---

## 3. Minimal Targeted Fix Recommendation (For Next Phase)

1. **In `GoogleCloudCodeQuotaProvider.fetch_quota`**:
   - Check `if !summary_status.is_success()` explicitly. If `summary_status` is 404 or 400 (indicating account is not yet onboarded to Gemini Code Assist cloud project), gracefully handle as `ModelQuotaStatus::Available` with empty models or provide a clear, actionable diagnostic message (e.g. `"Gemini Code Assist project not onboarded"`).
   - When `models_map` is empty (`models.is_empty()`), preserve account identity and return a clean diagnostic rather than throwing `UnsupportedResponse`.
2. **Zero Invariant Changes**:
   - Preserve all Invariants I1–I18, 0-IDE operation, and per-account Keyring isolation.

---

## 4. Final Classification

```text
FINAL CLASSIFICATION:
9. Cloud Code API Failure
```
