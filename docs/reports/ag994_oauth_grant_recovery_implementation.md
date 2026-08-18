# AG-9.94 — GOOGLE OAUTH GRANT RECOVERY & REFRESH TOKEN LIFECYCLE IMPLEMENTATION REPORT

```text
STATUS:               IMPLEMENTATION_COMPLETED
DATE:                 2026-08-17
FIX SCOPE:            PROGRAMMATIC GOOGLE GRANT REVOCATION & AUTOMATED GRANT RECOVERY
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
                      32. AG-9.76 Cloud Code Response Compatibility & Provisioning Handling
                      33. AG-9.77 V1 Antigravity vs Google Cloud Code Quota Path Forensic Comparison
                      34. AG-9.78 Antigravity Quota Backend Extraction & Cloud-Direct Feasibility Forensic Audit
                      35. AG-9.79 Antigravity Cloud-Direct Quota Provider Implementation & Runtime Verification
                      36. AG-9.80 Production Multi-Account Cloud-Direct Validation & Regression Audit
                      37. AG-9.81 Account Lifecycle & Quota Availability UX Hardening Forensic Audit
                      38. AG-9.82 Pending Quota UX Enhancement & Regression Guard
                      39. AG-9.83 Production Account Lifecycle Interaction & UX Regression Audit
                      40. AG-9.84 Antigravity Instance ↔ DCC Account Identity Binding Forensic Audit
                      41. AG-9.85 Google OAuth Reauthorization Credential Lifecycle Repair
                      42. AG-9.86 Post-Reconnect Account 3 Auth Required Root-Cause Forensic Audit
                      43. AG-9.87 Account Reconnect Credential Lifecycle Fix
                      44. AG-9.88 Account 3 OAuth Reconnect Transaction Forensic Audit
                      45. AG-9.89 Google OAuth Account Add UI Visibility Forensic Audit
                      46. AG-9.90 Google OAuth Account Add UI State Synchronization Fix
                      47. AG-9.91 New Google Account Auth Required Forensic Audit
                      48. AG-9.92 Google OAuth Refresh Token Acquisition & Credential Recovery Fix
                      49. AG-9.93 Post-AG-9.92 Auth Required Credential Identity & Runtime Path Forensic Audit
                      50. AG-9.94 Google OAuth Grant Recovery & Refresh Token Lifecycle Hardening
```

---

## 1. Summary of Changes

1. **`src-tauri/src/monitor/quota_oauth.rs`**:
   - Added `GOOGLE_REVOKE_ENDPOINT` (`https://oauth2.googleapis.com/revoke`).
   - Implemented `revoke_token(&self, token: &str) -> Result<bool, QuotaProviderError>`.
   - Enhanced `start_oauth_flow`:
     - When Google returns an `access_token` but omits `refresh_token` and the account lacks a valid refresh token:
       - **Automated Grant Reset**: DCC calls `self.revoke_token(&access_token)` to programmatically revoke the stale consent grant on Google's Authorization Server.
       - Purges any dead Keyring token for `final_account_id`.
       - Returns `GrantRecoveryRequired` (or `MissingRefreshToken` for new accounts) with clear guidance.
       - The next time the user connects/reconnects, Google detects the revoked grant, prompts for fresh offline consent, and **issues a brand new `refresh_token`**.
2. **`src/features/quota/v2/MultiAccountQuotaDashboard.tsx` & `AddAccountModal.tsx`**:
   - Enhanced Global Error Banner with clear recovery guidance.
3. **`docs/decisions.md`**:
   - Appended Architectural Decision #68.

---

## 2. Verification Summary

- **Cargo Check**: `PASS` (0 errors)
- **Cargo Build**: `PASS` (0 errors, 34,989,568 bytes binary)
- **NPM Build**: `PASS` (0 errors, built in 37.40s)
- **15-Point Test Matrix**: `15/15 PASS` (100%)
