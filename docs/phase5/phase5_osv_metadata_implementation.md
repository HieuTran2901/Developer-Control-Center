# Phase 5 Step 2: OSV Metadata Pipeline Implementation

## 1. Files Changed
- `src-tauri/src/security/dependency_scanner/osv.rs`: Extended the `OsvVulnerability` struct and sub-structs to match the richer OSV response.
- `src-tauri/src/security/domain.rs`: Extended `DependencyMetadata` to include `aliases`, `details`, `references`.
- `src-tauri/src/security/dependency_scanner/scanner.rs`: Updated `DependencyScanner` to extract fixed version and severity, map fields into `SecurityFinding`, and included unit tests.
- `src/domain/entities/SecurityFinding.ts`: Updated TypeScript types to include the new metadata fields.

## 2. OSV Fields Now Preserved
- `aliases`
- `published`, `modified`, `withdrawn`
- `severity` (from `database_specific`)
- `affected` (ranges, events: `introduced`, `fixed`)
- `references`

## 3. Severity Mapping
Added the `extract_severity` function which checks the `database_specific` object for a string-based severity (e.g. GitHub Advisory provides "CRITICAL", "HIGH", "MODERATE", "LOW"). If a severity is found, it maps it directly to the internal `SecuritySeverity` enum. If it is missing, it falls back safely to `SecuritySeverity::Info` to avoid falsely claiming an unknown vulnerability is a high-severity emergency.

## 4. Fixed-Version Extraction Logic
Added the `extract_fixed_version` function that traverses the `affected` list. It matches the package name to avoid confusing different package fixes in a multi-package advisory. It iterates through `ranges` (of type `ECOSYSTEM` or `SEMVER`) and their `events`. It uses a custom semantic version comparator (`compare_versions`) to determine exactly which chronological branch the scanned version falls into, ensuring that the returned `fixed` version correctly applies to the scanned dependency version.

## 5. Domain Model Changes
`DependencyMetadata` was extended:
```rust
pub aliases: Option<Vec<String>>,
pub details: Option<String>,
pub references: Option<Vec<String>>,
```
This safely carries the OSV data without polluting `SecurityFinding` internals, while still being transparently serialized to the frontend.

## 6. IPC Contract Changes
`DependencyMetadata` interface in TypeScript was updated to match the Rust backend struct. All new fields are `optional` to maintain backward compatibility with existing data or mock findings.

## 7. Test Coverage
Added a `#[cfg(test)]` module inside `scanner.rs` with unit tests covering:
- **Missing Severity Fallback:** `test_extract_severity` ensures `database_specific` maps correctly and falls back to Info.
- **Fixed Version Extraction:** `test_extract_fixed_version_complex` ensures correct extraction from nested `affected` arrays based on package matching and checks version applicability across multiple range timelines.

## 8. Real Filesystem Verification
Ran `cargo test`, `cargo check`, and `npm run build`. The implementation is fully backward compatible, and existing mock and real filesystem results (including Secret/Configuration scanner) remain unaffected. The dependency scanner now surfaces genuine fixed versions and accurate severities instead of relying on default high-severity warnings.

## 9. Known Limitations
- The current implementation only extracts textual severities from `database_specific`. It does not parse complete CVSS vector strings (e.g. `CVSS:3.1/AV:N/AC:L/...`).
- Ecosystem-specific complex constraints outside of standard `SEMVER` and `ECOSYSTEM` types (e.g. `GIT` commit ranges) are ignored.

## 10. Severity and Fixed-Version Semantics

### Severity Source Priority
1. **Standard OSV severity**: We iterate through the standard OSV `severity` array looking for CVSS vectors. Because we currently do not use a dedicated CVSS parser (to avoid external dependencies and complex formulas), we skip parsing the raw vector text.
2. **Trusted database-specific severity**: We prioritize `database_specific.severity` when available because ecosystem advisories (like GitHub Advisories) provide accurate, pre-calculated qualitative severity scores (e.g., "HIGH", "MODERATE").

### Fallback Behavior
When no standard qualitative severity is present in the OSV metadata, we fallback to **`SecuritySeverity::Info`**. The scanner explicitly avoids silently claiming "HIGH" severity for unknown/missing metrics to prevent false-alarm fatigue.

### Fixed-Version Extraction Rules
To correctly identify the appropriate fix for the currently scanned dependency, the scanner implements sequence-aware version matching:
1. **Package Matching**: Only `affected` elements strictly matching the queried dependency package name are evaluated.
2. **Timeline Evaluation**: We traverse the chronologically ordered `events` array (`introduced`, `fixed`, `last_affected`) within each range.
3. **Version Applicability**: Using a heuristic semantic version comparison (`compare_versions`), we determine if the currently scanned version strictly falls into the affected timeline (after `introduced` and before `fixed` / up to `last_affected`).
4. **Correct Range Selection**: If the dependency version is currently affected by a specific timeline, the subsequent `fixed` event within that exact timeline is correctly returned.
