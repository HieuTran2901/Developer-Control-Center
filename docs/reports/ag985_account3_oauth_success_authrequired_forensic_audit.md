# AG-9.85 — ACCOUNT 3 GOOGLE OAUTH SUCCESS → DCC REMAINS AUTH REQUIRED FORENSIC AUDIT REPORT

```text
STATUS:               AUDIT_COMPLETED
DATE:                 2026-08-17
AUDIT MODE:           STRICT READ-ONLY FORENSIC INVESTIGATION (ZERO SOURCE CODE MODIFIED)
CLASSIFICATION:       ROOT_CAUSE_PROVEN
PRIMARY ROOT CAUSE:   G. Credential reload/consumption failure & E. Keyring persistence failure (Stale invalid_grant token preserved when Google omits refresh_token on reauthorization)
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

## 1. Executive Summary

This forensic audit investigates why Google browser authorization reports success for **Account 3 (`nakitosan912@gmail.com`)**, but after returning to Developer Control Center (DCC), the account remains `Auth Required` (`Reauthentication needed`).

### Core Forensic Findings:
1. **Live Keyring Probe Result**:
   - The credential stored under `nakitosan912-gmail-com.developer-control-center:antigravity-oauth` was tested against Google's `oauth2.googleapis.com/token` endpoint.
   - **Google Rejected with HTTP 400**:
     ```json
     {
       "error": "invalid_grant",
       "error_description": "Bad Request"
     }
     ```
2. **The Stale Token Retention Defect (`quota_oauth.rs` lines 398–414)**:
   - When Google performs token exchange for an account that was previously authorized, Google frequently returns only an `access_token` and omits the `refresh_token` (`token_data.refresh_token == None`).
   - `quota_oauth.rs` contains a fallback branch:
     ```rust
     if existing_token.is_some() {
         // Existing valid refresh token is preserved without modification
     }
     ```
   - Because an existing token was already present in Keyring, DCC **preserved the old, revoked `invalid_grant` token** without replacing it!
   - DCC then reported `success: true` to the UI and immediately triggered `refresh_account_now`.
   - `refresh_account_now` attempted token refresh using the **stale `invalid_grant` token**, received HTTP 400 from Google, and immediately transitioned Account 3 right back to `AuthRequired`!

---

## 2. Chronological Timeline Trace

| Step | Operation | Status | Forensic Observation |
| :--- | :--- | :--- | :--- |
| **T0** | User clicks Reconnect on Account 3 | **PASS** | Triggered from Account Table or Smart Alerts Panel |
| **T1** | OAuth loopback server binds on dynamic port | **PASS** | `127.0.0.1:<port>` listener active; browser launched |
| **T2** | Google authorization in browser | **PASS** | User authenticates; browser renders green success page |
| **T3** | Callback received on loopback | **PASS** | Auth `code` and `state` received and matched |
| **T4** | Token exchange with Google Token Endpoint | **PASS** | Google returns `access_token` |
| **T5** | Refresh Token evaluation | **FAIL** | Google omits `refresh_token` on reauth; DCC preserves stale token |
| **T6** | UserInfo identity verification | **PASS** | Validated via `oauth2/v2/userinfo` |
| **T7** | Identity matching with Account 3 | **PASS** | Matches `nakitosan912@gmail.com` |
| **T8** | Keyring persistence | **FAIL** | Stale revoked token left in OS Credential Manager |
| **T9** | Registry updated | **PASS** | `updated_at` updated in `account_registry.json` |
| **T10**| Immediate quota poll dispatched | **PASS** | `refresh_account_now(&nakitosan912-gmail-com)` |
| **T11**| `GoogleCloudCodeQuotaProvider` refresh | **PASS** | Reads refresh token from Keyring |
| **T12**| Google Token Endpoint call | **FAIL** | Google returns `HTTP 400 invalid_grant` on stale token |
| **T13**| Error classification | **PASS** | Mapped to `QuotaProviderErrorKind::ReauthorizationRequired` |
| **T14**| Snapshot update | **PASS** | Set to `status = AuthRequired` (`Reauthentication needed`) |
| **T15**| UI rendering | **PASS** | UI truthfully renders snapshot as `Auth Required` |

---

## 3. Account 2 vs Account 3 Differential Analysis

| Dimension | Account 2 (`trunghieu10a1thptll@gmail.com`) | Account 3 (`nakitosan912@gmail.com`) |
| :--- | :--- | :--- |
| **Keyring Token State** | Active / Valid in OS Keyring | Stale / Revoked (`HTTP 400 invalid_grant`) |
| **Token Refresh Result**| **PASS** (Ephemeral access token generated) | **FAIL** (Google rejects with `invalid_grant`) |
| **Cloud-Direct HTTPS** | **PASS** (14 models, 5H ~91%, Weekly ~28%) | **BLOCKED** at token refresh step |
| **Local Runtime Match** | **MATCH** (PID 15252 active language_server) | **MISMATCH** (Local IDE logged into Account 2) |
| **Final UI State** | `Connected` / `Healthy` (Rank #1) | `Auth Required` (`Reauthentication needed`) |

---

## 4. Exact Root Cause & First Divergence

- **First Divergence**: **Step T5 / T8**: During token exchange, Google did not supply a fresh `refresh_token`. DCC erroneously assumed the existing Keyring token was valid and preserved the stale revoked token instead of rejecting or demanding fresh consent.
- **Immediate Reaction**: At **Step T12**, the initial background poll used the stale token, which failed Google token refresh (`invalid_grant`), immediately flipping the snapshot back to `AuthRequired`.

---

## 5. Root Cause Classification

```text
PRIMARY CLASSIFICATION:
G. Credential reload/consumption failure & E. Keyring persistence failure

SECONDARY CONTRIBUTING FACTOR:
Google OAuth consent reuse omitting refresh_token when reauthorizing existing client ID.
```

---

## 6. Recommended Fix Scope (Future Implementation Phase)

1. **Force Fresh Consent on Reauthorization**:
   - Ensure the Google authorization URL explicitly forces consent prompt (`prompt=consent`) when reauthorizing an account in `AuthRequired` state.
2. **Handle Omitted Refresh Token During Reconnect**:
   - If Google omits `refresh_token` during reconnection of an account whose existing token is known to be broken (`invalid_grant`), DCC must not silently preserve the broken token. It should either require fresh consent or return `MissingRefreshToken`.
3. **Zero Invariant Breakage**:
   - Invariants I1–I18 and multi-account isolation are preserved.

---

## 7. Final Classification

```text
FINAL CLASSIFICATION:
ROOT_CAUSE_PROVEN
EXECUTION_STOPPED_AFTER_FORENSIC_AUDIT
```
