# AG-9.85 — PRE-IMPLEMENTATION AUDIT: GOOGLE OAUTH CREDENTIAL LIFECYCLE REPAIR

```text
STATUS:               AUDIT_COMPLETED
DATE:                 2026-08-17
AUDIT MODE:           PRE-IMPLEMENTATION LIFECYCLE & CREDENTIAL INTEGRITY AUDIT
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
                      41. AG-9.85 Account 3 Google OAuth Success → DCC Remains Auth Required Forensic Audit
```

---

## 1. Trace of Existing Reconnect Lifecycle

```text
UI reconnect action (handleReconnectAccount)
→ quota_connect_google_account_cmd(&accountId)
→ GoogleOAuthService::start_oauth_flow
→ Bind loopback TCP listener on dynamic port
→ Construct Google Authorization URL (with PKCE code_challenge, state)
→ Launch system browser
→ User authenticates with Google
→ Loopback listener receives auth code
→ exchange_auth_code exchanges code with https://oauth2.googleapis.com/token
→ Google returns tokens: access_token, refresh_token (optional)
→ fetch_user_email queries https://www.googleapis.com/oauth2/v2/userinfo
→ Identity check (target.email.eq_ignore_ascii_case(&user_email))
→ [DEFECT 1]: If refresh_token is empty, DCC preserves existing Keyring token without testing validity
→ [DEFECT 2]: DCC calls self.registry.register(updated_config) which fails for existing accounts (should call update)
→ DCC reports success: true to frontend
→ Polling engine triggers refresh_account_now
→ fetch_quota uses old invalid_grant Keyring token -> fails with ReauthorizationRequired -> sets snapshot to AuthRequired
```

---

## 2. Planned Surgical Corrections

1. **Explicit Prompt Configuration for Reauthorization**:
   - Ensure the Google authorization URL forces `prompt=consent` during account reconnection so Google issues a fresh `refresh_token`.
2. **Transactional Credential Verification**:
   - If Google returns a `refresh_token`, write it to Keyring and immediately verify it by requesting a test token refresh.
   - If Google omits `refresh_token`, test if the existing Keyring token is healthy. If the existing token fails refresh (`invalid_grant`), reject with `ReauthorizationRequired` / `MissingRefreshToken` and delete the invalid token.
3. **Registry Update Correction**:
   - Call `self.registry.update(updated_config)` instead of `register` when updating existing account metadata.
4. **Account ID and Keyring Isolation**:
   - Preserve Account ID (`nakitosan912-gmail-com`) and isolate all credential operations strictly to the account's Keyring namespace.

---

## 3. Final Classification

```text
FINAL CLASSIFICATION:
READY_FOR_IMPLEMENTATION
```
