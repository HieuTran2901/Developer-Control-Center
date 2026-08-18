# AG-9.59 — GOOGLE OAUTH CLIENT COMPATIBILITY & CLOUD CODE AUTHORIZATION FORENSIC AUDIT REPORT

```text
STATUS:               AUDIT_COMPLETED
CLASSIFICATION:       GO
DATE:                 2026-08-16
AUDIT MODE:           STRICT READ-ONLY FORENSIC AUDIT (ZERO CODE / CONFIG MODIFIED)
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
```

---

## 1. Executive Summary

A comprehensive read-only forensic audit was conducted to evaluate whether Developer Control Center (DCC) can utilize its own Google OAuth 2.0 Desktop Client to independently monitor individual quota for multiple Google accounts with **0 running Antigravity IDE instances**.

### Final Determination: **`GO`**
The target multi-account architecture:
```text
DCC Google OAuth Client (Desktop App / PKCE S256)
        │
        ├── Google Account A ──> Refresh Token A ──> Access Token A ──> Cloud Code Quota A
        ├── Google Account B ──> Refresh Token B ──> Access Token B ──> Cloud Code Quota B
        └── Google Account C ──> Refresh Token C ──> Access Token C ──> Cloud Code Quota C
```
is **technically viable, operationally robust, and completely decoupled from Antigravity IDE**.

---

## 2. Current OAuth Architecture Audit (`quota_oauth.rs` & `google_cloud_code_provider.rs`)

1. **Authorization URL**: `https://accounts.google.com/o/oauth2/v2/auth`
2. **Client ID & Secret Configuration**: Desktop Application client paired with `DEFAULT_GOOGLE_CLIENT_SECRET` (`GOCSPX-REDACTED-OAUTH-SECRET-PRIMARY`), configurable via environment variables `DCC_GOOGLE_OAUTH_CLIENT_ID` and `DCC_GOOGLE_OAUTH_CLIENT_SECRET`.
3. **Redirect URI**: Dynamically allocated loopback port (`http://127.0.0.1:<port>`).
4. **PKCE Implementation**: RFC 7636 with SHA-256 code challenge (`code_challenge_method=S256`), cryptographically secure high-entropy `code_verifier`.
5. **Requested Scopes**:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/cloud-platform`
6. **Authorization Modifiers**: `access_type=offline` and `prompt=select_account consent` to guarantee long-lived refresh token generation.
7. **Storage & Isolation**:
   - **Refresh Tokens**: Persisted exclusively in OS Keyring (Windows Credential Manager) under target `<accountId>.developer-control-center:antigravity-oauth`.
   - **Access Tokens**: Strictly ephemeral and memory-only (AG-9.58 invariant enforced: never written to `save_refresh_token`).

---

## 3. OAuth Client Type & Authorization Protocol

- **Client Type**: Desktop Application (Native Installed App).
- **Callback Protocol**: Loopback HTTP listener (`127.0.0.1`) conforming to Google Identity and OAuth 2.0 best practices for Native Apps (RFC 8252).
- **Client Secret Role**: Included in token endpoint exchanges to satisfy Google OAuth Client pairing constraints while utilizing PKCE S256 for proof of possession.

---

## 4. Cloud Code PA API Authorization Compatibility

Cloud Code Prediction and Quota API endpoints accept Bearer tokens issued under the `https://www.googleapis.com/auth/cloud-platform` scope:

1. **Step 1 — Project Discovery**:
   - **Endpoint**: `POST https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist`
   - **Header**: `Authorization: Bearer <access_token>`
   - **Payload**: `{"metadata": {"ideType": "DCC", "pluginType": "GEMINI"}}`
   - **Response**: Returns `cloudaicompanionProject` and `currentTier`.
2. **Step 2 — Quota Summary Extraction**:
   - **Endpoint**: `POST https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary`
   - **Header**: `Authorization: Bearer <access_token>`
   - **Payload**: `{"project": "<cloudaicompanionProject>"}`
   - **Response**: Returns structured `groups[].buckets[]` with exact remaining fraction, 5H window, and weekly window.

---

## 5. Token Identity & Fail-Closed Multi-Account Verification

Before saving credentials or accepting quota data, DCC enforces a strict 4-way identity check:
$$\text{OAuth Email} == \text{UserInfo Email} == \text{Cloud Code Identity} == \text{DCC Expected Email}$$
If any mismatch occurs, DCC **fails closed** and never stores or cross-contaminates quota data between accounts.

---

## 6. Antigravity Dependency Audit

| Subsystem Component | Google Primary Role | Antigravity Fallback Role | Dependency Status |
| :--- | :--- | :--- | :--- |
| **`language_server.exe`** | Not used | Required for local RPC | Independent |
| **Antigravity IDE Window** | Not used | Required for local process | Independent |
| **Connect-RPC / Local Port** | Not used | Required for local probing | Independent |
| **OS Keyring** | Required (Refresh Token) | Optional | Isolated per account |
| **Google Cloud Code API** | Primary Quota Source | Not used | Cloud-direct |

Google Primary monitoring functions with **0 Antigravity IDE instances running**.

---

## 7. Failure-State Matrix

| Failure Condition | Google Provider State | Fallback Provider State | UI Card Display | UI Action |
| :--- | :--- | :--- | :--- | :--- |
| **No Credential** | `CredentialUnavailable` | Inactive | `Google Auth Required` | `"Connect Google OAuth"` |
| **Valid Credential** | `Available` | Inactive | `Online: Google Cloud Code · Primary` | Live Model Gauges |
| **Invalid/Revoked Token** | `ReauthorizationRequired` | Inactive | `Google Reauthorization Required` | `"Reconnect Google Account"` |
| **Cloud Code 401/403** | `AuthRequired` | Inactive | `Google Auth Required` | `"Connect Google OAuth"` |
| **Transient Network Error** | `NetworkError` | Preserves Stale | `Stale Quota Banner` | `"Retry"` |
| **Antigravity Closed** | `Available` (Unaffected) | Offline | `Online: Google Cloud Code · Primary` | None needed |

---

## 8. Invariant Regression Verification (I1–I18)

- **I1–I5 (Identity & Data Isolation)**: Guaranteed by account-scoped OS Keyring entries and fail-closed UserInfo verification.
- **I6–I8 (Deterministic Ordering & Ownership)**: `createdAt ASC -> accountId ASC` sorting and `ModelQuota` 5H/Weekly ownership strictly preserved.
- **I9–I10 (Decoupling & Fail-Closed)**: Primary and fallback providers remain decoupled.
- **I11–I13 (Bounded Concurrency)**: `MAX_CONCURRENT_REFRESHES = 2` strictly enforced via async semaphore.
- **I14–I18 (Resurrection Protection & Lifecycle)**: Dual resurrection gates prevent phantom account creation.

---

## 9. Final Decision & Classification

```text
FINAL CLASSIFICATION:
GO

AUDIT CONCLUSION:
DCC can legitimately use its own Google OAuth Client to independently monitor
each Google account's Cloud Code quota with 0 running Antigravity IDE instances.
```
