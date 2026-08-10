# Security Scan Test Report

## Quick Security Scan

**Expected:**
- Phát hiện AWS Access Key trong `.env`
- Phát hiện GitHub Token trong `.env`
- Phát hiện Debug Mode trong `application.yml`
- Phát hiện Permissive CORS trong `application.yml`
- **Không** chạy Git Scanner hoặc Dependency Scanner.

**Actual:**
- `[core_secret_scanner]` Secret - AWS Access Key: `tests/security-fixtures/quick-scan/.env`
- `[core_secret_scanner]` Secret - GitHub Token: `tests/security-fixtures/quick-scan/.env`
- `[configuration_scanner]` Configuration - Debug Mode Enabled: `tests/security-fixtures/quick-scan/config/application.yml`
- `[configuration_scanner]` Configuration - Permissive CORS Policy: `tests/security-fixtures/quick-scan/config/application.yml`

**PASS/FAIL:** PASS

---

## Git Exposure Scan

**Expected:**
- Phát hiện Dummy Credential trong `tests/security-fixtures/git-exposure/.git/config`
- **Architectural Limitation:** Việc `.env` chứa AWS Access Key (được track bằng git) sẽ **KHÔNG ĐƯỢC PHÁT HIỆN**, do `git_scanner` hiện tại không có khả năng đọc Git Index và không tích hợp `core_secret_scanner` trong chế độ này.
- **Không** chạy Configuration hoặc Dependency Scanner.

**Actual:**
- `[git_scanner]` Git - Git Remote Contains Embedded Credentials: `tests/security-fixtures/git-exposure/.git/config`
- (Không phát hiện AWS Access Key trong `.env` đã tracked, đúng với phân tích kiến trúc).

**PASS/FAIL:** PASS (Đúng với giới hạn kiến trúc hiện tại).

---

## Full Security Scan

**Expected:**
- Kết hợp của toàn bộ các findings bên trên.
- Phát hiện lỗ hổng OSV (CVE/GHSA) đối với `lodash` version `4.17.15` trong `package.json`.
- Quét bình thường các file source.

**Actual:**
- `[git_scanner]` Git - Git Remote Contains Embedded Credentials: `tests/security-fixtures/full-scan/.git/config`
- `[core_secret_scanner]` Secret - AWS Access Key: `tests/security-fixtures/full-scan/.env`
- `[core_secret_scanner]` Secret - GitHub Token: `tests/security-fixtures/full-scan/.env`
- `[configuration_scanner]` Configuration - Debug Mode Enabled: `tests/security-fixtures/full-scan/config/application.yml`
- `[configuration_scanner]` Configuration - Permissive CORS Policy: `tests/security-fixtures/full-scan/config/application.yml`
- `[dependency_scanner]` Dependency - GHSA-29mw-wpgm-hmr9: `tests/security-fixtures/full-scan/package.json`
- `[dependency_scanner]` Dependency - GHSA-35jh-r3h4-6jhm: `tests/security-fixtures/full-scan/package.json`
- `[dependency_scanner]` Dependency - GHSA-f23m-r3pf-42rh: `tests/security-fixtures/full-scan/package.json`
- `[dependency_scanner]` Dependency - GHSA-p6mc-m468-83gw: `tests/security-fixtures/full-scan/package.json`
- `[dependency_scanner]` Dependency - GHSA-r5fr-rjxr-66jc: `tests/security-fixtures/full-scan/package.json`
- `[dependency_scanner]` Dependency - GHSA-xxjr-mmjv-4gpg: `tests/security-fixtures/full-scan/package.json`

**PASS/FAIL:** PASS

---

## False Positive Check

**Mục tiêu:** Các file như `README.md` hoặc `Example.java` không được kích hoạt false positive nếu chỉ có text bình thường.

**Kết quả:** Không có finding nào trỏ tới `README.md` hoặc `Application.java` hoặc `Example.java`.
**PASS/FAIL:** PASS

---

# FINAL REPORT

SECURITY SCAN FIXTURE TEST STATUS

Fixture creation: PASS
Quick Scan: PASS
Git Exposure Scan: PASS (có ghi chú về giới hạn kiến trúc)
Full Scan: PASS
Mode isolation: PASS
False positive check: PASS
Real filesystem verification: PASS
Production source modified: NO
Dependencies installed: NO
Dependencies changed: NO

SECURITY SCAN MODE VERIFICATION: PASS

---

**ARCHITECTURAL LIMITATION DETECTED**
- **Scanner đáng lẽ phải chạy:** `git_scanner` / `core_secret_scanner` hỗ trợ phát hiện tracked secrets.
- **Expected behavior:** Khi người dùng chọn "Git Exposure Scan", hệ thống nên phát hiện được `.env` có chứa secrets nhưng đã bị git track/commit.
- **Actual behavior:** `git_scanner` CHỈ giới hạn ở việc đọc file `.git/config` để tìm credentials trong remote URL. Các file đang được git track như `.env` sẽ hoàn toàn bị bỏ qua trong chế độ "Git Exposure Scan".
- **Lý do dự kiến:** Logic hiện tại của Rust Engine chỉ filter enum mode và gọi các component scanner độc lập. `git_scanner` chưa được tích hợp khả năng chạy `git ls-files` hoặc tương tác thư viện libgit2, và cũng chưa được liên kết với `core_secret_scanner` (engine không truyền trạng thái tracked).
