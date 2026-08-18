# AG-9.61 — DCC GOOGLE OAUTH ENVIRONMENT CREDENTIAL MIGRATION PRE-IMPLEMENTATION AUDIT

```text
STATUS:               AUDIT_COMPLETED
DATE:                 2026-08-16
AUDIT MODE:           STRICT READ-ONLY AUDIT (ZERO SOURCE CODE MODIFIED)
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
```

---

## 1. Existing Credential Source Inventory

| File | Line | Current Lookup Logic | Issue / Target |
| :--- | :--- | :--- | :--- |
| `src-tauri/src/monitor/quota_oauth.rs` | 20–25 | `DEFAULT_GOOGLE_CLIENT_ID` / `DEFAULT_GOOGLE_CLIENT_SECRET` | Static fallback constants |
| `src-tauri/src/monitor/quota_oauth.rs` | 114–120 | `std::env::var("DCC_GOOGLE_CLIENT_ID").or_else(...)` | Duplicated env lookup |
| `src-tauri/src/monitor/quota_oauth.rs` | 686–692 | `std::env::var("DCC_GOOGLE_OAUTH_CLIENT_ID")...` | Diagnostics lookup |
| `src-tauri/src/monitor/providers/google_cloud_code_provider.rs` | 26–32 | `std::env::var("DCC_GOOGLE_CLIENT_ID").or_else(...)` | Duplicated env lookup |

---

## 2. Identified Migration Requirements

1. **Single Canonical Resolver (`GoogleOAuthConfig`)**:
   - Centralize resolution into a single `GoogleOAuthConfig::resolve()` method in `src-tauri/src/monitor/quota_oauth.rs`.
   - Priority hierarchy:
     1. `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (Primary Canonical Standard)
     2. `DCC_GOOGLE_CLIENT_ID` + `DCC_GOOGLE_CLIENT_SECRET` (Compatibility Alias)
     3. `DCC_GOOGLE_OAUTH_CLIENT_ID` + `DCC_GOOGLE_OAUTH_CLIENT_SECRET` (Compatibility Alias)
     4. Default Desktop Pair (Development Fallback)
2. **Unified Consumption**:
   - `GoogleOAuthService` and `GoogleCloudCodeQuotaProvider` will both instantiate and query the canonical `GoogleOAuthConfig`.
3. **Safe Diagnostics**:
   - Update `get_oauth_config_status` to report configuration status (`CONFIGURED` / `ABSENT`), source name, and client ID fingerprint without exposing secrets.
4. **Zero Regressions**:
   - All Invariants I1–I18, token separation, OS Keyring account scoping, and 0-IDE operation remain completely untouched.
