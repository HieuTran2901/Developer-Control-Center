# SECURITY SCAN LIFECYCLE / HANGING STATE AUDIT

## 1. Trace Toàn Bộ Lifecycle

Luồng thực thi từ frontend xuống backend:
1. UI (`SecurityOverview.tsx`) gọi `handleStartScan`.
2. Frontend IPC gọi `securityService.startSecurityScan(...)`.
3. Rust backend (`engine.rs`) nhận lệnh `start_scan`.
4. Rust backend emit event `Started`.
5. Rust tạo một Tokio background task `tauri::async_runtime::spawn(async move { ... })`.
6. Bên trong task này:
   - Dùng `ignore::Walk` để loop qua toàn bộ các file trong project.
   - Với mỗi file, loop qua mảng các `scanners`.
   - Gọi `scanner.scan(path).await`.
   - Cứ mỗi 10 file, emit event `Progress`.
   - Nếu có finding (`chunk.len() >= 50`), emit `FindingsChunk`.
7. Kết thúc vòng lặp `Walk`, emit event `Completed`.
8. Frontend nhận `Completed` và chuyển trạng thái `status = 'COMPLETED'`.

**Điểm "kẹt" (Hang) của Quick Scan & Full Scan:**
Vấn đề nằm ở **Synchronous Blocking I/O** bên trong Tokio Worker Thread.
- Tokio sử dụng cooperative scheduling. Bất kỳ function `async` nào cũng phải nhường quyền (yield) thông qua các lời gọi `.await` (như `tokio::fs::read`).
- Tuy nhiên, `core_secret_scanner.rs` (dùng trong Quick Scan và Full Scan) lại đang sử dụng `std::fs::File::open` và đọc file từng dòng một cách **đồng bộ (synchronous)**.
- Khi project có hàng ngàn hoặc hàng chục ngàn file (ví dụ `node_modules`), việc mở và đọc từng file liên tục bằng `std::fs::File` bên trong vòng lặp của một task `async` sẽ **chiếm dụng hoàn toàn (block) Tokio thread**. 
- Điều này không tạo ra Infinite Loop, nhưng nó làm tiến trình Scan chạy quá lâu (hàng chục phút cho các project lớn) và ngăn cản Tokio xử lý các task khác, khiến UI cảm giác như bị treo (hang) vĩnh viễn ở trạng thái "Scanning...".

---

## 2. So Sánh Với Git Exposure Scan (Baseline)

Git Exposure Scan hoạt động bình thường, vì scanner của nó (`git_scanner.rs`) thực hiện một thao tác cực kỳ quan trọng ở ngay đầu hàm `scan`:
```rust
if file_name != "config" {
    return Ok(vec![]);
}
```
Nhờ dòng này, với 50,000 file của project, `git_scanner` trả về lập tức (return early) cho 49,999 file. Việc duyệt qua 50,000 file kết thúc trong vài chục mili-giây, dẫn đến vòng lặp `engine.rs` kết thúc nhanh chóng và phát ra event `Completed`.

**Bảng So Sánh Lifecycle:**

| Lifecycle | Git Exposure | Quick Scan | Full Scan |
|---|---|---|---|
| **Command invoked** | Tốt (IPC gọi xuống Rust) | Tốt | Tốt |
| **Scanner started** | Event `Started` gửi thành công | Event `Started` gửi thành công | Event `Started` gửi thành công |
| **Scanner execution** | Trả về ngay lập tức nếu không phải `.git/config` | **BLOCKING I/O:** Mở & quét đồng bộ *mọi file* | **BLOCKING I/O:** Gộp lỗi của Quick + gọi OSV API |
| **Result returned** | Siêu nhanh (< 100ms) | Kẹt tại `std::fs::File::read` (hàng ngàn file) | Kẹt tại `std::fs` & `reqwest` batch |
| **Results aggregated** | Gom nhóm thành công | Chờ quá lâu không tới được bước này | Chờ quá lâu không tới được bước này |
| **Completion emitted**| Rust emit `Completed` thành công | Bị giữ (delay) cho đến khi quét xong mọi file | Bị giữ (delay) cho đến khi quét xong |
| **IPC completed** | Frontend nhận ngay lập tức | Chưa được phát ra | Chưa được phát ra |
| **UI leaves scanning**| Trở về `Scan completed` | Bị kẹt ở `Scanning...` | Bị kẹt ở `Scanning...` |

---

## 3. Kiểm Tra Các Nguyên Nhân Hang (Chi tiết)

### A. Future không được await / Task bị bỏ qua
- Không phát hiện trường hợp `spawn` không an toàn bị bỏ quên (dangling future). Hàm `scanner.scan(&path_to_scan, cancel_token).await` được gọi và `await` chuẩn xác.

### B. Scanner task không return (Infinite Loop)
- Không có Infinite Loop (như vòng `loop {}` vô tận không có lối thoát).
- `ignore::Walk` sẽ dừng khi hết file.
- Tuy nhiên, **thời gian hoàn thành O(N)** với N là số lượng file, kết hợp với Synchronous File Read (O(M) với M là số dòng trong file) khiến tổng thời gian vượt quá ngưỡng chịu đựng (Timeout/UX Hang).

### C. UI hiển thị "undefined files scanned"
- Vấn đề serialization của `SecurityScanEvent`: Struct `Progress` trong `domain.rs` sử dụng `#[serde(rename = "scannedFiles")]`. 
- Sự khác biệt về naming convention hoặc một lỗi race condition cực nhỏ trong React (EventBus nhận payload nhưng React state không render kịp, hoặc missing data trong batch render của React) có thể dẫn tới việc `scannedFiles` báo undefined ở những mili-giây đầu tiên, trước khi bị luồng quét khổng lồ chiếm dụng.

## KẾT LUẬN & ĐỀ XUẤT FIX (PHASE TIẾP THEO)
1. **Refactor `core_secret_scanner.rs`**: Chuyển từ `std::fs::File` sang `tokio::fs::File` kết hợp với `tokio::io::AsyncBufReadExt` (ví dụ `Lines`) để không block thread của Tokio.
2. **File Filtering cho Quick Scan**: Cần giới hạn loại file (extensions) quét trong Quick Scan, hoặc ít nhất chặn quét các file binary/media/dịch vụ (.jpg, .pdf, .exe...) hoặc thư mục rác để tăng tốc. Quick Scan không nên quét toàn bộ 100,000 files trong thư mục `node_modules` bằng regex từng dòng.
