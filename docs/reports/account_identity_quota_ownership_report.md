# AG-9.23 ACCOUNT IDENTITY & QUOTA OWNERSHIP HARDENING REPORT

---

## 1. Executive Summary & Verification Matrix

```text
Identity Verification:            PASS (Case-insensitive & trimmed matching)
Account A Quota Assignment:       PASS (Assigned ONLY when runtime == expected)
Account B Isolation (Mismatch):   PASS (Zero models returned, status = AuthRequired)
Cache Isolation:                  PASS (owner_email enforced, no cross-account pollution)
Default Placeholder Binding:      PASS (Binds dynamically on default account)
Concrete Default Mismatch:        PASS (Rejects if concrete email != runtime)
Mock / Fabricated Quota:          NONE (Strictly forbidden)
OAuth Invocation:                 NONE (100% Local Bridge)
Secret / Token Exfiltration:      NONE (CSRF & credentials strictly backend-only)

cargo check:                      PASS (Exit 0)
npm run build:                    PASS (Exit 0, 1981 modules transformed)
Live Runtime Test:                PASS (100% assertions verified)

Classification:                   ACCOUNT_QUOTA_OWNERSHIP_VERIFIED
```

---

## 2. Root Cause Analysis & Resolution

### The Previous Bug:
`QuotaProviderService::get_account_quota` and `QuotaPollingEngine::execute_account_refresh` previously stamped the requested `account_id` directly onto the quota snapshot returned by `GetUserStatus` without validating that the authenticated `userStatus.email` matched `acc.email`. As a result, newly added accounts (e.g. Account B) immediately inherited Account A's live quota and 14 models.

### Resolution in AG-9.23:
1. **Strict Identity Verification**:
   - `QuotaProviderService::get_account_quota(&self, account_id: &str, expected_email: Option<&str>, force_refresh: bool)` now extracts `runtime_email` from `snap.account_identity` (`userStatus.email`).
   - Normalizes both `runtime_email` and `expected_email` (`trim().to_ascii_lowercase()`).
   - If `expected_email` does not match `runtime_email`, the request returns an explicit mismatch state:
     - `status: ModelQuotaStatus::AuthRequired`
     - `models: vec![]` (Empty)
     - `data_source: QuotaDataSource::Unavailable`
     - `data_quality: QuotaDataQuality::Unavailable`
     - `safe_diagnostic_message: "Account mismatch: Antigravity is currently authenticated as <runtime_email>, but this account is <expected_email>."`
2. **Cache Ownership Protection**:
   - `QuotaCacheEntry` now stores `owner_email: String`.
   - On mismatch, **nothing is written to the cache**.
   - Cache reads verify `entry.owner_email == normalized_expected`.
3. **UI Mismatch Feedback**:
   - When `snapshot.errorMessage` contains `"Account mismatch"`, `QuotaAccountCard.tsx` renders a prominent **Account Identity Mismatch** warning badge and explanation.

---

## 3. Live Runtime Test Evidence

```text
Connecting to Language Server PID: 1744 on Port: 50923
Authoritative Runtime Identity: hieutrankrm204t@gmail.com
Total Live Models in Language Server: 14

Test A — Authenticated Account A (Exact Match):
  - Expected: hieutrankrm204t@gmail.com
  - Result: Status = Online | DataQuality = Live | Models = 14
  - PASS

Test B — Case-Insensitive & Whitespace Match:
  - Expected: "  HieuTranKRM204t@Gmail.com  "
  - Result: Status = Online | DataQuality = Live | Models = 14
  - PASS

Test C — Unauthenticated Account B (Mismatch):
  - Expected: work@company.com
  - Result: Status = AuthRequired | DataQuality = Unavailable | Models = 0
  - Diagnostic: "Account mismatch: Antigravity is currently authenticated as hieutrankrm204t@gmail.com, but this account is work@company.com."
  - PASS

Test D — Default Placeholder Binding:
  - Expected: default@antigravity.oauth (on account_id = "default")
  - Result: Status = Online | DataQuality = Live | Models = 14 (Bound to hieutrankrm204t@gmail.com)
  - PASS
```

---

## 4. Invariant Compliance Checklist

- **I1: Every Live quota snapshot has exactly one owner account** -> `PASS`
- **I2: Runtime email must equal snapshot owner email** -> `PASS`
- **I3: A mismatched runtime response cannot enter another account's cache** -> `PASS`
- **I4: A cached quota can only be returned to its original verified account** -> `PASS`
- **I5: A newly created account has no quota until identity verification succeeds** -> `PASS`
- **I6: One language_server runtime cannot represent multiple authenticated accounts** -> `PASS`
- **I7: Live data requires both HTTP 200 + identity match** -> `PASS`

---

## 5. Final Classification

**`ACCOUNT_QUOTA_OWNERSHIP_VERIFIED`**
