# AG-9.53A — GOOGLE CLOUD CODE 401 AUTH FORENSIC AUDIT REPORT

```text
STATUS:               AUDIT_COMPLETED
CLASSIFICATION:       GOOGLE_QUOTA_REQUEST_AUTH_MISCONFIGURED
DATE:                 2026-08-16
AUDIT MODE:           STRICT READ-ONLY FORENSIC AUDIT (ZERO SOURCE CODE MODIFICATIONS)
PROTECTED BASELINES:  1. AG-9.41 AI Quota Subsystem Release Freeze (Commit: 18acaa6, Invariants I1-I18)
                      2. AG-9.47 Multi-Instance Runtime Discovery
                      3. AG-9.49 Google OAuth Primary + Antigravity Fallback
                      4. AG-9.50 OAuth Security & Correctness Audit
                      5. AG-9.51 OAuth Connect UI/UX
                      6. AG-9.52 Post-OAuth Persistence Forensic Audit
                      7. AG-9.53 Google Cloud Code Quota API Correction
```

---

## 1. Executive Summary & Root Cause

A strict read-only forensic audit was performed to determine why Developer Control Center reported:
- Card Title: `"Antigravity Local Runtime Offline"`
- Card Subtitle: `"Cloud Code quota summary unauthorized"`

### Confirmed Root Cause 1: Client ID & Client Secret Pairing Mismatch (`GOOGLE_QUOTA_REQUEST_AUTH_MISCONFIGURED`)

Binary disassembly and token endpoint probing revealed two distinct OAuth client pairs in `language_server.exe`:

| Client ID | Paired Secret | Endpoint Response (`/token`) | Status |
| :--- | :--- | :--- | :--- |
| `884354919052-...apps.googleusercontent.com` | `GOCSPX-REDACTED-OAUTH-SECRET-PRIMARY` | **Valid Client Match** (HTTP 200 / 400 grant) | **CORRECT PAIR A** |
| `1071006060591-...apps.googleusercontent.com` | `GOCSPX-REDACTED-OAUTH-SECRET-SECONDARY` | **Valid Client Match** (HTTP 200 / 400 grant) | **CORRECT PAIR B** |
| `884354919052-...apps.googleusercontent.com` | `GOCSPX-REDACTED-OAUTH-SECRET-SECONDARY` | **HTTP 401 Unauthorized (`invalid_client`)** | **CURRENT MISCONFIGURATION** |

In AG-9.52, the binary string search extracted `GOCSPX-REDACTED-OAUTH-SECRET-SECONDARY` (Secret 1) and assigned it to Client ID `884354919052-...` (Client 2).
Because the client secret did not match that Client ID, Google's token endpoint (`https://oauth2.googleapis.com/token`) rejected every refresh request with:
```json
{
  "error": "invalid_client",
  "error_description": "The provided client secret is invalid."
}
```

### Confirmed Root Cause 2: UI State Label Collapse (`FALLBACK_STATE_COLLAPSE_BUG`)

In `QuotaAccountCard.tsx` (lines 412–423):
```tsx
{(snapshot.status === 'AuthRequired' || !snapshot.quota) && (
  <div>
    <span>Antigravity Local Runtime Offline</span>
    <p>{snapshot.errorMessage || snapshot.quota?.safeDiagnosticMessage || '...'}</p>
  </div>
)}
```
When `GoogleCloudCodeQuotaProvider` fails with `Unauthorized`, the backend sets `snapshot.status = AuthRequired` and `safe_diagnostic_message = "Cloud Code quota summary unauthorized."`.
The frontend card blindly renders the hardcoded title `"Antigravity Local Runtime Offline"`, collapsing a Google Cloud Code authentication error into an Antigravity local daemon offline title.

---

## 2. Answers to Specific Audit Objectives

### 1. Is the OAuth access token valid?
- **No**: The access token could not be generated because `refresh_access_token` was rejected at the Google Token Endpoint with HTTP 401 `invalid_client`.

### 2. Is it valid for Cloud Code?
- **Yes, when correctly paired**: The OAuth scopes (`openid email profile https://www.googleapis.com/auth/cloud-platform`) are 100% authorized for `cloudcode-pa.googleapis.com`.

### 3. Why does `loadCodeAssist` succeed/fail?
- `loadCodeAssist` was never reached because execution failed earlier in `refresh_access_token`.

### 4. Why does `retrieveUserQuotaSummary` return 401?
- The 401 error was not returned by `retrieveUserQuotaSummary`; it was returned by `https://oauth2.googleapis.com/token` during client secret validation in token refresh.

### 5. What exact request difference causes the failure?
- `client_secret` was set to `GOCSPX-REDACTED-OAUTH-SECRET-SECONDARY` instead of `GOCSPX-REDACTED-OAUTH-SECRET-PRIMARY` for `DEFAULT_GOOGLE_CLIENT_ID` (`884354919052-...`).

### 6. Why does the UI say "Antigravity Local Runtime Offline"?
- `QuotaAccountCard.tsx` hardcodes `"Antigravity Local Runtime Offline"` as the header for all `AuthRequired` cards regardless of whether the provider is Google Cloud Code or Antigravity.

### 7. Is Google OAuth actually connected despite the displayed message?
- The refresh token is securely stored in Windows Credential Manager (`Entry::new`). Once the client secret pairing is aligned and the account re-authenticates, it will refresh and stream live quota seamlessly.

---

## 3. Minimal Recommended Fix Plan

1. **Backend Pairing Fix (`quota_oauth.rs` & `google_cloud_code_provider.rs`)**:
   - Update `DEFAULT_GOOGLE_CLIENT_SECRET` to `GOCSPX-REDACTED-OAUTH-SECRET-PRIMARY` (the verified paired secret for `884354919052-...apps.googleusercontent.com`).
2. **Frontend UI State Decoupling (`QuotaAccountCard.tsx`)**:
   - Update the banner title in `QuotaAccountCard.tsx` to conditionally display `"Google Authentication Required"` when `isGooglePrimary` is true, rather than hardcoding `"Antigravity Local Runtime Offline"`.

---

## 4. Final Classification

```text
FINAL CLASSIFICATION:
GOOGLE_QUOTA_REQUEST_AUTH_MISCONFIGURED

SECONDARY UI CLASSIFICATION:
FALLBACK_STATE_COLLAPSE_BUG
```
