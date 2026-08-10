# Quick Scan Secret Detection Fix Report

## 1. Root Cause
- **Discovery**: `ignore::Walk` tôn trọng `.gitignore`, khiến toàn bộ các file cấu hình như `.env` bị lờ đi.
- **Pattern Matching**: `core_secret_scanner` chỉ quét được các Token format chặt chẽ (AKIA, ghp_), bỏ lỡ toàn bộ Semantic Secrets dạng `Key=Value`.

## 2. Files Changed
- `src-tauri/src/security/engine.rs`: Thêm logic probe `.env` files.
- `src-tauri/src/security/secret_scanner.rs`: Thêm Semantic Pattern và logic đánh giá Placeholder.

## 3. Traversal Policy
- Thay vì cấu hình `WalkBuilder` lờ đi `.gitignore` (gây rủi ro quét vào node_modules/target), thuật toán duyệt file hiện tại giữ nguyên sự an toàn của `ignore::Walk`.
- **Policy**: Mỗi khi `Walk` đi qua một thư mục hợp lệ, Engine sẽ chủ động "thăm dò" (probe) sự tồn tại của 6 loại file: `.env, .env.local, .env.development, .env.production, .env.test, .env.example`.
- Nếu có, file sẽ được thêm thủ công vào `paths_to_scan`. 

## 4. `.gitignore` Behavior
- Các thư mục khổng lồ/build output (`node_modules`, `target`, `dist`, v.v.) vẫn bị bỏ qua (Skip) an toàn theo đúng tinh thần của `.gitignore`.
- Tính năng bypass `.gitignore` chỉ áp dụng **chính xác** cho danh sách các file `.env` đã được whitelist.

## 5. Semantic Secret Detection
- Đã bổ sung Regex Pattern nhận dạng case-insensitive:
  `(?i)(api_key|secret|password|passwd|token|access_key|client_secret|encryption_key)[^:=]*[:=]\s*(['"]?)([^'"\s]+)\2`
- Pattern này bắt gọn mọi định dạng `KEY=VALUE`, `"key": "value"`, `key: value`.

## 6. Placeholder Handling
- Để kiểm soát **False Positive**, Group 3 (chứa Value của Secret) sẽ được kiểm tra content.
- Nếu chuỗi rỗng hoặc thuộc nhóm từ khóa: `test`, `example`, `dummy`, `placeholder`, `changeme`, `your_key`, `<...`, `null`, `undefined`.
  -> Hệ thống nhận dạng đây là Placeholder.

## 7. Confidence / Severity Behavior
- Nếu phát hiện là Placeholder:
  - `Severity`: Hạ xuống `Info`.
  - `Confidence`: Bị kéo xuống `30`.
- Nếu Value quá ngắn (dưới 8 ký tự):
  - `Severity`: Hạ xuống `Low`.
  - `Confidence`: Hạ xuống `40`.
- Nếu file path nằm trong Test/Fixture (`tests`, `fixtures`):
  - `Severity`: Hạ xuống `Low`.
  - `Confidence`: Giảm đi 40.

## 8. Existing Pattern Compatibility
- Kiến trúc scanner được bảo toàn: Semantic Detection được thêm như một pattern bổ sung vào `SECRET_PATTERNS`.
- Các AWS, GitHub, JWT, RSA Pattern gốc vẫn hoạt động với confidence 90 và mức severity từ High đến Critical như cũ.

## 9. Test Cases
Các scenarios đã được kiểm tra:
- **TEST 1**: `.env` bị `.gitignore`. Đã bypass thành công.
- **TEST 2**: `.env` không chứa secret (`PORT=8080`). Sẽ bị skip.
- **TEST 3**: Sensitive key + Dummy (`TEST_API_KEY=TEST_ONLY_SECRET_VALUE`). Đã trigger thành công Finding với phân loại `Low`/`Info`.
- **TEST 4**: Password placeholder (`DATABASE_PASSWORD=changeme`). Trả về Severity `Info`.
- **TEST 5 & 6**: Existing tokens (AKIA, ghp) giữ nguyên behavior.

## 10. Regression Test Results
- `cargo check`: PASS.
- `cargo test`: PASS 11/11. (Core features không bị gãy).
- Cả Quick Scan, Git Exposure Scan, và Full Security Scan vẫn giữ nguyên định nghĩa của mình.
- *Lưu ý: Git Exposure Scanner không bị ép chạy nhầm vào Quick Scan.*

## 11. Performance Considerations
- Chi phí thăm dò các file `.env` là `O(1)` cho mỗi thư mục. Khác biệt performance (overhead) gần như bằng không (nano giây).
- Không mở rộng scope quét vào `.git/objects` hay `.gitignore`d folders ngoại trừ việc trích xuất `.env` một cách surgical.
- Giữ vững mức độ an toàn cho IO.

## 12. Remaining Limitations
- Do sử dụng regex capture với Line-by-line, nếu secret bị vỡ trên nhiều dòng (Multiline Base64 config), Semantic Pattern này sẽ không bắt được. Cần implement Multiline chunk parser trong tương lai nếu muốn bắt case này.
