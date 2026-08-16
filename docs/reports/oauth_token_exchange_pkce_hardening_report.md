# AI Quota OAuth Token Exchange & RFC 7636 PKCE Hardening Report

**Tài liệu kỹ thuật / Báo cáo thay đổi (AG-9.10 -> AG-9.12)**

---

## 1. Tổng quan mục tiêu (Objective)

Trong luồng kết nối tài khoản Google OAuth (`Connect Account`) cho tính năng **AI Quota Monitoring** của Developer Control Center (DCC), người dùng hoàn tất consent trên trình duyệt nhưng gặp lỗi ở bước token exchange (`HTTP 400 Bad Request`) và giao diện hiển thị trạng thái *"Retry Connection"*.

Mục tiêu của đợt cập nhật này là:
1. **Bóc tách và hiển thị chi tiết mã lỗi Google OAuth** thay vì ẩn giấu (mask) trong chuỗi generic HTTP 400.
2. **Chuẩn hóa PKCE theo RFC 7636** bằng cách sinh `code_verifier` ngẫu nhiên bảo mật (OS-backed cryptographic randomness) trên bảng ký tự unreserved chuẩn và kiểm tra toán học với vector mẫu chuẩn.
3. **Hoàn thiện mô hình liên kết tài khoản (Account Binding Model)** với 3 kịch bản: Exact Match, Placeholder/Generic Auto-bind, và Mismatch Resolution với hộp thoại xác nhận trên UI.
4. **Cô lập và bảo mật thông tin xác thực** trong Windows Credential Manager (`developer-control-center:antigravity-oauth:<accountId>`).

---

## 2. Chi tiết các thay đổi đã thực hiện (Implementation Details)

### 2.1. Backend Rust (`src-tauri/src/monitor/quota_oauth.rs`)

1. **Hiển thị chi tiết lỗi Google Token Exchange (`exchange_auth_code`)**:
   - Thay vì trả về chuỗi generic `"Google OAuth token exchange rejected with HTTP 400"`, hàm sẽ đọc nội dung body phản hồi từ Google (`resp.text().await`).
   - Deserialize cấu trúc lỗi JSON từ Google:
     ```json
     {
       "error": "invalid_grant | invalid_request | invalid_client ...",
       "error_description": "...",
       "error_uri": "..."
     }
     ```
   - Định dạng thông báo lỗi chi tiết, làm sạch thông tin nhạy cảm qua `sanitize_error_message`:
     `Google OAuth token exchange failed (HTTP <status>): error='<error>' description='<error_description>'`.

2. **Chuẩn hóa PKCE theo RFC 7636 (`generate_rfc7636_pkce_verifier` & `compute_pkce_challenge`)**:
   - Sử dụng entropy ngẫu nhiên bảo mật từ OS (`uuid::Uuid::new_v4().as_bytes()`, gọi `BCryptGenRandom` trên Windows).
   - Sử dụng đúng bảng ký tự RFC 7636 unreserved: `[A-Za-z0-9-._~]` (66 ký tự).
   - Độ dài `code_verifier` cố định 64 ký tự (nằm trong khoảng 43 - 128 ký tự theo tiêu chuẩn).
   - Tính toán `code_challenge = URL_SAFE_NO_PAD.encode(SHA256(code_verifier))` không chứa ký tự đệm `=`.

3. **Account Binding & Registry Sync (`start_oauth_flow`)**:
   - Thêm cờ `allow_email_update: bool`.
   - **Case A (Exact Match)**: Email từ Google khớp với cấu hình tài khoản $\rightarrow$ lưu Keyring và kích hoạt polling ngay.
   - **Case B (Placeholder / Generic Identity)**: Nhận diện placeholder (`@antigravity.oauth`, `@placeholder.com`, `primary`, `account*`) $\rightarrow$ kiểm tra trùng lặp email với các tài khoản khác, tự động cập nhật email thật vào registry, lưu Keyring và kích hoạt polling.
   - **Case C (Email Mismatch)**: Nếu email khác và `allow_email_update == false` $\rightarrow$ trả về `status: "AccountMismatch"`, `diagnostic_stage: "confirming_account"` để người dùng xác nhận trên UI.

