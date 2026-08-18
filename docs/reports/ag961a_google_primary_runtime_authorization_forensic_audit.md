# AG-9.61A — GOOGLE PRIMARY RUNTIME AUTHORIZATION FORENSIC AUDIT REPORT

```text
STATUS:               AUDIT_COMPLETED
CLASSIFICATION:       KEYRING_CREDENTIAL_STILL_INVALID_GRANT_FROM_PRE_MIGRATION
SECONDARY_FINDING:    CONNECT_ANTIGRAVITY_ROUTES_TO_CONFIGURED_GOOGLE_PROVIDER
DATE:                 2026-08-16
AUDIT MODE:           STRICT READ-ONLY FORENSIC AUDIT (ZERO SOURCE CODE MODIFICATIONS)
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
```

---

## 1. Executive Summary & Diagnostic Matrix

```text
OAUTH_AUTHORIZATION:        PASS (Browser authorization succeeds)
TOKEN_REFRESH:              FAIL (HTTP 400 invalid_grant)
GOOGLE_IDENTITY:            BLOCKED (Awaiting valid access token)
LOAD_CODE_ASSIST:           BLOCKED (Awaiting valid access token)
RETRIEVE_QUOTA_SUMMARY:     BLOCKED (Awaiting valid access token)
MODEL_QUOTA_MAPPING:        BLOCKED (Awaiting API response)
PROVIDER_STATE:             AuthRequired / ReauthorizationRequired
UI_STATE:                   Google Cloud Code · Primary / Google Auth Required / Not synced yet
ANTIGRAVITY_BUTTON:         ROUTES_TO_CONFIGURED_GOOGLE_PROVIDER
ZERO_IDE_OPERATION:         PASS (0 running Antigravity IDE instances required)
MULTI_ACCOUNT_ISOLATION:    PASS (Account-scoped Keyring targets strictly isolated)
```

---

## 2. Identity & Runtime Trace for `nakitosan912@gmail.com`

```text
DCC accountId:          nakitosan912-gmail-com
Expected Email:         nakitosan912@gmail.com
Provider:               QuotaProviderId::GoogleCloudCode
Keyring Target:         nakitosan912-gmail-com.developer-control-center:antigravity-oauth
Credential Written:     2026-08-16 21:45:21 (Length: 206 chars)
OAuth Client ID:        CONFIGURED (via GoogleOAuthConfig canonical resolver)
OAuth Client Secret:    CONFIGURED (via GoogleOAuthConfig canonical resolver)
```

### Complete Runtime Trace:
1. `QuotaPollingEngine` triggers refresh for account `nakitosan912-gmail-com`.
2. `QuotaProviderService::get_account_quota` inspects `config.provider` ($\rightarrow$ `GoogleCloudCode`).
3. `GoogleCloudCodeQuotaProvider::fetch_quota` retrieves the stored token from Windows Credential Manager.
4. Token length is 206 chars (an ephemeral access token stored into the refresh token slot prior to the AG-9.58 fix).
5. `refresh_access_token` calls `POST https://oauth2.googleapis.com/token` with `grant_type=refresh_token`.
6. Google Token Endpoint rejects the access token with `HTTP 400 Bad Request: {"error": "invalid_grant", "error_description": "Bad Request"}`.
7. `GoogleCloudCodeQuotaProvider` maps `invalid_grant` to `QuotaProviderErrorKind::ReauthorizationRequired` with message `"Cloud Code quota summary unauthorized."`.
8. `QuotaProviderService` emits `AccountQuotaSnapshot` with `status: AuthRequired`, `errorMessage: "Cloud Code quota summary unauthorized."`, and `quota: None`.
9. React frontend receives snapshot and displays:
   - Card Header: `Google Cloud Code · Primary`
   - Status Badge: `Google Auth Required`
   - Diagnostic Subtitle: `Cloud Code quota summary unauthorized.`
   - Model Grid: `Not synced yet` (because `snapshot.quota` is `None`).

---

## 3. "Connect Antigravity" Button Audit

- When the user clicks `Connect Antigravity` on the card:
  - The click handler [`handleConnectLocalAntigravity`](file:///E:/Github%20project/Developer-Control-Center/src/features/settings/components/QuotaAccountCard.tsx#L143-L177) executes `onRefresh(snapshot.accountId)`.
  - Backend `QuotaProviderService::get_account_quota` reads the account configuration and sees `provider = GoogleCloudCode`.
  - Therefore, it routes the refresh to `GoogleCloudCodeQuotaProvider` rather than `AntigravityQuotaProvider`.
  - Because the stored token is invalid, the refresh fails with `invalid_grant`, returning `AuthRequired`.
  - Consequently, clicking `Connect Antigravity` on an account configured as `GoogleCloudCode` merely re-polls Google Cloud Code and does not switch providers or query `language_server.exe`.

---

## 4. Root Cause Classification & Next Actions

```text
EXACT ROOT CAUSE:
The token currently stored in Windows Credential Manager under target
'nakitosan912-gmail-com.developer-control-center:antigravity-oauth' was written at
21:45:21 (pre-AG-9.58) and contains an ephemeral access token (length 206) instead
of a genuine refresh token. Subsequent polling with grant_type=refresh_token produces
HTTP 400 invalid_grant.

AFFECTED FUNCTION:
GoogleCloudCodeQuotaProvider::refresh_access_token

AFFECTED FILE:
src-tauri/src/monitor/providers/google_cloud_code_provider.rs

AFFECTED CONDITION:
Stored keyring token returns invalid_grant on refresh.

EXPECTED BEHAVIOR:
A genuine long-lived refresh token obtained via 'Connect Google' / 'Reconnect Google Account'
(with prompt=consent enforced under AG-9.58/AG-9.61) will refresh into a valid access token,
invoke loadCodeAssist and retrieveUserQuotaSummary, and stream live ModelQuota.

SAFE NEXT FIX:
In the running DCC application, click 'Connect Google' / 'Reconnect Google Account'
to perform a fresh OAuth browser consent with AG-9.58/AG-9.61's prompt=consent & strict
token separation rules. The newly returned refresh token will overwrite the corrupted entry
and immediately stream live quota.
```
