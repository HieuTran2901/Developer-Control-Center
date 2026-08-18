# AG-9.57 — POST-REAUTH CREDENTIAL CONSUMPTION & PROVIDER STATE FORENSIC AUDIT REPORT

```text
STATUS:               AUDIT_COMPLETED
CLASSIFICATION:       TOKEN_REFRESH_STILL_INVALID_GRANT
SECONDARY_DEFECT:     UI_PROVIDER_STATE_FAILURE
DATE:                 2026-08-16
AUDIT MODE:           STRICT READ-ONLY FORENSIC AUDIT (ZERO SOURCE CODE MODIFICATIONS)
PROTECTED BASELINES:  1. AG-9.41 AI Quota Subsystem Release Freeze (Commit: 18acaa6, Invariants I1-I18)
                      2. AG-9.47 Multi-Instance Runtime Discovery
                      3. AG-9.49 Google OAuth Primary + Antigravity Fallback
                      4. AG-9.50 OAuth Security & Correctness Audit
                      5. AG-9.51 Google OAuth Connect UI/UX
                      6. AG-9.52 Post-OAuth Persistence Forensic Audit
                      7. AG-9.53 Cloud Code Quota API Correction
                      8. AG-9.54 Google OAuth Client Pairing & State Hardening
                      9. AG-9.55 Forensic Finding: invalid_grant
                      10. AG-9.56 Google OAuth Reauthorization Hardening
```

---

## 1. Executive Summary & Answering Core Questions

### Core Question:
> *"After the user successfully reconnects Google OAuth, is DCC actually consuming the NEW credential, and at which exact runtime stage does the account become `AuthRequired`?"*

### Forensic Answers:

1. **Was the credential persisted?**
   - **YES**: Windows Credential Manager entry `nakitosan912-gmail-com.developer-control-center:antigravity-oauth` was updated at `2026-08-16 21:45:21` (Length: 206 chars).
2. **Was the credential retrieved by the provider?**
   - **YES**: `GoogleCloudCodeQuotaProvider::fetch_quota` correctly retrieves the token for `nakitosan912-gmail-com` from OS Keyring.
3. **Why does token refresh still fail with `invalid_grant`?**
   - In `quota_oauth.rs` (lines 344–348), when Google's token endpoint response contains an `access_token` but no `refresh_token` (which occurs when `prompt=consent` is not explicitly forced or when Google omits the refresh token on repeat authorisations), DCC assigned `token_to_store = access_token`.
   - An `access_token` cannot be refreshed with `grant_type=refresh_token`, causing Google to reject all subsequent refresh requests with `HTTP 400: {"error": "invalid_grant"}`.
4. **Why did the card display `"Antigravity Offline"`?**
   - In `QuotaAccountCard.tsx` (lines 825–839), the header status badge helper `renderStatusBadge` had a hardcoded `case 'AuthRequired': return <span>Antigravity Offline</span>;`, unconditionally printing `"Antigravity Offline"` for any `AuthRequired` card regardless of provider!
5. **Did Antigravity fallback leak into Google Primary?**
   - **NO**: Backend fallback was not invoked. The `"Antigravity Offline"` label was purely a frontend badge rendering defect.

---

## 2. Forensic Investigation Matrix

| Stage | Result | Safe Evidence / Observation |
| :--- | :--- | :--- |
| **OAuth Authorization** | **PASS** | User completed browser OAuth consent |
| **Token Exchange** | **PASS** | Google Token Endpoint returned HTTP 200 |
| **Keyring Persistence** | **PASS** | Entry updated at `2026-08-16 21:45:21` (Length 206) |
| **Keyring Consumption** | **PASS** | `GoogleCloudCodeQuotaProvider` successfully reads token for `nakitosan912-gmail-com` |
| **Token Refresh** | **FAIL** | Google Token Endpoint returns `HTTP 400 invalid_grant` |
| **Google Identity** | **BLOCKED** | Blocked by token refresh failure |
| **loadCodeAssist** | **BLOCKED** | Blocked by token refresh failure |
| **retrieveUserQuotaSummary** | **BLOCKED** | Blocked by token refresh failure |
| **ModelQuota Mapping** | **BLOCKED** | Awaiting API response |
| **Provider Selection** | **PASS** | `QuotaProviderId::GoogleCloudCode` selected |
| **Fallback** | **PASS** | Fallback isolated; 0-IDE mode preserved |
| **Snapshot** | **PASS** | Emits `AccountQuotaSnapshot` with `AuthRequired` / `ReauthorizationRequired` |
| **IPC** | **PASS** | `quota:account-updated` emitted cleanly with no secret leaks |
| **React State** | **PASS** | Snapshot updated in React state |
| **UI Provider Label** | **FAIL** | `renderStatusBadge` hardcodes `"Antigravity Offline"` on `AuthRequired` |
| **UI Error Message** | **PASS** | Renders `"Google Authentication Required"` |
| **0-IDE Monitoring** | **PASS** | Architecture operates with 0 Antigravity IDE instances |

---

## 3. Exact Root Cause Summary

1. **Token Replacement Defect (`quota_oauth.rs:347`)**:
   - `start_oauth_flow` fell back to saving `access_token` when `refresh_token` was empty.
   - When calling Google OAuth token endpoint, Google only returns `refresh_token` if `prompt=consent` and `access_type=offline` are enforced, and DCC must fail-closed if no `refresh_token` is returned instead of storing the short-lived `access_token` into the refresh token slot.
2. **UI Badge Status Leak (`QuotaAccountCard.tsx:825-839`)**:
   - `renderStatusBadge` in `QuotaAccountCard.tsx` hardcoded `"Antigravity Offline"` for `AuthRequired` state instead of checking `isGooglePrimary`.

---

## 4. Final Classification

```text
FINAL CLASSIFICATION:
TOKEN_REFRESH_STILL_INVALID_GRANT

SECONDARY CLASSIFICATION:
UI_PROVIDER_STATE_FAILURE

ZERO SOURCE CODE WAS MODIFIED DURING THIS AUDIT.
```
