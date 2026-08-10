# Security Scan Test Matrix

Bảng dưới đây mô tả kết quả mong đợi (Expected Results) dựa trên phân tích mã nguồn hiện tại của hệ thống Security Scanner.

| Fixture (Nguồn dữ liệu) | Quick Scan | Git Exposure Scan | Full Scan |
|---|---|---|---|
| **.env (Secret Patterns)** | YES | NO | YES |
| **Tracked .env** | NO | NO (Limitation) | NO |
| **Git remote credential (.git/config)** | NO | YES | YES |
| **Configuration (debug, cors)** | YES | NO | YES |
| **Dependency vulnerability** | NO | NO | YES |
| **Normal source file (Safe files)** | Bỏ qua (scan) | Bỏ qua (scan) | Bỏ qua (scan) |

**Giải thích:**
- **Tracked .env:** Mặc dù `.env` được track bởi Git, `git_scanner` CHỈ quét nội dung của file `.git/config` và không đọc bất kỳ file nào khác trong kho lưu trữ. Do đó, chế độ Git Exposure Scan sẽ KHÔNG phát hiện ra lỗ hổng `.env` bị lộ. Nếu `.env` KHÔNG bị bỏ vào `.gitignore`, `core_secret_scanner` (hoạt động trong Quick/Full Scan) có thể bắt được nó, nhưng vì nó bị hạ severity thành Low cho thư mục test/fixture, đây là hành vi cần chú ý. Thực tế, `ignore::Walk` sẽ không skip `.env` nếu nó đã commit/không ignore, nên Quick Scan và Full Scan SẼ quét nội dung của nó, tuy nhiên do limitation, nó không nhận dạng đây là một "Git Exposure", mà chỉ là một "Secret Finding". Bảng trên mô tả trạng thái có phát hiện được TÍNH CHẤT TRACKED hay không.
- **Git remote credential:** Bị bắt bởi `git_scanner`.
- **Dependency vulnerability:** Bị bắt bởi `dependency_scanner`.

---

*Lưu ý: Bảng này dựa hoàn toàn vào implementation thực tế trong source code (Phase A), không suy đoán.*
