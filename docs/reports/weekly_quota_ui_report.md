# AG-9.29 — WEEKLY QUOTA INTEGRATION & AI QUOTA UI REDESIGN REPORT

## 1. Executive Summary

- **Status**: `COMPLETED`
- **Classification**: `WEEKLY_QUOTA_RUNTIME_AND_UI_REDESIGN_READY`
- **Objective**: Integrate real Weekly Quota data alongside the 5-hour short-term quota directly from the live Antigravity Connect-RPC runtime, with zero mock data, strict identity isolation, unified polling lifecycle, and high-density 2-column responsive layout matching the reference mockup.

---

## 2. Forensic Discovery & Real Runtime Endpoints

### 2.1 Short-Term Quota Source
- **RPC Endpoint**: `/exa.language_server_pb.LanguageServerService/GetUserStatus`
- **Field Path**: `userStatus.cascadeModelConfigData.clientModelConfigs[].quotaInfo.remainingFraction` and `resetTime`
- **Window Type**: 5-hour limit smoothing aggregate demand across models.

### 2.2 Weekly Quota Source
- **RPC Endpoint**: `/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary`
- **Field Path**: `response.groups[].buckets[]` where `bucket.window == "weekly"`
- **Fields**:
  - `bucketId`: `"gemini-weekly"` / `"3p-weekly"`
  - `displayName`: `"Weekly Limit Remaining"`
  - `remainingFraction`: Real live floating-point fraction (e.g. `0.050` = `5.0%` for Gemini, `1.0` = `100.0%` for Claude/GPT)
  - `resetTime`: ISO 8601 UTC timestamp (e.g. `"2026-08-20T10:35:20Z"` / `"2026-08-23T05:55:39Z"`)
  - `description`: Explains quota reset duration (e.g. *"You have used some of your weekly limit, it will fully refresh in 4 days, 4 hours."*)

### 2.3 Weekly Reset Source
- **Field**: `bucket.resetTime`
- **Format**: Dynamic human-readable representation:
  - $\ge 24\text{h}$: `Reset in 4d 4h` / `Reset in 4d 12h`
  - $< 24\text{h}$: `Reset in 18h 30m`

### 2.4 Quota Group Identity & Shared Mapping
- **Groups**:
  1. `Gemini Models` (`"gemini-5h"` + `"gemini-weekly"`) $\rightarrow$ Mapped to Gemini models (11 models) as **Gemini Shared**.
  2. `Claude and GPT models` (`"3p-5h"` + `"3p-weekly"`) $\rightarrow$ Mapped to Claude models (2 models) as **Claude Shared** and GPT models (1 model) as **GPT-OSS 120B (Medium)**.

---

## 3. Architecture & Domain Model

### 3.1 Backend Multi-Window Model (`quota_provider.rs` & `antigravity_quota.rs`)
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaWindowInfo {
    pub window_type: String, // "5h" | "weekly" | "custom"
    pub remaining_fraction: Option<f64>,
    pub remaining_percentage: Option<f64>,
    pub reset_time: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelQuota {
    pub model_id: String,
    pub display_name: String,
    pub remaining_fraction: Option<f64>,
    pub remaining_percentage: Option<f64>,
    pub reset_at: Option<String>,
    pub status: ModelQuotaStatus,
    pub weekly_remaining_fraction: Option<f64>,
    pub weekly_remaining_percentage: Option<f64>,
    pub weekly_reset_at: Option<String>,
    #[serde(default)]
    pub windows: Vec<QuotaWindowInfo>,
}
```

### 3.2 Dual-Query Connect-RPC Pipeline
In `AntigravityQuotaClient::fetch_quota_from_runtime`:
1. Dispatches `POST /GetUserStatus` to retrieve user identity (`email`), plan details (`Pro`), and 14 model configurations.
2. Dispatches `POST /RetrieveUserQuotaSummary` to retrieve real 5h and weekly quota buckets.
3. Combines both responses atomically into `AntigravityQuotaSnapshot`.

---

## 4. UI/UX Implementation Details

### 4.1 Layout Alignment & Visual Reference Match
- **2-Column Responsive Desktop Grid**: `grid-cols-1 lg:grid-cols-2 gap-3.5 items-start`
- **Connected Account Card Layout**:
  - Header: `[ANTIGRAVITY] account_name` with `● Connected` pill, `Updated Xm ago`, and `⋮` menu.
  - Subtitle: `Standard Tier · email`
  - Horizontal Quota Group Tiles (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5`):
    - **Top (Short-Term)**: Name, short-term percentage (`font-mono font-bold`), progress bar (amber/green), `11 models · Reset 43m · Ready`.
    - **Bottom (Weekly)**: `Weekly` label, weekly percentage (`font-mono font-bold`), weekly progress bar (sky blue), `Reset in 4d 12h`.
    - **Collapsible Footer**: `11 models using this quota ›` expanding internal scrollable list without stretching card height.
- **Identity Mismatch Card**:
  - Header: `[ANTIGRAVITY] account_name` with `● Antigravity Offline` pill.
  - Diagnostic Block: `⚠ Account Identity Mismatch` with authoritative details:
    *"Antigravity is currently authenticated as `hieutrankrm204t@gmail.com` but this account is `trunghieu10a1thptll@gmail.com`."*
  - Footer: `◷ Not synced yet` with `[Connect Antigravity]` and `[Refresh]` buttons.

---

## 5. Security Invariants Verification

| Invariant | Description | Verification Status |
| :--- | :--- | :--- |
| **I1** | One account $\rightarrow$ exactly one provider | **VERIFIED** |
| **I2** | Provider $\rightarrow$ only its own runtime/API | **VERIFIED** |
| **I3-I4** | Provider cache & snapshot isolation | **VERIFIED** |
| **I5** | Unsupported provider never falls back | **VERIFIED** |
| **I6-I7** | Strict identity validation (`runtime_email == expected_email`), fail-closed | **VERIFIED** |
| **I8-I9** | Provider-agnostic engine & generic multi-window model | **VERIFIED** |
| **I10** | Backend-only credentials; volatile runtime secrets never persisted | **VERIFIED** |
| **I11-I12** | Antigravity isolation & live Connect-RPC behavior preserved | **VERIFIED** |
| **I13** | Singleton background polling loop guarantee | **VERIFIED** |

---

## 6. Verification Results Matrix

```text
Short-term quota source:
/exa.language_server_pb.LanguageServerService/GetUserStatus (cascadeModelConfigData.clientModelConfigs[].quotaInfo)
and /RetrieveUserQuotaSummary (bucket.window == "5h")

Weekly quota source:
/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary (bucket.window == "weekly")

Weekly reset source:
/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary (bucket.resetTime)

Quota group identity:
gemini-weekly / gemini-5h (Gemini Shared) and 3p-weekly / 3p-5h (Claude Shared, GPT-OSS)

Runtime verification:
PASS

Identity isolation:
PASS

Restart persistence:
PASS

Automatic refresh:
PASS

UI regression:
PASS
```

### Compiler & Build Checks:
- `cargo check --manifest-path src-tauri/Cargo.toml`: **PASS (Exit 0)**
- `npm run build`: **PASS (Exit 0, 1981 modules)**
- `verify_weekly_quota_runtime.py`: **PASS (All tests)**

---

## 7. Classification

**`WEEKLY_QUOTA_RUNTIME_AND_UI_REDESIGN_READY`**
