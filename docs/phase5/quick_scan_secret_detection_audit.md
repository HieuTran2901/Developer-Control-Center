# Quick Scan Secret Detection Audit

## 1. Quick Scan Execution Flow
Khi người dùng chọn **Quick Security Scan**:
- `SecurityEngine` lọc danh sách các scanners và chỉ giữ lại `core_secret_scanner` và `configuration_scanner`.
- Engine duyệt file (thông qua `ignore::Walk`) và truyền từng file entry vào hàm `scan()` của 2 scanner này.
- Kết quả được thu thập, map severity, tổng hợp vào `chunk` và gửi qua IPC tới Frontend.

## 2. Secret Scanner Execution Flow
- Nhận file path từ Engine.
- Đọc file từng dòng (`BufReader`).
- Chạy đối chiếu từng dòng với danh sách Regex Patterns (`SECRET_PATTERNS`).
- Nếu khớp, tạo `SecurityFinding` với ID dạng `path:line:pattern_name`.

## 3. File Discovery Behavior
- Quá trình traversal sử dụng thư viện `ignore::Walk`.
- Thư viện này theo mặc định **tuân thủ nghiêm ngặt** các file `.gitignore` và bỏ qua các hidden files/directories.

## 4. `.env` Handling (Root Cause 1)
- File `.gitignore` ở root project có chứa cấu hình:
  ```gitignore
  # Environments
  .env
  .env.*
  ```
- Do `ignore::Walk` tôn trọng `.gitignore`, toàn bộ các file `.env`, `.env.local`, `.env.test`, v.v. đã bị **BỎ QUA HOÀN TOÀN** trong quá trình duyệt file. Chúng không bao giờ được đưa vào hàm `scan()` của `core_secret_scanner`.

## 5. Secret Pattern Matching (Root Cause 2)
- Hiện tại, `core_secret_scanner` chỉ hỗ trợ đúng 4 patterns với Regex được hardcode rất chặt chẽ:
  - AWS Access Key: `(?i)\b(AKIA|ASIA)[0-9A-Z]{16}\b`
  - GitHub Token: `(?i)\b(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}\b`
  - JWT Token: Format chuẩn 3 phần (Header.Payload.Signature).
  - Private Key: `-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----`
- Nếu file chứa `TEST_AWS_ACCESS_KEY_ID=TEST_ONLY`, pattern regex sẽ **không bắt được** vì `TEST_ONLY` không khớp với định dạng 16 ký tự của AWS Key chuẩn (`AKIA...`). Hệ thống hiện chưa có Regex để bắt theo "Semantic Pattern" (các biến chứa chữ secret/key/password).

## 6. Confidence Calculation
- Mặc định: `90`.
- Nếu đường dẫn chứa `"test"` hoặc `"fixture"`: giảm đi 40 (còn `50`).
- **Không có cơ chế** nào trong Engine hoặc Frontend discard finding vì confidence thấp. Finding vẫn sẽ được gửi đi hợp lệ.

## 7. Severity Calculation
- Mặc định lấy theo Pattern (High/Critical/Medium).
- Nếu đường dẫn chứa `"test"` hoặc `"fixture"`: bị hạ cấp xuống `SecuritySeverity::Low`.
- Giảm severity không làm mất finding, nó chỉ hiện thị dưới dạng "Low risk" trên UI.

## 8. Finding Aggregation
- Findings được đưa vào danh sách `chunk`.
- `SecurityEngine` xử lý gom (aggregate) findings từ nhiều scanners thành một luồng event IPC. Không hề có đoạn code nào discard/drop các finding hợp lệ.

## 9. Deduplication
- `engine.rs` deduplicate findings dựa trên `finding.id` (local per scanner run).
- Do ID chứa số dòng (`line_idx`) và tên pattern (`pattern.name`), nên các secret ở các dòng khác nhau sẽ không bao giờ bị deduplicate nhầm.

## 10. Current Root Cause
Tổng hợp lại, có 2 nguyên nhân cốt lõi khiến Quick Scan mất finding secret trong file cấu hình:
1. **Discovery Failure**: Cơ chế duyệt file đã mù hoàn toàn trước các file `.env` vì chúng nằm trong danh sách `.gitignore`.
2. **Semantic Pattern Failure**: Dù có quét trúng file, regex engine chỉ tìm đúng format token xịn (AKIA, ghp_), chứ không tìm theo định dạng cấu hình nhạy cảm (như `*SECRET* = *`). Do đó dummy/test secrets bị bỏ sót hoàn toàn.

## 11. Expected Behavior
- Quick Security Scan cần phải phát hiện được việc lưu trữ secrets/credentials bên trong các file `.env`, `application.yml` bất kể đó là secret xịn hay dummy.
- Finding phải được tạo ra với mức severity `Low` và confidence `50` (vì nó nằm trong `tests/security-fixtures`).

## 12. Proposed Minimal Fix
- **Khắc phục File Discovery**: Mở rộng module `engine.rs` để khi lặp qua một directory (tương tự chiến lược quét `.git/config`), engine sẽ tự động probe (thăm dò) các file `.env`, `.env.local`, `.env.development`, `.env.production` và ép đưa vào `paths_to_scan`, vượt qua giới hạn của `.gitignore`.
- **Khắc phục Pattern Matching**: Bổ sung một (hoặc nhiều) Regex Pattern vào `core_secret_scanner` để quét Generic Semantic Secrets, ví dụ:
  `(?i)(password|secret|api_key|access_key|token)\s*[:=]\s*["']?[^"'\s]+["']?`

## 13. Regression Test Requirements
- Đảm bảo việc bắt Generic Secret không gây ra quá nhiều false positive (vd: biến `has_token = false` trong code TS không nên bị bắt).
- Cần chạy lại `cargo test` để đảm bảo không phá vỡ 11 test case hiện tại.
- Kiểm tra UI xem Quick Scan có lên đủ các finding `.env` hay không.
