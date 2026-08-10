# Scan Lifecycle Stabilization Report

## 1. Root Cause
- **Blocking I/O in Async Task**: Scanner `core_secret_scanner` sử dụng API đồng bộ `std::fs::File` và `std::io::BufRead` để duyệt từng dòng của hàng chục nghìn file. Thao tác này block hoàn toàn Tokio Worker Thread, khiến Thread không thể yield (nhường quyền). Kết quả là Frontend không nhận được bất kỳ sự kiện nào (kể cả Progress hoặc Completed) cho đến khi tác vụ block hoàn thành (nếu không quá timeout). UX bị kẹt ở "Scanning...".
- **File Overload**: Quick Scan quét quá nhiều file rác không cần thiết (kể cả `.pdf`, `.mp4` nếu chúng nằm ngoài `.gitignore`), dẫn đến thời gian block kéo dài thêm rất nhiều lần.
- **Progress Event Flooding**: Việc phát sự kiện Progress (10 files một lần) qua IPC (Tauri `app_handle.emit`) với lượng lớn các file nhỏ gây nghẽn cổ chai và có khả năng dẫn đến lỗi State / Race Condition ở Frontend UI (ví dụ như lỗi hiển thị `undefined files scanned` khi bắt đầu).

## 2. Architecture Changes
- Chuyển toàn bộ operations liên quan đến Filesystem trong `core_secret_scanner.rs` từ `std::fs` sang `tokio::fs` và `tokio::io::AsyncBufReadExt`.
- Thay thế việc emit sự kiện Progress dựa trên counter thành việc emit sự kiện dựa trên Timer (Time-based Throttling - `std::time::Instant`). Emit một lần mỗi 200ms để giảm tải cho kênh giao tiếp IPC.
- Bổ sung thêm các Filter thông minh trong Quick Scan: tự động chặn hàng loạt extensions rác (như `png`, `zip`, `dll`, `pdf`...) ở cấp độ `engine.rs` trước khi đưa file xuống Scanner.
- Giữ nguyên luồng Cancel Checkpoint (`cancel_token.load`) và tích hợp thêm vào vòng lặp đọc dòng Async.
- Thêm một sự kiện Progress cuối cùng (`Finalizing`) đảm bảo số lượng `scannedFiles` tại Frontend luôn 100% khớp với thực tế.
- Bổ sung **Size Guard 1MB** vào `core_secret_scanner` để tránh OOM hoặc treo máy đối với các file quá khổng lồ.

## 3. Files Changed
- `src-tauri/src/security/engine.rs`
- `src-tauri/src/security/secret_scanner.rs`

## 4. Behavior Changes
### Quick Scan Behavior
- Không quét vào các media/binary files phổ biến.
- Thời gian Scan cải thiện rõ rệt, do skip các files rác và chạy asynchronous.
- Các file `.env.*` (không bị extension block) vẫn được phát hiện chính xác.
- Tiến trình (`scannedFiles`) nhảy liên tục nhưng không giật lag.

### Full Scan Behavior
- Quét đủ phạm vi, tuy nhiên bỏ qua các file > 1MB khi vào Secret Scan. Dependency Scan và Configuration Scan không bị ảnh hưởng.
- Ổn định và thoát Lifecycle về `Completed` đúng hẹn.

### Git Exposure Scan
- Luồng Execution Path của `git_scanner` không thay đổi. Vẫn duy trì tốc độ tính bằng mili-giây và khả năng bắt đúng credential trong `.git/config`. Không ghi nhận Regression.

## 5. Cancellation Behavior
- Nút Cancel hiện tại sẽ cắt ngang thao tác đọc dòng Asynchronous thông qua biến `cancel_token.load(Ordering::Relaxed)` rất trơn tru, trả về sự kiện `Cancelled`. Hệ thống xử lý không bị block, phản hồi UI mượt mà.

## 6. Test Results
- `cargo check`: PASS.
- `cargo test`: PASS.
- `npm run build`: PASS.

## 7. Remaining Limitations
- Nếu một Node project có chứa các extensions không bị block và lên tới 100,000 files `.js`/`.ts` không được ignore (do clone lỗi hoặc `.gitignore` sai cấu trúc), `core_secret_scanner` vẫn sẽ tốn O(N) IO Time (mặc dù bây giờ đã là Async và không treo UI). Có thể cân nhắc thêm cơ chế Hard File Limit hoặc Threshold trong tương lai.
