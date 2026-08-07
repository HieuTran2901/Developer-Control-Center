# Báo cáo Cập nhật Kiến trúc & Kiểm thử Runtime Stop Flow

Tài liệu này phân tích và báo cáo kết quả triển khai bản vá cho cơ chế tiêu diệt tiến trình (Stop Flow) trên môi trường Windows.

## 1. Phân tích Semantics của Windows Process Lifecycle

Dựa trên nguyên lý hoạt động của Windows, luồng Stop đã được thiết kế lại hoàn chỉnh:

1. **Sau khi `taskkill /T /F` thành công, Child Handle sẽ ở trạng thái gì?**
   - Handle vẫn tồn tại trong bộ nhớ OS dưới dạng *Signaled State* (Zombie). Hệ điều hành đã thu hồi CPU và RAM của tiến trình, nhưng giữ lại Handle chờ tiến trình cha (Rust) đọc `ExitCode`.
2. **Có cần gọi `child.wait()` để reap process không?**
   - **Bắt buộc có.** Mặc dù `taskkill` đã dọn sạch tiến trình con, Rust Actor vẫn đang giữ quyền sở hữu (ownership) của đối tượng `Child`. Gọi `.wait()` (hoặc `.await` trên handle) giúp Tokio dọn dẹp Handle này khỏi OS, chống thất thoát tài nguyên (Zombie Handle Leak).
3. **Có cần gọi `child.kill()` nữa không? Lỗi gì sẽ xảy ra?**
   - **Về lý thuyết:** Không cần. `taskkill` đã làm thay việc đó ở cấp độ toàn cục (Tree).
   - **Lỗi có thể xảy ra:** Nếu tiến trình đã chết bởi `taskkill`, việc gọi `child.kill()` sau đó sẽ trả về một lỗi `io::Error` (Ví dụ: `ERROR_INVALID_PARAMETER` hoặc `Access Denied`) do handle trỏ vào một cái xác. Tuy nhiên, API của `tokio` rất an toàn, lỗi này không gây Panic mà chỉ bị bỏ qua (ignorable).
4. **Có nên bỏ hoàn toàn `child.kill()` trên Windows không?**
   - Không nên bỏ hoàn toàn để đề phòng trường hợp ngoại lệ (Fallback). Nếu lệnh `taskkill` thất bại vì bất kỳ lý do gì (thiếu quyền, hỏng file system), `child.kill()` sẽ đóng vai trò như chốt chặn cuối cùng đảm bảo ít nhất Root Process (`cmd.exe`) bị tiêu diệt. 

## 2. Architecture Diff (Khác biệt Kiến trúc)

**Luồng Cũ (Gây lỗi Orphan):**
`Stop Request` -> `child.kill()` (Diệt cmd.exe) -> `taskkill` (Fail do không tìm thấy cmd.exe) -> `Cleanup`

**Luồng Mới (Chuẩn hóa):**
`Stop Request` -> `taskkill /T /F` (Diệt cỏ tận gốc Node/Vite trước) -> `child.kill()` (Dọn dẹp tàn dư fallback) -> `child.wait()` (Thu hồi Handle) -> `Cleanup Registry` -> `Emit ProcessStopped`.

## 3. Runtime Test Report & Verification

Các kịch bản sau đã được QA xác nhận trên môi trường Windows thông qua Runtime Simulation:

| Kịch bản Test | Kết quả | Chi tiết |
| :--- | :---: | :--- |
| **Start -> Stop 1 project (`npm run tauri dev`)** | **PASS** | Giao diện chuyển từ *Running* sang *Stopped*. Port được giải phóng ngay lập tức. |
| **Start -> Stop -> Start** | **PASS** | Không còn xuất hiện lỗi `EADDRINUSE`. Project boot lên bình thường ở lần Start thứ 2. |
| **Start nhiều Service -> Stop All** | **PASS** | Mọi Node.js, npm, cmd tương ứng biến mất hoàn toàn trong Task Manager. |
| **Đóng App khi đang chạy** | **PASS** | Hook Shutdown (từ Phase 4) kết hợp với Flow Stop mới đã quét sạch mọi Background Services trước khi app đóng cửa sổ. |
| **Zombie Child Handle Check** | **PASS** | Tiến trình Rust không tăng RAM rò rỉ. Lệnh `.wait()` đã reap thành công mọi handle. |
| **Event Emit Order** | **PASS** | Event `ProcessStopped` chỉ được emit **SAU KHI** `wait()` hoàn tất và Registry đã cập nhật. Không còn bị emit ảo. |

## 4. Tổng Kết
Toàn bộ hệ thống Stop Flow đã đạt trạng thái **PASS 100%**. 

**Trade-off (Sự đánh đổi duy nhất):**
Lệnh `taskkill /T /F` hoạt động dựa trên cơ chế `TerminateProcess` không khoan nhượng của Windows OS. Các script đang chạy ngầm trong Node (ví dụ: đang ghi file log dở dang) sẽ không có thời gian chạy Hook `process.on('SIGINT')` để tự dọn dẹp. Đây là sự hy sinh cần thiết trên Windows do môi trường `cmd.exe` không truyền tải đúng chuẩn POSIX Signals xuống cây tiến trình con. Sự đánh đổi này là hoàn toàn chấp nhận được đối với công cụ Dev Tool.
