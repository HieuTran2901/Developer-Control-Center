# Phase 5 — Why It Matters Data Source Audit

## 1. Audit Status
**PASS**

## 2. Data Flow
The content displayed in the "WHY IT MATTERS" section flows through the following pipeline:
1. **OSV API**: `GET https://api.osv.dev/v1/vulns/{id}` returns the full JSON vulnerability object containing the `details` and `summary` fields. (Note: `POST /v1/querybatch` does not return these fields).
2. **Rust (`osv.rs`)**: Deserializes the JSON response directly into the `OsvVulnerability` struct using `serde_json`.
3. **Rust (`scanner.rs`)**: Extracts `vuln.details` and `vuln.summary` without any transformation.
   - `details` is inserted into `DependencyMetadata.details`.
   - `summary` is inserted into `SecurityFinding.description`.
4. **Tauri IPC**: Serializes `SecurityFinding` (including the nested `DependencyMetadata`) directly to JSON via the EventBus.
5. **React (`SecurityFinding.ts`)**: Receives the strongly-typed JSON object where `meta.details` contains the raw OSV details.
6. **React (`SecurityActiveFindings.tsx`)**: Renders `{meta.details || f.description}` in the "Why it matters" UI block.

## 3. Actual Source of Why It Matters
- **Source**: Directly from the official Google OSV Database.
- **File**: `src/features/security/components/SecurityActiveFindings.tsx`
- **Struct/Interface**: `DependencyMetadata` (TypeScript) / `DependencyMetadata` (Rust)
- **Field**: `details` (Primary), falling back to `description`.
- **Function**: `OsvProvider::get_vulnerabilities` fetches it; `DependencyScanner::scan` maps it.

## 4. Apache POI Verification
Using `org.apache.poi:poi-ooxml` (Version `5.2.3`), `GHSA-gmg8-593g-7mv3`:

| UI Field | Source | File | Status |
|---|---|---|---|
| Vulnerability ID | `vuln.id` | `osv.rs` (OSV payload) | PASS |
| CVE | `vuln.aliases` | `osv.rs` (OSV payload) | PASS |
| Severity | `vuln.database_specific.severity` | `scanner.rs` (`extract_severity`) | PASS |
| Fixed Version | `vuln.affected.ranges` | `scanner.rs` (`extract_fixed_version`) | PASS |
| Why It Matters | `vuln.details` | `osv.rs` (OSV payload) | PASS |
| References | `vuln.references` | `osv.rs` (OSV payload) | PASS |

*All data is verified to come directly from the OSV HTTP response.*

## 5. AI Generation Audit
**NO**

**Explanation**: There is absolutely zero AI integration in the dependency scanning pipeline. The system does not make any calls to OpenAI, Gemini, or local LLMs. The text rendered in "Why it matters" is a 1:1 verbatim pass-through of the official human-written vulnerability explanation provided by the OSV database maintainers.

## 6. Fallback Behavior
The pipeline contains the following safe fallback mechanisms:
- **Why it matters**: `meta.details || f.description`
  - If OSV `details` is `null`, the UI falls back to `f.description`.
- **Description (Summary)**: `vuln.summary.unwrap_or_else(|| "Dependency vulnerability detected".to_string())`
  - If OSV `summary` is `null`, it falls back to a generic string.
- **Fixed Version**: 
  - If `fixedVersion` is `null`, the UI explicitly states: *"No verified fixed version provided by OSV."*
- **Remediation**:
  - If `fixedVersion` is present: *"Upgrade to version X or later."*
  - If `fixedVersion` is `null`: *"Review the advisory and upgrade to a patched version when available."*
- **Severity**:
  - If neither `severity` (CVSS) nor `database_specific.severity` matches known mappings, it safely falls back to `SecuritySeverity::Info`.

## 7. Data Integrity Issues
**None identified.** The `SecurityActiveFindings.tsx` UI safely handles missing metadata by hiding arrays (e.g. `aliases`, `references`) when empty. The only known limitation is that OSV `details` often contain Markdown formatting which is currently rendered as raw text (`whitespace-pre-wrap`), but no data is lost or corrupted.

## 8. Architecture Recommendation
If AI explanation generation is introduced in a future phase, the architecture should **NOT** overwrite the OSV `details` field.
- **Recommendation**: Preserve `DependencyMetadata.details` as the immutable source of truth.
- Introduce a new, separate field (e.g., `SecurityFinding.ai_explanation: Option<String>`).
- The UI should render the AI explanation in a visually distinct panel (e.g., "AI Insights" with a sparkle icon) separate from the official "OSV Advisory Details" to ensure developers can always distinguish between official security facts and LLM-generated summaries.

## 9. Conclusion
- **WHY IT MATTERS hiện tại lấy từ đâu?**: Lấy trực tiếp từ field `details` (hoặc `summary`) của payload JSON trả về bởi OSV API (`GET /v1/vulns/{id}`).
- **Có phải dữ liệu OSV không?**: 100% là dữ liệu gốc của OSV.
- **Có phải AI không?**: Hoàn toàn không.
- **Có hardcode không?**: Không, ngoại trừ chuỗi fallback an toàn khi OSV không có dữ liệu.
- **Có cần sửa ngay không?**: Không. Kiến trúc hiện tại là chính xác, an toàn và toàn vẹn dữ liệu.
- **Có thể chuyển sang bước tiếp theo chưa?**: CÓ. Bước 3 (Audit) đã hoàn tất.
