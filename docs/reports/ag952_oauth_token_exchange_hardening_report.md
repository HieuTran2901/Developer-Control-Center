# AG-9.52 — GOOGLE OAUTH TOKEN EXCHANGE HARDENING REPORT

```text
STATUS:               COMPLETED
CLASSIFICATION:       OAUTH_TOKEN_EXCHANGE_FIXED
DATE:                 2026-08-16
PROTECTED BASELINES:  1. AI Quota Subsystem (Release Frozen at AG-9.41, Commit: 18acaa6, Invariants I1-I18)
                      2. AG-9.45 Release Candidate Ready
                      3. AG-9.47 Multi-Instance Runtime Routing Active
                      4. AG-9.49 Google OAuth Primary + Antigravity Fallback
                      5. AG-9.50 OAuth Security & Correctness Audit
                      6. AG-9.51 Google OAuth Multi-Account Connect UI/UX
```

---

## 1. Architectural Changes Made

1. **`src-tauri/src/monitor/quota_oauth.rs`**:
   - Added `DEFAULT_GOOGLE_CLIENT_SECRET` constant paired with `DEFAULT_GOOGLE_CLIENT_ID`.
   - Updated `GoogleOAuthService` to read `DCC_GOOGLE_OAUTH_CLIENT_SECRET` (with default fallback).
   - In `exchange_auth_code`: included `client_secret` in form parameters sent to `https://oauth2.googleapis.com/token` alongside `code_verifier` (PKCE S256).

2. **`src-tauri/src/monitor/providers/google_cloud_code_provider.rs`**:
   - Updated `GoogleCloudCodeQuotaProvider` to read `DCC_GOOGLE_OAUTH_CLIENT_SECRET`.
   - In `refresh_access_token`: included `client_secret` in form parameters sent to `https://oauth2.googleapis.com/token`.

3. **`docs/decisions.md`**:
   - Appended Architectural Decision #42.

---

## 2. Security Guarantees & Non-Exposure

- **React State**: 0 client secrets or refresh tokens.
- **IPC Payloads**: 0 client secrets or refresh tokens.
- **Persistent JSON**: 0 client secrets or refresh tokens.
- **Diagnostics & Fingerprints**: `get_client_fingerprint()` displays only safe truncated client ID fingerprints (e.g. `88435491...cod268c5blh`), completely omitting secrets.
- **Keyring Storage**: Refresh tokens are stored exclusively in the OS Keyring (Windows Credential Manager via `KeyringCredentialStorage`).

---

## 3. Build & Test Results

- `cargo check`: **PASS (Exit 0)**
- `npm run build`: **PASS (Exit 0, 1981 modules)**
- `verify_ag952_token_exchange_fix.py`: **PASS**
- Quota Invariants I1–I18: **100% PRESERVED**
