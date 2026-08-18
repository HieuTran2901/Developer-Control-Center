# AG-9.65 — PRE-IMPLEMENTATION MULTI-ACCOUNT UI AUDIT REPORT

```text
STATUS:               AUDIT_COMPLETED
DATE:                 2026-08-17
AUDIT MODE:           PRE-IMPLEMENTATION READ-ONLY AUDIT
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
```

---

## 1. Existing Account Lifecycle APIs & Commands

| Lifecycle Operation | Frontend Service Method | Backend Tauri Command | Security & Storage Scope |
| :--- | :--- | :--- | :--- |
| **Get All States** | `quotaPollingService.getAllStates()` | `quota_get_all_states_cmd` | In-memory snapshots sorted deterministically |
| **Refresh Single Account** | `quotaPollingService.refreshAccount(id)` | `quota_refresh_account_cmd` | Scoped to target `accountId` |
| **Refresh All Accounts** | `quotaPollingService.refreshAll()` | `quota_refresh_all_cmd` | Semaphore-bounded concurrency (`MAX_CONCURRENT_REFRESHES = 2`) |
| **Connect / Reconnect Google** | `quotaPollingService.connectGoogleAccount(id, allowUpdate)` | `quota_connect_google_account_cmd` | PKCE S256, UserInfo identity check, OS Keyring target |
| **Connect Antigravity** | `quotaPollingService.connectAntigravityAccount(id)` | `quota_connect_antigravity_account_cmd` | Sets provider to `Antigravity`, queries language server |
| **Disconnect Google** | `quotaPollingService.disconnectGoogleAccount(id)` | `quota_disconnect_google_account_cmd` | Deletes Keyring credential, retains DCC account |
| **Remove Account** | `quotaPollingService.removeAccount(id)` | `quota_remove_account_cmd` | Deletes from registry, snapshot cache, Keyring with resurrection protection |
| **Rename Account** | `quotaPollingService.renameAccount(id, name)` | `quota_rename_account_cmd` | Updates display name in registry & snapshot |
| **Toggle Enabled** | `quotaPollingService.setAccountEnabled(id, bool)` | `quota_set_account_enabled_cmd` | Toggles active polling status |
| **Toggle Auto-Connect** | `quotaPollingService.setAccountAutoConnect(id, bool)` | `quota_set_account_auto_connect_cmd` | Toggles startup connection |

---

## 2. Existing UI Component Architecture

```text
QuotaDashboard (src/features/settings/components/QuotaDashboard.tsx)
  ├── QuotaSummary (Global account count, active models, polling status)
  ├── Action Toolbar ("Refresh All", "Add Account", "Auto Refresh Settings")
  └── Account Grid
        └── QuotaAccountCard (src/features/settings/components/QuotaAccountCard.tsx)
              ├── Provider Badges:
              │     ├── "Google Cloud Code · Primary" (Blue pulse)
              │     └── "Antigravity · Fallback" (Emerald)
              ├── Status Badges:
              │     ├── "Connected" (Online)
              │     ├── "Google Auth Required" / "Reauthorization Required"
              │     ├── "Account Mismatch"
              │     └── "Offline" / "Error"
              ├── Relative Last-Sync Time ("Updated 12s ago")
              ├── Quota Pool Columns (5H and Weekly buckets with reset countdowns)
              ├── Model Breakdown Accordion (Tier and model labels)
              └── Actions Menu:
                    ├── "Refresh Quota"
                    ├── "Connect / Reconnect Google OAuth"
                    ├── "Disconnect Google OAuth"
                    ├── "Connect Antigravity"
                    ├── "Enable / Disable Monitoring"
                    ├── "Rename Account"
                    └── "Remove Account"
```

---

## 3. Minimal Files Requiring Verification & Hardening

1. `src/features/settings/components/QuotaAccountCard.tsx`: Ensure status badges, reconnect buttons, disconnect actions, and relative sync timestamps seamlessly reflect 3+ multi-account Google Primary states.
2. `src/features/settings/components/QuotaDashboard.tsx`: Ensure "Refresh All" respects backend concurrency and handles partial failure states without jitter.
3. `src/features/settings/components/AddAccountModal.tsx`: Verify seamless 1-click Google OAuth account onboarding.
