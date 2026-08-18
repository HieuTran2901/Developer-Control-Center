# AG-9.53 — PRE-IMPLEMENTATION AUDIT REPORT

```text
STATUS:               AUDIT_VERIFIED
DATE:                 2026-08-16
PROTECTED BASELINES:  1. AG-9.41 AI Quota Release Freeze (Commit: 18acaa6, Invariants I1-I18)
                      2. AG-9.47 Multi-Instance Runtime Routing Active
                      3. AG-9.49 Google OAuth Primary + Antigravity Fallback
                      4. AG-9.50 OAuth Security & Correctness Audit
                      5. AG-9.51 OAuth Connect UI/UX
                      6. AG-9.52 Post-OAuth Persistence Forensic Audit
```

---

## 1. Verified Implementation Targets

### Target 1: `GoogleCloudCodeQuotaProvider` (`src-tauri/src/monitor/providers/google_cloud_code_provider.rs`)
- **Current Defect**: Queries `POST /v1internal:loadCodeAssist` expecting `models[]` directly at the root.
- **Required Implementation**:
  1. Retrieve UserInfo identity (`https://www.googleapis.com/oauth2/v2/userinfo`) using Bearer access token.
  2. Validate `expected_email == authenticated_user_email` (Fail closed on mismatch).
  3. Query `POST /v1internal:loadCodeAssist` to obtain `cloudaicompanionProject` and `currentTier`.
  4. Query `POST /v1internal:retrieveUserQuotaSummary` with `{"project": project}` to obtain the live `groups` $\rightarrow$ `buckets` hierarchy.
  5. Map `buckets` into `ModelQuota` with remaining percentage, 5H and Weekly windows, and reset times.

### Target 2: `QuotaProviderService` (`src-tauri/src/monitor/quota_provider.rs`)
- **Current Defect**: Cascades unconditionally into `AntigravityQuotaProvider` on any Google primary failure/empty result, producing an artificial `AuthRequired` state for accounts with valid Google OAuth credentials.
- **Required Implementation**:
  1. Check if the account has a Google OAuth credential in OS Keyring.
  2. If present, execute Google Cloud Code Primary.
  3. If Google returns `Available`, return immediately.
  4. If Google returns `RateLimited` / `NetworkError`, preserve the Google Provider identity and return degraded state rather than wiping out to `AuthRequired`.
  5. Only query Antigravity fallback if Google is unconfigured or if explicitly falling back without wiping Google credential state.

### Target 3: `AddAccountModal.tsx` & `quota_oauth.rs`
- **Current Defect**: `AddAccountModal` calls `onAddAccount` on an unauthenticated placeholder before browser OAuth completes, racing background polling and closing the modal.
- **Required Implementation**:
  1. Trigger Google OAuth directly.
  2. Resolve identity from browser callback.
  3. Create/register the account in `AccountRegistry` only upon successful OAuth callback and token persistence.
  4. Trigger initial refresh on the verified account.

---

## 2. Risk & Invariant Impact Analysis

- **Invariants I1–I18**: 100% Preserved. Quota structures (`ModelQuota`, `AccountQuotaSnapshot`) and deterministic ordering remain unchanged.
- **Account Isolation**: Maintained via OS Keyring per-account storage and strict email identity checks.
- **Fail-Closed Safety**: Retained for all token/network/identity mismatches.
