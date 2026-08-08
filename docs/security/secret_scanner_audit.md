# Secret Scanner Core Audit

## 1. Current Architecture
- **Frontend**: React components trigger scans via `SecurityService` (`start_security_scan_cmd`). Results are received via Tauri Event listener and dispatched through the `EventBus` to the `SecurityOverview` UI.
- **Backend (Rust)**: `start_security_scan` command invokes `SecurityEngine::start_scan`. The Engine spawns a Tokio task that recursively walks directories (`get_files_in_bounds`), checking an `Arc<AtomicBool>` for cancellation. The engine holds a collection of `Box<dyn SecurityScanner>`.
- **Trait Abstraction**: `SecurityScanner` requires `scan(path, cancel_token) -> Result<Vec<SecurityFinding>, String>`.
- **Redaction**: `SecurityRedactor` has a basic `DefaultRedactor` using `OnceLock<Vec<Regex>>`.

## 2. Findings & Architectural Gaps
- **Responsibility Mix**: Currently `SecurityEngine` handles directory walking. If the Engine walks files and calls `scanner.scan(file)`, then `SecurityScanner` trait should take a file path instead of a directory path, or the Engine passes the file content directly. Currently `scanner.scan` takes `&Path`.
- **IPC Flooding**: `SecurityEngine` emits `SecurityScanEvent::FindingDetected` for every single finding. A large codebase with hundreds of findings will overwhelm the Tauri IPC bridge and React re-renders. 
- **File Safety**: The current walker blindly returns all files. It does not check file sizes, binary content, or invalid encodings, which will cause the scanner to waste CPU or crash on large binary files (e.g. `.zip`, `.dll`, image files).
- **Redaction Location**: Redaction is currently a separate struct. It must be strictly enforced *before* the finding is returned to the IPC layer.

## 3. Security Risks
- The frontend must never receive raw secrets. Currently, the `evidence` field in `SecurityFinding` is a string. If the scanner forgets to call the redactor, the raw secret is sent over IPC.
- Logging: Care must be taken not to `println!` or `log::info!` the raw secret anywhere in the Rust backend.

## 4. Secret Detection Matrix
**CRITICAL**:
- RSA/EC Private Keys, PEM blocks, SSH Private keys (e.g., `-----BEGIN PRIVATE KEY-----`)

**HIGH**:
- AWS Access Key ID (`AKIA[0-9A-Z]{16}`) & Secret Access Key
- GitHub Tokens (`ghp_[a-zA-Z0-9]{36}`)
- GitLab / Slack / Discord / Stripe API Keys
- Database Connection Strings with Passwords

**MEDIUM**:
- JWT Tokens (`eyJ...`)
- Generic Bearer tokens
- OAuth Secrets

**LOW**:
- High entropy strings in variable assignments (e.g., `const secret = "..."`)

## 5. File Scanning Policy
- **Scan**: `.env`, `.yml`, `.json`, `.toml`, `.xml`, source code (`.rs`, `.ts`, `.js`, `.py`, `.go`, etc.), scripts (`.sh`).
- **Exclude**: `node_modules/`, `target/`, `dist/`, `build/`, `.cache/`, `.vite/`, binary extensions (`.png`, `.exe`, `.dll`, `.mp4`).
- **`.git/` Strategy**: Explicitly excluded from the working tree scan. Git history scanning is a separate phase and requires a different scanning strategy (reading git blobs/trees directly).

## 6. Redaction Policy & False Positive Strategy
- **Redaction**: Mask all but the first 4 and last 4 characters of the matched secret. (e.g., `AKIA****************abcd`).
- **False Positive Control**: 
  - Exclude test files (`*.test.ts`, `tests/`) from High/Medium/Low categories unless the match is exceptionally confident (e.g., a real AWS key structure).
  - Calculate **Confidence (0.0 - 1.0)** based on context. A high entropy string assigned to a variable named `test_secret` in a test file = Low Confidence. A GitHub token in a `.env` file = High Confidence.

## 7. Deduplication
- We must hash `(file_path, line_number, detector_type)` to create a stable identity for findings. 
- A single line might trigger multiple regexes. We should group them or pick the highest confidence match.

## 8. Performance Strategy
- Avoid `std::fs::read_to_string` on huge files. Files larger than 2MB should be chunk-read or skipped for secret scanning unless specifically required.
- **Regex**: Use `OnceLock` for static compilation of the Regex set. 
- **Binary Check**: Quickly check the first 1024 bytes for null bytes (`\0`) to skip binary files.

## 9. Cancellation Strategy
- Check `cancel_token.load(Ordering::Relaxed)`:
  - Inside the directory walker loop.
  - Inside the file reading loop (if reading in chunks).
  - Inside the scanner loop over multiple files.
  - Immediately abort and return `Result::Err("Cancelled")`.

## 10. IPC Strategy
- Batch `SecurityFindingDetected` events into chunks of 50-100 findings, or use a throttled emitter (e.g., every 500ms).
- Update `SecurityScanEvent` to handle `FindingsChunk(Vec<SecurityFinding>)`.

## 11. Dependency Decision
- **Decision**: No new dependencies needed right now.
- `regex` and `tokio` are already present and sufficient. 
- We will build a custom recursive walker for phase 2 to strictly control `.git` and `node_modules` exclusion without adding `ignore` or `walkdir`.

## 12. Architecture Decision
**Option C: Scanner trả về Vec<SecurityFinding>, Engine aggregate.**
- *Reasoning*: This ensures absolute Separation of Concerns. The `SecretScanner` has zero knowledge of IPC, EventBus, or Tauri. It takes a file, runs its logic, and returns a pure data array. The `SecurityEngine` takes care of iterating the workspace, passing files to the scanner, aggregating the `Vec<SecurityFinding>`, applying the `SecurityRedactor` to guarantee safety, chunking the data, and dispatching it to Tauri. 

## 13. Implementation Gate
All analysis is complete. Waiting for `PROCEED PHASE 2` to begin execution.
