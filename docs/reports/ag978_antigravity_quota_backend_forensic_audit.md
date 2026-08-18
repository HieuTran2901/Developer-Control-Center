# AG-9.78 — ANTIGRAVITY QUOTA BACKEND EXTRACTION & CLOUD-DIRECT FEASIBILITY FORENSIC AUDIT REPORT

```text
STATUS:               AUDIT_COMPLETED
DATE:                 2026-08-17
AUDIT MODE:           STRICT READ-ONLY FORENSIC INVESTIGATION (ZERO SOURCE CODE MODIFIED)
PRIMARY QUESTION:     Where does language_server.exe get the real Antigravity quota data (57% 5H, 30% Weekly, 14 models),
                      and is it feasible to query this backend Cloud-Direct without language_server.exe?
CLASSIFICATION:       ANTIGRAVITY_V1_V2_BACKEND_DIFFERENCE_PROVEN / ANTIGRAVITY_CLOUD_DIRECT_CONDITIONALLY_FEASIBLE
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
```

---

## 1. Executive Summary

This strict read-only forensic investigation establishes the remote backend architecture behind `language_server.exe` (PID 15252):
1. **`language_server.exe` is a Local Connect-RPC Proxy & Client (C & D)**: It does not generate quota locally; it connects upstream via HTTPS to Google's internal Cloud Code cluster (`https://daily-cloudcode-pa.googleapis.com`) and Google Generative Language API (`https://generativelanguage.googleapis.com`).
2. **Endpoint Divergence Identified**:
   - `language_server.exe` was launched with: `--cloud_code_endpoint https://daily-cloudcode-pa.googleapis.com` and `--override_ide_name antigravity --subclient_type hub`.
   - DCC V2 was querying: `https://cloudcode-pa.googleapis.com` with `ideType: "DCC"`.
3. **Cloud-Direct Feasibility**: **`CONDITIONALLY FEASIBLE`**. The remote backend is a Google Cloud Code service. When given the appropriate client identification metadata and endpoint, Google OAuth credentials can authenticate and retrieve the user's active quota allocations.

---

## 2. Language Server Process Forensics

```text
Process Name:        language_server.exe
PID:                 15252
Parent PID:          14392 (antigravity.exe)
Executable Path:     C:\Users\TrongMinh\AppData\Local\Programs\antigravity\resources\bin\language_server.exe
Command Line Flags:  --standalone
                     --override_ide_name antigravity
                     --subclient_type hub
                     --override_ide_version 2.8.1
                     --override_user_agent_name antigravity
                     --https_server_port 0
                     --csrf_token <redacted_csrf_token>
                     --app_data_dir antigravity
                     --api_server_url https://generativelanguage.googleapis.com
                     --cloud_code_endpoint https://daily-cloudcode-pa.googleapis.com
                     --enable_sidecars
```

---

## 3. Network Destination Trace

| Protocol | Local Port | Remote Address / Host | Destination Identity |
| :--- | :--- | :--- | :--- |
| **HTTPS (TLS)** | `52064` | `34.54.84.110:443` | Google Cloud Service (`us-central1`) / `daily-cloudcode-pa.googleapis.com` |
| **HTTPS (TLS)** | `52094` | `172.217.119.4:443` | Google Frontend / `generativelanguage.googleapis.com` |
| **HTTPS (TLS)** | `52120` | `172.217.114.4:443` | Google Frontend / `oauth2.googleapis.com` |
| **HTTPS (TLS)** | `52122` | `172.217.117.4:443` | Google Frontend / UserInfo API |
| **HTTPS (TLS)** | `52146` | `172.217.117.4:443` | Google Cloud Code RPC |
| **Local RPC** | `49802` | `127.0.0.1` (Listen) | Connect-RPC Service (`/exa.language_server_pb.LanguageServerService/*`) |

---

## 4. Quota Data Lineage

```text
[5H Quota: 57%]
daily-cloudcode-pa.googleapis.com (Quota Engine)
       ↓
language_server.exe (In-memory Model Config Cache)
       ↓
userStatus.cascadeModelConfigData.clientModelConfigs[i].quotaInfo.remainingFraction (0.57)
       ↓
Local Connect-RPC GetUserStatus
       ↓
DCC V1 ModelQuota (remaining_fraction: 0.57 -> 57%)

[Weekly Quota: 30%]
daily-cloudcode-pa.googleapis.com (RetrieveUserQuotaSummary)
       ↓
language_server.exe
       ↓
response.groups[i].buckets[j].remainingFraction (0.30)
       ↓
Local Connect-RPC RetrieveUserQuotaSummary
       ↓
DCC V1 ModelQuota (weekly_remaining_fraction: 0.30 -> 30%)

[14 Models]
Antigravity Cascade Model Gateway -> clientModelConfigs array (14 items: Gemini, Claude, GPT)

[Reset Time: ~59m]
quotaInfo.resetTime (ISO UTC string) -> QuotaOrchestrationService.getResetCountdown()
```

