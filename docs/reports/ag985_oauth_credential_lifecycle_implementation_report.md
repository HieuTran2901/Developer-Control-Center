# AG-9.85 — GOOGLE OAUTH CREDENTIAL LIFECYCLE REPAIR IMPLEMENTATION REPORT

```text
STATUS:               IMPLEMENTATION_COMPLETED
CLASSIFICATION:       OAUTH_CREDENTIAL_LIFECYCLE_REPAIRED
DATE:                 2026-08-17
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
```

---

## 1. Executive Summary

AG-9.85 implements transactional credential replacement and eliminates the stale token retention defect:
1. **Forced Consent Prompt on Reconnect**:
   - Google authorization URL explicitly requests `prompt=consent select_account` to ensure Google supplies a fresh `refresh_token` during account reauthorization.
2. **Transactional Credential Verification**:
   - When a `refresh_token` is received, DCC validates it via a test token refresh (`self.refresh_access_token(&refresh_token)`) before committing to the OS Keyring.
   - If Google omits the `refresh_token` on an account whose existing token is broken (`invalid_grant`), DCC purges the stale token from Keyring and returns an actionable `ReauthorizationRequired` result instead of preserving the broken token.
3. **Registry Update Correction**:
   - Switched from `self.registry.register(updated_config)` (which failed due to existing key check) to `self.registry.update(updated_config)`.
4. **Account & Keyring Isolation**:
   - The account ID (`nakitosan912-gmail-com`) is preserved without duplicates, and credential operations are isolated strictly to its Keyring namespace.

---

## 2. Modified Files

1. [`src-tauri/src/monitor/quota_oauth.rs`](file:///E:/Github%20project/Developer-Control-Center/src-tauri/src/monitor/quota_oauth.rs):
   - Added `refresh_access_token` validation helper.
   - Implemented transactional verification in `start_oauth_flow`.
   - Updated `auth_url` parameter to `prompt=consent select_account`.
   - Fixed `registry.update` invocation.
2. [`docs/decisions.md`](file:///E:/Github%20project/Developer-Control-Center/docs/decisions.md):
   - Appended Architectural Decision #64.

---

## 3. Final Classification

```text
FINAL CLASSIFICATION:
OAUTH_CREDENTIAL_LIFECYCLE_REPAIRED
```
