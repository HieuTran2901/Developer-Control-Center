# AG-9.72 — PRE-IMPLEMENTATION FORENSIC AUDIT: CLOUD CREDENTIAL BINDING

```text
STATUS:               AUDIT_COMPLETED
DATE:                 2026-08-17
AUDIT MODE:           STRICT READ-ONLY PRE-IMPLEMENTATION INVESTIGATION
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

This forensic audit investigates the complete authentication-to-quota pipeline in DCC to ensure that:
1. **Google Cloud Code Primary** acts as the authoritative cloud-direct quota provider for all monitored accounts.
2. Every Google account maintains strictly isolated credentials in the OS Keyring.
3. No account is routed to local `language_server.exe` when it has valid Google Cloud credentials or when local runtime identity does not match the account.
4. Provider precedence is strictly enforced: `GoogleCloudCode` $\rightarrow$ `Antigravity Fallback` (only on explicit match) $\rightarrow$ `AuthRequired/Offline`.

---

## 2. Forensic Findings on Current Implementation

### A. Keyring Key Scheme
- Location: `src-tauri/src/monitor/quota_provider.rs` -> `KeyringCredentialStorage`
- Target Name: `<accountId>.developer-control-center:antigravity-oauth`
- Property: Isolated strictly per `accountId`. Zero shared access token caching.

### B. Account Registry Model
- Struct: `AccountMonitorConfig` in `src-tauri/src/monitor/quota_polling.rs`
- Fields: `account_id`, `provider: Option<QuotaProviderId>`, `email`, `display_name`, `tier`, `enabled`, `auto_connect`, `polling_interval_seconds`.
- **Finding**: Legacy default in `AccountMonitorConfig::provider(&self)` defaulted `None` to `QuotaProviderId::Antigravity`.

### C. Provider Selection & Fallback Root Cause
- In `QuotaProviderService::get_account_quota`:
  - When `provider_id == QuotaProviderId::Antigravity`, the engine executed `antigravity_provider.fetch_quota()` directly without checking if Google OAuth refresh token was present in Keyring.
  - When `antigravity_provider.fetch_quota()` was queried, it searched for local runtimes and compared against PID 15252 (`trunghieu10a1thptll@gmail.com`).
  - For `tranhuuhaidh@gmail.com` and `nakitosan912@gmail.com`, this produced `Account Identity Mismatch` because the provider was explicitly set to `Antigravity` or defaulted to `Antigravity`.

---

## 3. Required Architectural Changes (AG-9.72)

1. **Enforce Google Primary Default**:
   - `AccountMonitorConfig::provider(&self)` must default `None` to `QuotaProviderId::GoogleCloudCode`.
   - `AddAccountModal.tsx` must default new accounts to `google_cloud_code`.
2. **Authoritative Provider Precedence in `QuotaProviderService::get_account_quota`**:
   - Step 1: Check `self.credential_storage.get_refresh_token(account_id)`.
   - Step 2: If `has_google_oauth == true` OR `provider_id == QuotaProviderId::GoogleCloudCode`, prioritize `GoogleCloudCodeQuotaProvider`.
   - Step 3: Local Antigravity Runtime is used ONLY if explicitly configured OR if Google Primary experienced a network error AND a local runtime exists that EXACTLY matches `expected_email`.
   - Step 4: If Google Primary fails and no local runtime matches `expected_email`, return `AuthRequired` ("Google OAuth connection required") without triggering a misleading "Account Identity Mismatch".
3. **Connect Google Action**:
   - When "Connect Google" succeeds, ensure `account.provider = Some(QuotaProviderId::GoogleCloudCode)`.
   - Trigger immediate refresh via `GoogleCloudCodeQuotaProvider`.

---

## 4. Final Classification

```text
FINAL CLASSIFICATION:
READY_FOR_IMPLEMENTATION
```
