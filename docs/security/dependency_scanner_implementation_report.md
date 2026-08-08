# Dependency Scanner Implementation Report

## Files Changed
- `src-tauri/Cargo.toml` (Added `reqwest` and `quick-xml`)
- `src-tauri/src/security/domain.rs` (Added `FindingMetadata` and `DependencyMetadata` enum/struct)
- `src-tauri/src/security/mod.rs` (Exported `dependency_scanner`)
- `src-tauri/src/security/engine.rs` (Changed `scanners` array to use `Arc<dyn SecurityScanner>` and registered `DependencyScanner`)
- `src-tauri/src/security/secret_scanner.rs` (Fixed initializations due to `metadata` struct changes)
- `src/domain/entities/SecurityFinding.ts` (Added type-safe metadata definition)
- `src/features/security/pages/SecurityOverview.tsx` (Render UI for Dependency Categories)

## New Files Created
- `src-tauri/src/security/dependency_scanner/mod.rs`
- `src-tauri/src/security/dependency_scanner/parser.rs` (Parses `package.json`, `package-lock.json`, `pom.xml`)
- `src-tauri/src/security/dependency_scanner/resolver.rs` (Resolves dependency lists, prioritizing exact lockfile versions)
- `src-tauri/src/security/dependency_scanner/osv.rs` (Implementation of `VulnerabilityProvider` pointing to OSV HTTP batch API)
- `src-tauri/src/security/dependency_scanner/scanner.rs` (Coordinates the scan steps and integrates with `SecurityEngine`)

## Architecture Decisions
1. **Security Engine Ownership**: The Security Engine passes the absolute `Path` to the Scanner. The Scanner is responsible for reading the specific files (`package.json`, etc.) if needed. This reduces engine complexity.
2. **Metadata Modeling**: Instead of arbitrary JSON which could lead to type runtime errors, a strict `FindingMetadata` enum was created, containing a `Dependency` variant holding `DependencyMetadata`. This guarantees strict compile-time types for both Rust and TypeScript.
3. **No Async-Trait macro**: We removed the `#[async_trait]` macro on `VulnerabilityProvider` to avoid adding the `async-trait` dependency. We instead manually return `Pin<Box<dyn Future>>`.
4. **Quick-XML usage**: `quick-xml` was added to safely parse Maven XML without running into regex hallucination flaws.

## Dependencies Added
- `reqwest`: For OSV HTTP QueryBatch.
- `quick-xml`: For safe offline POM.xml parsing.

## Performance Results
- The OSV queries are fully batched (1000 items per request).
- Lockfile JSON parsing bypasses struct mapping (using `Value` extraction) to rapidly parse files.

## Known Limitations
- The `quick-xml` POM parser does not currently resolve `<dependencyManagement>` overrides or `<parent>` inherited properties.
- Workspaces with `package-lock.json v3` containing multiple workspaces may parse the root module incorrectly if not thoroughly tested.

## Technical Debt
- Manual HTTP client timeout tuning might be needed. Currently fixed at 5 seconds.

## Future Improvements
- Add persistent caching so consecutive app runs don't re-query the same OSV entries.
- Further refine Maven transitive dependency building if required without calling `mvn`.
