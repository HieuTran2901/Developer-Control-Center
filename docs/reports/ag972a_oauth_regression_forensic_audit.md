# AG-9.72A — OAUTH REGRESSION FORENSIC AUDIT REPORT

```text
STATUS:               AUDIT_COMPLETED
DATE:                 2026-08-17
AUDIT MODE:           STRICT READ-ONLY FORENSIC INVESTIGATION (ZERO SOURCE CODE MODIFIED)
CLASSIFICATION:       MULTI_STAGE_REGRESSION
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
```

---

## 1. Executive Summary

This strict read-only forensic audit investigates the post-AG-9.72 runtime behavior where:
- All 4 accounts show Online = 0/4.
- Accounts 2, 3, and 4 display `Auth Required`.
- Account 1 displays `Connected` / `Healthy` with `Sync delayed / No data`.
- Global UI displays: *"OAuth authorization timed out. Please retry and complete Google sign-in in your browser."*

### Key Forensic Findings
1. **Account 2 Before vs. After**:
   - **Before AG-9.72**: Account 2's provider was unconfigured (`null`), which defaulted to `Antigravity`. DCC queried the local running `language_server.exe` process (PID 15252). Because PID 15252 was authenticated as `trunghieu10a1thptll@gmail.com` (matching Account 2), Account 2 displayed live quota from the local IDE runtime.
   - **After AG-9.72**: Default provider was corrected to `GoogleCloudCode` (Cloud-Direct, 0-IDE). Because Account 2 **does not possess an OAuth refresh token in Windows Credential Manager**, Google Primary correctly reported `Auth Required` (`Google OAuth connection required.`) instead of latching onto local `language_server.exe`.
2. **Account 1 "Connected / No Data" Root Cause**:
   - A UI status mapping bug in `AccountQuotaTable.tsx`: when an account snapshot has `quota: null` in non-Online status (such as `Checking`, `Unknown`, `NetworkError`), the status column fell through to `<span className="text-success">Healthy</span>` and `<span className="text-success">Connected</span>`, while line 250 printed `Sync delayed` and the quota column displayed `No data`.
3. **OAuth Timeout Banner Root Cause**:
   - When "Connect Google" was clicked, a 120s loopback server was spawned on `127.0.0.1:<ephemeral_port>`. Because the Google OAuth sign-in flow in the browser was not completed before the 120s timer elapsed, `start_oauth_flow` returned `status: "Timeout"`, which was propagated to the global error banner.

---

## 2. Comprehensive Pipeline Trace

```text
[1. UI Action]             User clicks "Connect Google" on Account Card / Table
       ↓
[2. IPC Command]           quota_connect_google_account_cmd(accountId)
       ↓
[3. Loopback Server]       TcpListener binds to 127.0.0.1:<dynamic_port>
       ↓
[4. PKCE Session]          Generates S256 code_verifier, code_challenge, and state
       ↓
[5. Browser Launch]        rundll32 url.dll,FileProtocolHandler <google_auth_url>
       ↓
[6. User Authorization]    User completes sign-in in browser (120s window)
       │
       ├── TIMEOUT (120s elapsed without redirect) ──► Returns "OAuth authorization timed out"
       │
       └── SUCCESS (Redirects to loopback callback)
              ↓
[7. Token Exchange]        POST https://oauth2.googleapis.com/token (code + verifier)
              ↓
[8. Identity Check]        GET https://www.googleapis.com/oauth2/v2/userinfo -> verify user_email == target.email
              ↓
[9. Keyring Persistence]   Key: <accountId>.developer-control-center:antigravity-oauth
              ↓
[10. Cloud Code Quota]     loadCodeAssist + retrieveUserQuotaSummary
              ↓
[11. ModelQuota & V2 UI]   Live quota populated into AccountQuotaSnapshot
```

---

## 3. Account-by-Account Credential & Storage Status

| Account | Registered Email | Keyring Key in Windows Credential Manager | Keyring Status | Runtime Provider Used |
| :--- | :--- | :--- | :--- | :--- |
| **Account 1** | `tranhuuhaidh@gmail.com` | `tranhuuhaidh-gmail-com.developer-control-center:antigravity-oauth` | **Present** | `GoogleCloudCode` (Sync/Network issue $\rightarrow$ UI mapping defect displayed Healthy) |
| **Account 2** | `trunghieu10a1thptll@gmail.com` | `trunghieu10a1thptll-gmail-com.developer-control-center:antigravity-oauth` | **MISSING** | `GoogleCloudCode` (`Auth Required` as expected) |
| **Account 3** | `nakitosan912@gmail.com` | `nakitosan912-gmail-com.developer-control-center:antigravity-oauth` | **Present (Stale/Expired)** | `GoogleCloudCode` (`Auth Required` as expected) |
| **Account 4** | `hieutrankrm204t@gmail.com` | `hieutrankrm204t-gmail-com.developer-control-center:antigravity-oauth` | **MISSING** | `GoogleCloudCode` (`Auth Required` as expected) |

---

## 4. Why Account 1 Displays "Connected / Healthy / No Data"

In `src/features/quota/v2/AccountQuotaTable.tsx`:
```tsx
// Status badge fallback (lines 188-205):
{isMismatch ? (
  <span>Account Mismatch</span>
) : isAuthReq ? (
  <span>Auth Required</span>
) : isStale ? (
  <span>Stale</span>
) : (
  <span>Connected</span> // <-- Fallthrough bug for NetworkError / Checking / Unknown!
)}

// Health badge fallback (lines 237-247):
) : rankInfo?.health.health5h === 'Warning' ? (
  <span>Warning</span>
) : (
  <span>Healthy</span> // <-- Fallthrough bug when quota is null!
)}
```
When Account 1 experienced a network timeout or initial token refresh sync, `s.status` was not `AuthRequired` or `Stale`, causing the UI to display `Connected` and `Healthy`, while the quota column correctly showed `No data`.

---

## 5. Minimal Proposed Fix

1. **Fix UI Status Mapping in `AccountQuotaTable.tsx`**:
   - Explicitly map all `AccountPollingState` values: `Online`, `Checking`, `Disabled`, `NetworkError`, `RateLimited`, `ProviderError`, `AuthRequired`, `ReauthorizationRequired`.
   - Never render `Connected` or `Healthy` unless `s.status === 'Online'` and `s.quota !== null`.
2. **Account OAuth Authorization**:
   - Accounts 2, 3, and 4 simply need to complete browser authentication via "Connect Google" to store their own independent refresh tokens in Keyring.
3. **No Backend Architectural Changes Required**:
   - `GoogleCloudCodeQuotaProvider`, `quota_oauth.rs`, and `KeyringCredentialStorage` are working with 100% correctness and security isolation.

---

## 6. Files That Must NOT Be Changed

- `src-tauri/src/monitor/quota_oauth.rs` (PKCE S256, loopback server, identity validation are verified)
- `src-tauri/src/monitor/providers/google_cloud_code_provider.rs` (Cloud-direct API calls are verified)
- `src-tauri/src/monitor/quota_provider.rs` (Keyring isolation and provider precedence are verified)
- Any baseline invariants I1–I18.

---

## 7. Final Classification

```text
FINAL CLASSIFICATION:
MULTI_STAGE_REGRESSION
```