4. **Cải tiến thông điệp Loopback Server**:
   - Cập nhật trang phản hồi HTML của socket listener localhost thành:
     *"✓ Google Authorization Received. Return to Developer Control Center to complete account verification and quota synchronization. You can safely close this browser window."*

5. **Bộ kiểm thử đơn vị (Unit Tests)**:
   - `test_rfc7636_pkce_mathematical_vector`: Kiểm tra vector mẫu chuẩn RFC 7636 Appendix B (`dBjftJeZ...` $\rightarrow$ `E9Melhoa...`).
   - `test_pkce_session_generation_compliance`: Kiểm tra độ dài (64 char verifier, 43 char challenge, 32 char state), bảng ký tự unreserved và tính toán challenge không có ký tự `=`.
   - `test_google_error_payload_parsing`: Kiểm tra khả năng parse phản hồi lỗi JSON từ Google.
   - `test_placeholder_email_detection`: Kiểm tra phân loại email placeholder.
   - `test_keyring_account_isolation_keys`: Kiểm tra tính cô lập của key lưu trữ theo `accountId`.

---

### 2.2. Backend IPC (`src-tauri/src/monitor/mod.rs`)

- Cập nhật lệnh IPC Tauri `quota_connect_google_account_cmd` để nhận thêm tham số tùy chọn `allow_email_update: Option<bool>`.

---

### 2.3. Frontend Service & UI (`src/application/services/`, `src/features/settings/`)

1. **`QuotaPollingService.ts`**:
   - Mở rộng hàm `connectGoogleAccount(accountId: string, allowEmailUpdate?: boolean)`.

2. **`QuotaAccountCard.tsx`**:
   - Mở rộng máy trạng thái kết nối `ConnectStage`:
     `idle` $\rightarrow$ `starting` $\rightarrow$ `waiting_for_browser` $\rightarrow$ `waiting_for_callback` $\rightarrow$ `authenticating` $\rightarrow$ `verifying_identity` $\rightarrow$ `confirming_account` $\rightarrow$ `binding_credentials` $\rightarrow$ `refreshing_quota` $\rightarrow$ `connected` / `failed`.
   - Bổ sung giao diện so sánh & giải quyết Mismatch trong Modal kết nối:
     - Hiển thị rõ: *Email đã cấu hình trong DCC* vs *Email tài khoản Google vừa đăng nhập*.
     - Cung cấp 2 hành động rõ ràng:
       1. `[ Sign in with another Google account ]`: Thực hiện lại OAuth mà không cập nhật email.
       2. `[ Confirm & Connect ]`: Hoàn tất liên kết và cập nhật cấu hình tài khoản với `allow_email_update = true`.

---

## 3. Các quy tắc an toàn & bảo mật được bảo đảm (Security & Safety Guarantees)

1. **Không can thiệp hoặc scrape dữ liệu trái phép**:
   - Không đọc cookie/browser session.
   - Không đọc bộ nhớ tiến trình (process memory) của Antigravity hay trình duyệt.
   - Không can thiệp hoặc thay đổi trạng thái xác thực nội bộ của Antigravity.
2. **Bảo mật Token**:
   - Toàn bộ refresh token được lưu trữ an toàn trong Windows Credential Manager (`developer-control-center:antigravity-oauth:<accountId>`).
   - Access token chỉ tồn tại tạm thời trong RAM backend Rust phục vụ request, không bao giờ lộ ra log, console, IPC payload hay React state.
   - Mọi thông báo lỗi đều được làm sạch qua hàm khử nhạy cảm `sanitize_error_message`.
3. **Tính trung thực dữ liệu**:
   - Tuyệt đối không tạo mock quota hay giả lập token. Trạng thái thực tế phản ánh chính xác từ kết quả xác thực.

---

## 4. Kết quả kiểm thử & Build (Validation Results)

- **`cargo check --manifest-path src-tauri/Cargo.toml`**: **PASS** (0 lỗi)
- **`npm run build`**: **PASS** (0 lỗi, build hoàn tất trong ~12s)
- **Kiểm thử logic PKCE & Error Parser**: **PASS** (Tất cả unit tests trong `src-tauri` pass 100%)
