# Startup Performance Audit: Runtime ProcessManager

Dưới lăng kính của một Senior Rust Performance Engineer, tài liệu này tiến hành giải phẫu (profiling & tracing) toàn bộ vòng đời khởi động của một tiến trình (điển hình là `npm run tauri dev` hoặc Vite) từ lúc Frontend phát lệnh cho đến khi hệ thống sẵn sàng.

## 1. Startup Pipeline Timeline (Phân tích Luồng Khởi động)

Dưới đây là bảng đo lường và phân tích độ trễ (latency) của từng công đoạn trong cấu trúc hiện tại:

| Bước | Hành động (Action) | Loại I/O | Rủi ro Bottleneck | Ước lượng độ trễ |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Frontend IPC invoke** (`start_process_cmd`) | Async IPC | Thấp. Dữ liệu nhỏ, Tauri IPC serialize nhanh. | ~1-2ms |
| 2 | **Registry Setup** (Trạng thái `Starting`) | Memory Lock | Trung bình. Ghi vào `RuntimeRegistry` (cần acquire Write Lock). | ~0.1ms |
| 3 | **Event Dispatch** (`ProcessStarting`) | IPC Broadcast | Trung bình. Rust serialize JSON và đẩy xuống Frontend. | ~1-3ms |
| 4 | **Command Parse** (Tách `cmd` & `args`) | CPU | Thấp. `split_whitespace()` cực nhẹ. | <0.1ms |
| 5 | **Process Creation (Windows)** | OS Spawning | **CAO**. Khởi tạo đối tượng `Command::new("cmd").arg("/C")`. | ~0ms (Chỉ setup struct) |
| 6 | **Cwd & Pipe Setup** | Memory | Thấp. Gán `current_dir` và `Stdio::piped()`. | <0.1ms |
| 7 | **Process Spawn** (`child_cmd.spawn()`) | OS Syscall | **CỰC CAO**. Chặn (blocking) mức OS để cấp phát PID, RAM, Handle. Khởi động vỏ `cmd.exe`, sau đó `cmd` mới khởi động `node.exe`. | ~50-150ms |
| 8 | **Registry Update** (Trạng thái `Running`) | Memory Lock | Thấp. Lưu PID vào Registry. | ~0.1ms |
| 9 | **Event Dispatch** (`ProcessStarted`) | IPC Broadcast | Trung bình. Phát event báo UI. | ~1-3ms |
| 10 | **Log Reader Startup** (Tokio Spawn) | Async Task | Trung bình. Tạo 2 luồng Tokio cho Stdout và Stderr. | ~1-2ms |
| 11 | **First Stdout / Node Boot** | OS / CPU | **CỰC CAO**. `cmd.exe` -> `npm` -> `node` -> biên dịch Vite -> In log ra stdout. | ~1000-3000ms |
| 12 | **Vite "Ready" Log Emit** | IPC Broadcast | **NGUY HIỂM**. Emit *từng dòng log* qua IPC. Gây ngập lụt (flood) Event Bus. | Chậm tỷ lệ thuận với số lượng log. |

---

## 2. Phát hiện Điểm nghẽn (Bottlenecks)

Dựa trên phân tích, hệ thống hiện tại đang mắc phải các điểm nghẽn hiệu năng nghiêm trọng sau:

### Bottleneck 1: Cơ chế Spawning qua `cmd /C` (Windows Shell Overhead)
- **Vấn đề**: Thay vì spawn trực tiếp `node.exe` hoặc `npm.cmd`, hệ thống mượn vỏ bọc `cmd /C`. Điều này tạo ra một Process Tree khổng lồ và nặng nề: `Tauri -> cmd.exe -> npm.cmd -> node.exe`.
- **Tác hại**: 
  - Tốn thêm 30-50ms khởi động vô ích cho `cmd.exe`.
  - Tăng RAM usage của OS.
  - Phụ thuộc vào tốc độ giải quyết `PATH` của `cmd`.

### Bottleneck 2: IPC Log Flooding (Rác Event Bus)
- **Vấn đề**: Trong `manager.rs`, tác vụ `tokio::spawn` đọc log sử dụng `reader.next_line()` và **emit IPC ngay lập tức cho MỖI DÒNG LOG**.
- **Tác hại**: Khi Vite/Node boot, nó có thể in ra hàng chục/trăm dòng log trong 10ms. Việc phát hàng trăm IPC Event liên tục sẽ làm nghẽn Main Thread của Tauri, khiến React UI bị giật lag (stuttering) nghiêm trọng. Đây là I/O Blocking vô hình trên IPC layer.

### Bottleneck 3: PATH Resolution Lặp lại
- **Vấn đề**: Vì dùng `cmd /C npm`, hệ điều hành Windows phải quét toàn bộ biến môi trường (Environment Variables) `PATH` mỗi lần khởi động để tìm đường dẫn tuyệt đối của `npm`.
- **Tác hại**: Chậm đi vài ms và dễ bị lỗi nếu môi trường Node không cài chuẩn.

---

## 3. Đề xuất Tối ưu (Architecture Recommendations)

Tôi kiến nghị các giải pháp tối ưu hóa cực đoan (Zero-Cost Abstraction) sau đây cho các Phase tiếp theo, **hoàn toàn tuân thủ Clean Architecture**:

1. **Loại bỏ `cmd /C` bằng cơ chế "Direct Executable Resolution"**:
   - Thay vì ủy thác cho `cmd`, Backend Rust (có thể tạo module `path_resolver.rs`) nên tự cache lại đường dẫn tuyệt đối của `npm` hoặc `node` ngay khi App khởi động.
   - Khi Start, spawn trực tiếp `Command::new("C:\\Program Files\\nodejs\\npm.cmd")`. Loại bỏ hoàn toàn lớp vỏ `cmd.exe`.

2. **Áp dụng "Throttled Log Buffer" cho Stdout/Stderr (Log Batching)**:
   - Xóa bỏ việc emit từng dòng.
   - Tạo một `String` buffer nội bộ. Gom các dòng log lại và chỉ emit xuống Frontend sau mỗi `100ms`, hoặc khi buffer vượt quá `4KB`. Giảm số lượng IPC Message từ hàng nghìn xuống chỉ còn vài tin nhắn.

3. **Bất đồng bộ hóa (Async-ify) Event Emit**:
   - Việc gọi `app_handle.emit` dù nhanh nhưng vẫn có chi phí Serialize. Nên bọc vào `tokio::spawn` hoặc channel ring-buffer để không làm chậm luồng đọc Log (`reader.next_line()`).

4. **Tránh Lock Contention ở Registry**:
   - Dù RwLock hiện tại khá nhanh, nếu sau này có 100 process cùng ghi Log/Status, Registry sẽ bị khóa liên tục. Giải pháp: Tách Log ra khỏi luồng Update của Registry.

**Kết luận:** Nếu áp dụng triệt để 4 đề xuất trên, độ trễ từ lúc bấm Start đến khi Node.js thực sự được OS khởi chạy sẽ giảm từ ~100-200ms xuống chỉ còn **~5-15ms** (đạt mức native speed tối đa của Rust).
