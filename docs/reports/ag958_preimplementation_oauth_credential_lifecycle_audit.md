# AG-9.58 — PRE-IMPLEMENTATION OAUTH CREDENTIAL LIFECYCLE AUDIT REPORT

```text
STATUS:               AUDIT_VERIFIED
DATE:                 2026-08-16
PROTECTED BASELINES:  1. AG-9.41 AI Quota Subsystem Release Freeze (Commit: 18acaa6, Invariants I1-I18)
                      2. AG-9.47 Multi-Instance Runtime Discovery
                      3. AG-9.49 Google OAuth Primary + Antigravity Fallback
                      4. AG-9.50 OAuth Security & Correctness Audit
                      5. AG-9.51 Google OAuth Connect UI/UX
                      6. AG-9.52 Post-OAuth Persistence Forensic Audit
                      7. AG-9.53 Cloud Code Quota API Correction
                      8. AG-9.54 Google OAuth Client Pairing & State Hardening
                      9. AG-9.55 Forensic Finding: invalid_grant
                      10. AG-9.56 Google OAuth Reauthorization Hardening
                      11. AG-9.57 Post-Reauth Credential Consumption Audit
```

---

## 1. Lifecycle Analysis & Target Findings

### Target 1: Token Reception & Persistence Boundary (`quota_oauth.rs`)
- **Where `access_token` & `refresh_token` are received**:
  - `exchange_auth_code` sends authorization code to `https://oauth2.googleapis.com/token`.
  - JSON payload contains `access_token: String` (ephemeral) and `refresh_token: Option<String>` (long-lived).
- **The Defect at Line 347 (`quota_oauth.rs`)**:
  ```rust
  let token_to_store = if !refresh_token.is_empty() {
      refresh_token
  } else {
      access_token // <-- SEVERE DEFECT: stores ephemeral access token as refresh token!
  };
  ```
  When Google omits `refresh_token` on repeat authorization without prompt=consent, DCC stored the short-lived `access_token` into the refresh token storage.
- **Subsequent Polling Failure**:
  `refresh_access_token` sends `grant_type=refresh_token&refresh_token=<stored access token>`, which Google rejects with `HTTP 400 invalid_grant`.

### Target 2: UI Presentation Defect (`QuotaAccountCard.tsx`)
- **Location**: `renderStatusBadge` in `QuotaAccountCard.tsx` (lines 825–839).
- **The Defect**:
  When `snapshot.status === 'AuthRequired'`, the badge unconditionally renders `Antigravity Offline`, ignoring whether the provider is `Google Cloud Code` or `Antigravity`.

---

## 2. Implementation Action Plan

1. **Strict Token Separation (`quota_oauth.rs`)**:
   - Never store `access_token` as a `refresh_token`.
   - In authorization URL: Ensure `access_type=offline&prompt=consent` is present.
   - On token exchange: If `refresh_token` is present, store it. If absent, retain existing refresh token if present; otherwise fail with `MissingRefreshToken` requiring full consent.
2. **UI Status Badge Decoupling (`QuotaAccountCard.tsx`)**:
   - Update `renderStatusBadge` to accept `isGooglePrimary`.
   - When `isGooglePrimary` is true:
     - `AuthRequired` $\rightarrow$ `Google Auth Required`
     - `ReauthorizationRequired` $\rightarrow$ `Reauthorization Required`
   - When `isGooglePrimary` is false:
     - `AuthRequired` $\rightarrow$ `Antigravity Offline`
3. **Deterministic Verification**:
   - Verify that access tokens are never persisted in Keyring.
   - Verify that `invalid_grant` is eliminated.
   - Verify that 0-IDE monitoring and multi-account isolation are preserved.
