# AG-9.77 — V1 ANTIGRAVITY VS GOOGLE CLOUD CODE QUOTA PATH FORENSIC COMPARISON REPORT

```text
STATUS:               AUDIT_COMPLETED
DATE:                 2026-08-17
AUDIT MODE:           STRICT READ-ONLY FORENSIC INVESTIGATION (ZERO SOURCE CODE MODIFIED)
PRIMARY QUESTION:     Why does V1 return real quota (57% 5H, 30% Weekly, 14 models) for Account 2
                      while V2 Google Cloud Code returns empty/unprovisioned quota after Google OAuth?
CLASSIFICATION:       V1_V2_QUOTA_PATH_DIFFERENCE_PROVEN / DIFFERENT_API (C)
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
```

---

## 1. Executive Summary

This strict read-only forensic audit investigates the technical divergence between:
- **Path A (V1 Antigravity Local Runtime)**: Retrieves live 5H quota (57%), Weekly quota (30%), 14 Cascade models, and active reset countdown (~59m) for Account 2 (`trunghieu10a1thptll@gmail.com`).
- **Path B (V2 Google Cloud Code Cloud-Direct)**: Successfully connects Google OAuth, validates UserInfo identity, but returns empty/unprovisioned quota on `cloudcode-pa.googleapis.com`.

### Core Forensic Finding
The two paths query **fundamentally different APIs, different services, and different quota backends**:
1. **V1 queries Antigravity's Local Language Server RPC** (`LanguageServerService/GetUserStatus` and `RetrieveUserQuotaSummary` on `127.0.0.1:<port>`). This local service communicates with **Antigravity's multi-model AI gateway**, which manages the user's IDE session across all 14 models (Gemini 2.5 Flash, Gemini 2.5 Pro, Claude 3.5 Sonnet, GPT-4o, etc.).
2. **V2 queries Google's Cloud Code Platform API** (`cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary`). This endpoint monitors **Google Cloud Platform (GCP) Gemini Code Assist projects**. For standard consumer Google accounts or accounts without an active GCP Cloud AI Companion project provisioned, Google Cloud Code returns no quota buckets.

---

## 2. V1 Runtime Quota Pipeline (Path A)

```text
[DCC V1: Connect Antigravity]
       ↓
[Process Discovery]             Scans OS process table for language_server.exe (PID 15252)
       ↓
[Parameter Extraction]          Extracts ephemeral HTTPS port + CSRF token from process command line
       ↓
[Local Connect-RPC Endpoint]    https://127.0.0.1:<port>/exa.language_server_pb.LanguageServerService/GetUserStatus
       ↓
[RPC Request]                   POST {} with Connect-Protocol-Version: 1, x-codeium-csrf-token
       ↓
[RPC Response Payload]          userStatus: {
                                  email: "trunghieu10a1thptll@gmail.com",
                                  planStatus: { planInfo: { teamsTier: "Standard Tier" } },
                                  cascadeModelConfigData: {
                                    clientModelConfigs: [ 14 model configurations with quotaInfo ]
                                  }
                                }
       ↓
[Secondary RPC Endpoint]        https://127.0.0.1:<port>/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary
       ↓
[Quota Summary Extraction]      response.groups -> Gemini & 3P model buckets (weekly quota = 30%)
       ↓
[Resulting V1 Snapshot]         14 Models, 5H = 57%, Weekly = 30%, Resets in ~59m
```

---

## 3. V2 Google Cloud Code Pipeline (Path B)

```text
[DCC V2: Connect Google]
       ↓
[OAuth PKCE Loopback Flow]      Authenticates with Google OAuth client ID/secret
       ↓
[Token Persistence]             Stores refresh_token in Windows Credential Manager
       ↓
[Google UserInfo]               GET https://www.googleapis.com/oauth2/v2/userinfo -> verifies email
       ↓
[Cloud Code Project Check]      POST https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist
                                -> Returns metadata, but cloudaicompanionProject is None
       ↓
[Cloud Code Quota Summary]      POST https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary with {}
                                -> Returns HTTP 400 / 404 or empty groups [] (Account lacks GCP project)
       ↓
[Resulting V2 Snapshot]         Online, quota = null, Sync Pending / Quota Unavailable (No fake data)
```

---

