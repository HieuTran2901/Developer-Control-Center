# Phase 5 Step 1: OSV Metadata Architecture Audit

## 1. Current OSV Integration
The `osv.rs` module interacts with the OSV API (`https://api.osv.dev/v1/querybatch`). It batches queries (up to 1,000 at a time) and successfully fetches vulnerability reports.

## 2. Actual OSV Response Structure Used
The OSV API returns a rich JSON document for each vulnerability (defined by the [OSV Schema](https://ossf.github.io/osv-schema/)). However, the current Rust struct `OsvVulnerability` heavily filters the response.
**Currently parsed fields:**
- `id`
- `summary`
- `details`

**Currently ignored fields (due to missing struct definitions):**
- `aliases` (e.g., CVEs)
- `published`, `modified`, `withdrawn`
- `severity`
- `affected` (ranges, events: `introduced`, `fixed`)
- `references`
- `database_specific`, `ecosystem_specific`

## 3. Current Rust Models
In `src-tauri/src/security/domain.rs`, the `DependencyMetadata` struct defines:
- `ecosystem: String`
- `package_name: String`
- `version: String`
- `vulnerability_id: Option<String>`
- `fixed_version: Option<String>`

## 4. Current SecurityFinding Structure
In `scanner.rs`, the conversion from `OsvVulnerability` to `SecurityFinding` happens as follows:
- `title` <- `vuln.id`
- `description` <- `vuln.summary` (fallback to generic string)
- `severity` <- **Hardcoded** to `SecuritySeverity::High`
- `remediation` <- **Hardcoded** to `"Update the dependency to a secure version"`
- `metadata.fixed_version` <- **Hardcoded** to `None`
- `details` <- **Discarded completely**

## 5. Tauri IPC/DTO Mapping
The `SecurityFinding` model is directly serialized to JSON via Serde. Therefore, whatever survives the Rust `SecurityFinding` construction is successfully passed to the frontend via the Tauri IPC EventBus.

## 6. Current Frontend Model
In `src/domain/entities/SecurityFinding.ts`:
```typescript
export interface DependencyMetadata {
  ecosystem: string;
  packageName: string;
  version: string;
  vulnerabilityId?: string;
  fixedVersion?: string;
}
```
The frontend expects `fixedVersion`, but because the backend hardcodes it to `None`, the frontend never receives it.

## 7. Current UI Rendering
In `SecurityActiveFindings.tsx`:
- The title renders the package name, version, and `f.title` (which is the Vuln ID).
- The description renders `f.description` (which is the short OSV summary).
- The detailed view displays `Path`, `Vuln ID`, and `Fixed: {meta.fixedVersion}` (if available).
- The generic hardcoded remediation is displayed.
- **Lost:** Full vulnerability details, aliases/CVEs, exact severity, and reference links are nowhere to be seen.

## 8. Metadata Currently Preserved
| OSV Field | Available? | Stored in Rust? | Passed through IPC? | Used by UI? |
| --- | --- | --- | --- | --- |
| `id` | Yes | Yes | Yes (as `vulnerabilityId` and `title`) | Yes |
| `summary` | Yes | Yes | Yes (as `description`) | Yes |
| `details` | Yes | **No** (parsed, but discarded) | No | No |
| `severity` | Yes | No (hardcoded to High) | No | No |
| `aliases` | Yes | No | No | No |
| `affected.fixed` | Yes | No | No | No |
| `references` | Yes | No | No | No |

## 9. Metadata Currently Lost
Everything except `id` and `summary` is effectively lost. Notably:
- `fixed_version` is desperately needed by the UI to tell the user what version to upgrade to.
- `aliases` is needed so users can search for CVEs instead of just GHSA IDs.
- `severity` is needed because OSV vulnerabilities range from LOW to CRITICAL, but they are all flagged as HIGH.
- `details` could provide deep context.
- `references` could provide links to GitHub Advisory or NIST.

## 10. Recommended Minimal Data Model
To maximize user value without over-complicating the domain, we recommend extending `DependencyMetadata` and `OsvVulnerability`.

### Rust & TS Recommended Target Model
```typescript
export interface DependencyMetadata {
  ecosystem: string;
  packageName: string;
  version: string;
  vulnerabilityId?: string;
  aliases?: string[];           // NEW: [CVE-2023-1234]
  fixedVersion?: string;        // Fix currently hardcoded None
  references?: string[];        // NEW: ["https://github.com/advisories/..."]
}
```
*Note: `summary`, `details`, and `severity` belong directly on `SecurityFinding`, not in `DependencyMetadata`, so we just need to map them correctly from OSV.*

## 11. Recommended Implementation Boundary
- **`osv.rs`**: Extend `OsvVulnerability` to parse `severity`, `aliases`, `affected` (to extract `fixed`), and `references`.
- **`scanner.rs`**: Map `vuln.severity` to `SecuritySeverity`, `vuln.details` to `description` (or combine summary/details), and populate `metadata.aliases`, `metadata.fixed_version`, and `metadata.references`.
- **`SecurityActiveFindings.tsx`**: Update the UI to render the new `aliases`, `references` links, and the actual `fixedVersion`.

## 12. Security/Privacy Considerations
- The OSV data is public, so no privacy concerns exist regarding the vulnerability metadata.
- Ensure that external links from `references` open safely in the system browser rather than hijacking the Tauri webview context.

## 13. Backward Compatibility Risks
- Modifying `DependencyMetadata` to include optional fields is fully backward compatible.
- Previous `SecurityFinding`s stored in history or mock data won't have `aliases` or `references`, so the UI must handle `undefined` gracefully.

## 14. Testing Strategy
- Create a mock OSV response containing `aliases`, `affected` events (introduced/fixed), `severity`, and `references`.
- Assert that `DependencyScanner` correctly maps these fields into `SecurityFinding` and `DependencyMetadata`.
- Ensure the UI components render these fields correctly when provided.
