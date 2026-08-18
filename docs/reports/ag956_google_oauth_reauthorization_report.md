# AG-9.56 — GOOGLE OAUTH RE-AUTHORIZATION & INVALID-GRANT RECOVERY REPORT

```text
STATUS:               IMPLEMENTATION_COMPLETED
CLASSIFICATION:       GOOGLE_OAUTH_OPERATIONAL_FALLBACK_OPERATIONAL
DATE:                 2026-08-16
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

## 1. Executive Summary & Root Cause Addressed

When a Google OAuth refresh token expires or is revoked, Google Token Endpoint returns `HTTP 400 Bad Request: {"error": "invalid_grant"}`.
Previously, this was collapsed into generic `OAuthRefreshFailed` and triggered continuous retry loops during background polling cycles.

AG-9.56 implements the complete, deterministic recovery flow:
1. **Explicit `invalid_grant` State (`ReauthorizationRequired`)**:
   - Detected in `GoogleCloudCodeQuotaProvider::refresh_access_token`.
   - Propagated via `QuotaProviderErrorKind::ReauthorizationRequired` $\rightarrow$ `ModelQuotaStatus::ReauthorizationRequired` $\rightarrow$ `AccountPollingState::ReauthorizationRequired`.
2. **Polling Storm Suppression**:
   - `QuotaPollingEngine::tick` skips automatic background dispatch for accounts in `ReauthorizationRequired`.
3. **Atomic Credential Replacement & Fail-Closed Validation**:
   - In `GoogleOAuthService::start_oauth_flow`, the credential is only overwritten after successful authorization code exchange and UserInfo email verification.
   - Old credentials are never wiped on failed reauthorization attempts.
4. **Dedicated UI Recovery UX (`QuotaAccountCard.tsx`)**:
   - Renders an amber banner: `"Google Reauthorization Required"` with a primary action button `"Reconnect Google Account"`.
   - Upon clicking, starts the account-scoped OAuth flow, updates the Keyring, and triggers immediate live quota synchronization.

---

## 2. Modified & Added Files

### Added Deliverables
- `docs/reports/ag956_preimplementation_audit.md`
- `docs/reports/ag956_google_oauth_reauthorization_runtime_verification.md`
- `docs/reports/ag956_google_oauth_reauthorization_report.md`
- `docs/decisions.md` (Decision #45 appended)

### Modified Source Code
- `src-tauri/src/monitor/providers/google_cloud_code_provider.rs`: Added `invalid_grant` detection in `refresh_access_token`.
- `src-tauri/src/monitor/quota_provider.rs`: Added `ReauthorizationRequired` to `ModelQuotaStatus` and `QuotaProviderErrorKind`.
- `src-tauri/src/monitor/quota_polling.rs`: Added `ReauthorizationRequired` to `AccountPollingState`, mapped in `execute_account_refresh`, and suppressed automated polling storms.
- `src-tauri/src/monitor/quota_oauth.rs`: Set provider to `GoogleCloudCode` on OAuth connect and ensured atomic credential replacement.
- `src/domain/entities/QuotaPolling.ts`: Added `'ReauthorizationRequired'` to `AccountPollingState`.
- `src/domain/entities/QuotaProvider.ts`: Added `'ReauthorizationRequired'` to `ModelQuotaStatus`.
- `src/features/settings/components/QuotaAccountCard.tsx`: Added explicit `"Google Reauthorization Required"` banner and `"Reconnect Google Account"` action.

---

## 3. Final Verification Matrix

```text
INVALID_GRANT_DETECTION        = PASS
REAUTHORIZATION_STATE          = PASS
CREDENTIAL_REPLACEMENT         = PASS
IDENTITY_VALIDATION            = PASS
IMMEDIATE_QUOTA_REHYDRATION    = PASS
MULTI_ACCOUNT_ISOLATION        = PASS
REMOVAL_RESURRECTION_GUARD     = PASS
0_IDE_MONITORING               = PASS
I1_I18_PRESERVATION            = PASS
CARGO_CHECK                    = PASS (0 errors)
NPM_BUILD                      = PASS (0 errors)
```

---

## 4. Final Classification

```text
FINAL CLASSIFICATION:
GOOGLE_OAUTH_OPERATIONAL_FALLBACK_OPERATIONAL
```
