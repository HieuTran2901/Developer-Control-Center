# Phase 5: Test Plan

## 1. Unit Tests
### `ignore` Traversal (Backend)
- **Test Case**: Create a temporary directory with a `.gitignore` containing `ignored.txt`. Create `ignored.txt` and `tracked.txt`. Verify `get_files_in_bounds` returns only `tracked.txt`.
- **Test Case**: Cancellation during traversal. Ensure `get_files_in_bounds` returns an error if `cancel_token` is triggered.

### `GitSecurityScanner` (Backend)
- **Test Case**: Create a fake `.git/config` with a hardcoded password in a remote URL (`https://user:pass@github.com`). Verify `GitSecurityScanner` flags it with High severity.
- **Test Case**: Create a clean `.git/config` (no credentials). Verify no findings are emitted.

## 2. Integration Tests
- **Test Case**: Start a scan on a repository with a massive `node_modules` and `.gitignore`. Ensure the scan completes rapidly compared to the previous naive implementation.
- **Test Case**: Ensure existing Dependency and Secret scanners still receive correct file paths and function perfectly.

## 3. Manual UI Verification
### Setup Fixtures
Create `security-test-fixtures/phase5-git-test`:
- `.gitignore` containing `secret.txt`
- `secret.txt` (Contains a fake AWS key).
- `valid_file.ts` (Tracked file).
- `.git/config` (Contains `url = https://admin:supersecret@github.com/org/repo.git`).

### Execution Steps
1. Navigate to DCC Security Center.
2. Target `security-test-fixtures/phase5-git-test`.
3. Run Scan.

### Expected Results
1. **Performance**: The scan should be near-instantaneous.
2. **Git Ignore**: The `secret.txt` file MUST NOT trigger a finding, because it is explicitly gitignored.
3. **Git Security**: A finding should appear under the `Git` category indicating exposed credentials in `.git/config`.
4. **Resilience**: The scan must not crash when traversing the `.git` directory structure.