## 4. Side-by-Side Comparison Matrix

| Architectural Dimension | V1 Antigravity Local Runtime (Path A) | V2 Google Cloud Code (Path B) | Comparison Status |
| :--- | :--- | :--- | :--- |
| **Target Protocol** | Connect-RPC over local HTTPS (`127.0.0.1`) | REST / JSON over public HTTPS | **DIFFERENT** |
| **Target Host** | `127.0.0.1:<dynamic_port>` | `cloudcode-pa.googleapis.com` | **DIFFERENT** |
| **Process Dependency** | `language_server.exe` (PID 15252) | None (0 IDE / 0 language_server.exe) | **DIFFERENT** |
| **Authentication Type** | Local process CSRF Token | Google OAuth 2.0 PKCE Bearer Token | **DIFFERENT** |
| **Identity Source** | `GetUserStatus` (`userStatus.email`) | `oauth2.googleapis.com/userinfo` | **MATCH** (Both resolve to same email) |
| **API Method 1** | `LanguageServerService/GetUserStatus` | `v1internal:loadCodeAssist` | **DIFFERENT** |
| **API Method 2** | `LanguageServerService/RetrieveUserQuotaSummary`| `v1internal:retrieveUserQuotaSummary` | **DIFFERENT** |
| **Backend Service** | Antigravity AI Model Gateway | Google Cloud Platform (GCP) | **DIFFERENT** |
| **Supported Models** | 14 Models (Gemini + Claude + GPT) | Google Gemini Code Assist GCP models | **DIFFERENT** |
| **5H Quota Source** | `quotaInfo.remainingFraction` | Top-level 5H bucket in Cloud Code | **DIFFERENT** |
| **Weekly Quota Source** | `RetrieveUserQuotaSummary` buckets | Top-level Weekly bucket in Cloud Code | **DIFFERENT** |
| **Project Identity** | Antigravity internal workspace session | `cloudaicompanionProject` (GCP) | **DIFFERENT** |
| **Account 2 Outcome** | **57% 5H, 30% Weekly, 14 Models** | **Quota Unavailable (GCP project unprovisioned)** | **DIFFERENT** |

---

## 5. Account 2 & Account 1 Forensic Findings

1. **Account 2 (`trunghieu10a1thptll@gmail.com`)**:
   - Is currently logged into the local running `language_server.exe` (PID 15252).
   - Antigravity's model gateway holds active quota allocations (57% 5H, 30% Weekly across 14 models).
   - On Google Cloud Platform, Account 2 does not have a provisioned enterprise GCP Gemini Code Assist project; thus `cloudcode-pa.googleapis.com` returns empty quota buckets.
2. **Account 1 (`tranhuuhaidh@gmail.com`)**:
   - Is authenticated with Google OAuth in DCC Keyring.
   - On Google Cloud Platform, Account 1 similarly has no provisioned GCP Gemini Code Assist project (`quota = null`).
   - Is not currently logged into the active local `language_server.exe` process (which belongs to Account 2).

---

## 6. Root Cause Classification

```text
PRIMARY ROOT CAUSE CLASSIFICATION:
C. Different API (and H. Runtime-only quota source)
```

### Forensic Conclusion
- The 14-model quota displayed in V1 is an **Antigravity IDE runtime quota** provided exclusively through `LanguageServerService/GetUserStatus`.
- `cloudcode-pa.googleapis.com` is a separate Google Cloud Platform service that requires a provisioned Google Cloud AI Companion project.

---

## 7. Recommended Next Implementation Phase

To provide seamless multi-account monitoring while strictly preserving 0-IDE operation:
1. **Support Dual-Mode Provider Configuration**:
   - **Antigravity Local Runtime Provider**: Uses local `LanguageServerService` when an IDE runtime matches the account identity (providing the 14 Cascade models with 5H/Weekly quotas).
   - **Google Cloud Code Provider**: Operates 100% cloud-direct for accounts connected via Google OAuth with provisioned GCP Code Assist projects.
2. **Deterministic UI Provider Selection**:
   - Allow each account card/row to display its active provider source (`Antigravity Local Runtime` vs `Google Cloud Code`) clearly.

---

## 8. Final Classification

```text
FINAL CLASSIFICATION:
V1_V2_QUOTA_PATH_DIFFERENCE_PROVEN
```
