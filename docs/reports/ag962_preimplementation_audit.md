# AG-9.62 — PRE-IMPLEMENTATION FORENSIC AUDIT REPORT

```text
STATUS:               AUDIT_COMPLETED
DATE:                 2026-08-16
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
```

---

## 1. Executive Summary & Root Causes Identified

### Root Cause 1: Stale Pre-AG-9.58 Keyring Credential
- **Finding**: The token currently stored in Windows Credential Manager under target `nakitosan912-gmail-com.developer-control-center:antigravity-oauth` was written at `21:45:21` (prior to AG-9.58) and contains an ephemeral `access_token` (length 206) stored in the refresh-token slot.
- **Consequence**: Polling with `grant_type=refresh_token` produces `HTTP 400 invalid_grant`.
- **Solution**: Reconnecting via "Connect Google" atomically overwrites the stale token with a genuine long-lived refresh token obtained under `prompt=consent&access_type=offline`.

### Root Cause 2: "Connect Antigravity" Routing Misdirection
- **Finding**: In [`QuotaAccountCard.tsx`](file:///E:/Github%20project/Developer-Control-Center/src/features/settings/components/QuotaAccountCard.tsx#L143-L177), `handleConnectLocalAntigravity` called `onRefresh(snapshot.accountId)`.
- **Consequence**: Backend [`QuotaProviderService::get_account_quota`](file:///E:/Github%20project/Developer-Control-Center/src-tauri/src/monitor/quota_provider.rs#L528-L533) inspected `config.provider` ($\rightarrow$ `GoogleCloudCode`), routing the request back to `GoogleCloudCodeQuotaProvider` rather than discovering and connecting the local Antigravity runtime.
- **Solution**: Implement explicit `quota_connect_antigravity_account_cmd` Tauri command and provider routing that switches the account's provider to `Antigravity`, executes local Language Server runtime discovery, and immediately streams live quota.

---

## 2. Affected Files & Functions

1. `src-tauri/src/monitor/quota_provider.rs`:
   - `QuotaProviderService::get_account_quota`: Disambiguate explicit `QuotaProviderId::GoogleCloudCode` vs `QuotaProviderId::Antigravity` execution paths.
2. `src-tauri/src/monitor/quota_polling.rs`:
   - Add helper `get_account_config` to `QuotaPollingEngine` if not already exposed.
3. `src-tauri/src/monitor/mod.rs` & `src-tauri/src/lib.rs`:
   - Register `quota_connect_antigravity_account_cmd`.
4. `src/application/services/QuotaPollingService.ts`:
   - Add `connectAntigravityAccount(accountId: string)` method.
5. `src/features/settings/components/QuotaAccountCard.tsx`:
   - Update `handleConnectLocalAntigravity` to call `quotaPollingService.connectAntigravityAccount(snapshot.accountId)`.