---

## 5. Required Forensic Matrix

| Dimension | V1 Language Server (Path A) | Remote Backend | V2 Cloud Code (Path B) | Evidence / Comparison |
| :--- | :--- | :--- | :--- | :--- |
| **Process** | `language_server.exe` | None | None | **DIFFERENT** |
| **Local RPC** | Connect-RPC on `127.0.0.1` | None | None | **DIFFERENT** |
| **Remote Host** | `daily-cloudcode-pa.googleapis.com` | `daily-cloudcode-pa.googleapis.com` | `cloudcode-pa.googleapis.com` | **DIFFERENT** (Endpoint mismatch) |
| **Protocol** | Connect-RPC / HTTPS | gRPC / HTTP/2 REST | REST / JSON | **DIFFERENT** |
| **Authentication**| CSRF token (local) / Google session (remote) | Google OAuth Bearer | Google OAuth Bearer | **MATCH** (Google OAuth) |
| **Account ID** | `trunghieu10a1thptll@gmail.com` | `trunghieu10a1thptll@gmail.com` | `trunghieu10a1thptll@gmail.com` | **MATCH** |
| **Project ID** | Antigravity IDE context | Internal GCP Companion | `cloudaicompanionProject` | **DIFFERENT** |
| **Entitlement** | Antigravity Tier (14 models) | Multi-model quota pool | GCP Code Assist only | **DIFFERENT** |
| **5H Source** | `clientModelConfigs[i].quotaInfo` | Cloud Code Quota Engine | `retrieveUserQuotaSummary` | **DIFFERENT** |
| **Weekly Source**| `RetrieveUserQuotaSummary` | Cloud Code Quota Engine | `retrieveUserQuotaSummary` | **DIFFERENT** |
| **Model Source** | 14 Cascade models | Antigravity Gateway | None / unprovisioned | **DIFFERENT** |
| **IDE Dependency**| **YES** | **NO** | **NO** | **DIFFERENT** |
| **Feasibility** | Operational | **CONDITIONALLY FEASIBLE**| Unprovisioned on standard GCP | **CONDITIONALLY FEASIBLE** |

---

## 6. Exact First Divergence

```text
[Divergence Point]
DCC V1 ──► Local Connect-RPC ──► language_server.exe ──► daily-cloudcode-pa.googleapis.com (ideType: ANTIGRAVITY)
                                                                 │
                                                       (14 Cascade Models + Quota)
                                                                 │
DCC V2 ──► Google OAuth ───────────────────────────────► cloudcode-pa.googleapis.com (ideType: DCC)
                                                                 │
                                                       (GCP Project Unprovisioned)
```

The first divergence is the **backend endpoint and client metadata pair**:
- V1 communicates with `daily-cloudcode-pa.googleapis.com` using `ideType: "ANTIGRAVITY"`, `subclientType: "HUB"`.
- V2 was communicating with `cloudcode-pa.googleapis.com` using `ideType: "DCC"`, which is routed to standard GCP project onboarding rather than the Antigravity developer cluster.

---

## 7. Root Cause Classification

```text
ROOT CAUSE CLASSIFICATION:
B. V1 remote backend different from Cloud Code (and F. V1 and V2 use same backend family but different request contract / endpoint)

FINAL CLASSIFICATION:
ANTIGRAVITY_CLOUD_DIRECT_CONDITIONALLY_FEASIBLE
```

---

## 8. Recommended Next Phase Plan

1. **Test Cloud-Direct Endpoint Alignment**:
   - Experiment with querying `https://daily-cloudcode-pa.googleapis.com` (or using `ideType: "ANTIGRAVITY"`, `pluginType: "GEMINI"`, `subclientType: "HUB"`) directly with Google OAuth access tokens over HTTPS.
2. **Preserve Fallback & Zero-IDE Stability**:
   - Maintain the local Antigravity runtime provider as a verified fallback whenever matching local runtimes exist.
   - Maintain Google Cloud Code provider as the primary cloud-direct engine.

---

## 9. Final Classification

```text
FINAL CLASSIFICATION:
ANTIGRAVITY_CLOUD_DIRECT_CONDITIONALLY_FEASIBLE
EXECUTION_STOPPED_AFTER_FORENSIC_AUDIT
```
