# Secret Scanner Core Implementation Plan

## Goal
Implement Phase 2 of the Security Center: The `SecretScanner`. The scanner must detect credentials and secrets within the project root, classify them by severity, accurately handle false positives via confidence scoring, and redact raw evidence before sending it over IPC.

## Architecture Decision
**Option C: Scanner trả về Vec<SecurityFinding>, Engine aggregate.**
This isolates the pattern detection logic from IPC and Event orchestration.

## Proposed Changes

### Phase 2.1: Domain Compatibility
**Files:** `src-tauri/src/security/domain.rs`
- Update `SecurityScanEvent` to batch findings: `FindingsChunk { scan_id: String, findings: Vec<SecurityFinding> }` instead of single `FindingDetected`.
- Add `RedactedEvidence` struct to enforce compile-time safety.

### Phase 2.2: Secret Scanner Foundation & Pattern Registry
**Files:** `src-tauri/src/security/secret_scanner.rs`, `src-tauri/src/security/mod.rs`
- Create `SecretScanner` struct implementing `SecurityScanner`.
- Implement `PatternRegistry` using `OnceLock<Vec<SecretPattern>>`.
- Define `SecretPattern`: `regex`, `category`, `severity`, `detector_type`.

### Phase 2.3: File Safety & Content Reading
**Files:** `src-tauri/src/security/secret_scanner.rs`
- Skip non-UTF8/binary files by reading the first 1KB and checking for null bytes (`\0`).
- Use buffered reading for large files.

### Phase 2.4: Context / Confidence Analysis
**Files:** `src-tauri/src/security/secret_scanner.rs`
- Introduce confidence scoring.
- Exclude matches found in test paths (`tests/`, `__tests__/`, `*.test.ts`) from HIGH severity, moving them to LOW unless high-entropy bounds match perfectly.

### Phase 2.5: Redaction Enforcement
**Files:** `src-tauri/src/security/redactor.rs`
- Upgrade `SecurityRedactor` to replace secret values properly (e.g. `AKIA****************abcd`).
- Map regex capture groups to ensure the specific secret is redacted while leaving context visible.

### Phase 2.6 & 2.7: File Filtering & Deduplication
**Files:** `src-tauri/src/security/engine.rs`
- Implement deduplication by tracking a HashSet of finding hashes per file.
- Improve `get_files_in_bounds` to strictly bypass `.git`, `node_modules`, `target`.

### Phase 2.8: Cancellation
**Files:** `src-tauri/src/security/engine.rs`, `src-tauri/src/security/secret_scanner.rs`
- Check `cancel_token.load(Ordering::Relaxed)` frequently (per file, per line/chunk) to drop instantly.

### Phase 2.9 & 2.10: Engine & IPC Integration
**Files:** `src-tauri/src/security/engine.rs`, `src/application/services/SecurityService.ts`, `src/features/security/pages/SecurityOverview.tsx`, `src/application/events/EventBus.ts`
- Engine collects all `SecurityFinding`s, passes them through the `SecurityRedactor`.
- Batch findings into chunks of 50 and emit `SecurityScanEvent::FindingsChunk` to prevent IPC flooding.
- Update TS interfaces and React UI to accept chunks.

### Phase 2.11 & 2.12: Tests & Validation
- Write unit tests for `SecretScanner` with real AWS/GitHub/JWT mock tokens.
- Write unit tests for binary file skipping.
- `cargo test` and `npm run build`.

## Validation Plan
1. Cargo checks pass.
2. Binary files are not loaded into memory.
3. IPC does not flood the main thread (chunks of 50).
4. Raw secrets are NEVER sent over IPC.
