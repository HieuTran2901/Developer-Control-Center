# Báo cáo Điều tra Kiến trúc: Lỗi Process Stop trên Windows (Orphan Process)

Theo yêu cầu, đây là báo cáo phân tích nguyên nhân gốc rễ (Root Cause) của hiện tượng "Tiến trình vẫn chạy sau khi nhấn Stop" trên môi trường Windows.

---

## PHASE 1 — TRACE TOÀN BỘ LUỒNG STOP

Chuỗi gọi hàm (Call Chain) đầy đủ:

1. **UI Stop Button** (Frontend)
2. ↓ **`ProcessLifecycleService.stop()`** (`src/application/services/ProcessLifecycleService.ts:11`) - Bắn event `ProcessStopping` và đặt timeout 3s.
3. ↓ **`TauriRuntimeService.stop()`** (`src/application/services/TauriRuntimeService.ts:44`)
4. ↓ **IPC (Tauri Invoke)**: `invoke('stop_process_cmd')`
5. ↓ **Rust Backend**: Nhận qua `runtime_cmds.rs`, gọi `RuntimeService::stop()`.
6. ↓ **MPSC Channel**: Gửi `ProcessCommand::Stop` vào channel của Actor Task (`src-tauri/src/runtime/service.rs:197`).
7. ↓ **Tokio Process**: Gọi `child.kill().await` (`src-tauri/src/runtime/service.rs:198`).
8. ↓ **Windows API**: `TerminateProcess` được gọi lên PID của Child.

---

## PHASE 2 — KIỂM TRA PROCESS TREE

Quá trình Start (`src-tauri/src/runtime/service.rs:77`) sử dụng `cmd.exe`:
```rust
let mut c = Command::new("cmd");
c.arg("/C").arg(cmd);
```

**Sơ đồ Process Tree thực tế trên OS:**
```text
Tauri App (Tauri App PID)
 ↓
cmd.exe (PID: lưu trong ProcessModel)  <-- Lệnh child.kill() chém vào đây
 ↓
node.exe / vite (PID: Không được ghi nhận) <-- Sống sót (Orphan)
```

---

## PHASE 3 — KIỂM TRA REGISTRY

**Trạng thái Registry hiện tại (`ProcessModel`):**
- `id`: Tồn tại
- `pid`: Có (Đây là PID của `cmd.exe`)
- `parent_pid`: `None` (Bị gán cứng `None` tại `service.rs:45`).
- `status`: Quản lý đúng luồng Enum.
- `child_handle`: **Không được lưu trữ**. Child Handle bị giam trong Actor Task (closure của `tokio::spawn`), Registry hoàn toàn mù mịt về Handle hệ điều hành.

**Hậu quả**: Khi cần thiết lập các thao tác nâng cao lên hệ điều hành (như duyệt Process Tree để kill nhánh con), Backend không có đủ metadata (thiếu `parent_pid` và không có cơ chế Job Object của Windows).

---

## PHASE 4 — KIỂM TRA STOP

Khi nhận lệnh Stop (`service.rs:197`):
```rust
ProcessCommand::Stop => {
    let _ = child.kill().await;
    let status_res = child.wait().await;
    ...
```
Hàm `child.kill()` của `tokio::process` trên Windows sẽ map thẳng xuống API `TerminateProcess`.
**Hành vi**: Nó **chỉ** giết đúng tiến trình được cung cấp Handle (ở đây là `cmd.exe`). Nó hoàn toàn **không làm gì** với các tiến trình con (node.exe). Nó không gửi `GenerateConsoleCtrlEvent` (Ctrl+C).

---

## PHASE 5 — KIỂM TRA SHELL

Xác nhận: Runtime đang sử dụng shell ảo thông qua `cmd.exe /C`.
Điều này chứng minh `child.id()` trả về PID của `cmd.exe`, chứ không phải của tiến trình Node thực sự. Mọi tác động vòng ngoài (kill, wait) chỉ áp dụng lên cái vỏ `cmd.exe`.

---

## PHASE 6 — KIỂM TRA FORCE STOP

Hàm `forceStop` **có tồn tại** trong `ProcessLifecycleService.ts`.
Có cơ chế Timeout 3000ms.
**Nhưng có bao giờ chạy không? KHÔNG BAO GIỜ.**
**Lý do:** 
1. Khi gọi `child.kill().await`, `cmd.exe` chết ngay lập tức (dưới 10ms).
2. `child.wait().await` trả về ngay.
3. Rust emit event `ProcessStopped`.
4. Frontend nhận được `ProcessStopped`, lập tức gọi `clearTimeout(timeoutId)` (`ProcessLifecycleService.ts:32`).
Vì timeout bị hủy trước 3s, hàm `forceStop` (nơi có lệnh `taskkill /T /F`) vĩnh viễn không được kích hoạt.

---

## PHASE 7 — KIỂM TRA EVENT

Luồng Event:
1. `ProcessStopping` (Frontend)
2. `child.kill()` (Rust)
3. Emit `ProcessStopped` (Rust) -> Registry Update tại Backend.
4. UI nhận `ProcessStopped` -> React render UI thành trạng thái Stopped thành công.
**Lỗi**: Giao diện UI đã chuyển sang trạng thái Stopped, nhưng OS thực tế vẫn đang chạy Node.exe. Source of Truth bị lệch hoàn toàn so với OS.

---

## PHASE 8 — WINDOWS ORPHAN

- **Tiến trình chết**: `cmd.exe`.
- **Tiến trình mồ côi (Orphan) sống sót**: `node.exe` hoặc `vite`.
- Các tiến trình này vẫn tiếp tục chiếm dụng cổng (Port 3000, 5173...), tiêu thụ CPU/RAM, gây ra lỗi `EADDRINUSE` khi người dùng nhấn Run lần tiếp theo.

---

## PHASE 9 — CLEAN ARCHITECTURE REVIEW

Đánh giá kiến trúc hiện tại:
1. **Vi phạm SRP (Single Responsibility Principle) nghiêm trọng**: File `service.rs` dài 300 dòng đang gánh vác việc format chuỗi, spawn OS process, quản lý mpsc channel, phát event Tauri, và xử lý status lifecycle.
2. **Registry thụ động**: Registry đang chỉ là một HashMap lưu trữ chuỗi JSON (Data Store), nó không có chức năng "quản lý" vòng đời.
3. **Phân quyền trách nhiệm (Stop/Kill)**: Frontend không nên quyết định Timeout 3s để Force Kill. Việc đảm bảo Process chết là trách nhiệm tuyệt đối của Backend. Frontend chỉ gửi Request `Stop`, Backend phải lo từ Graceful Shutdown đến Force Kill (nếu timeout).

---

## KẾ HOẠCH TRIỂN KHAI (PHASE TIẾP THEO)

**Root Cause**: Dùng `cmd.exe` sinh ra Process Tree, nhưng lệnh `kill()` chỉ diệt được Root Process, cộng thêm logic Event khiến Timeout Force Kill ở Frontend bị vô hiệu hoá.

**Thiết kế chuẩn Clean Architecture**:
1. Đưa logic Timeout & Kill hoàn toàn xuống Rust Backend (Làm một State Machine: `Stopping` -> chờ 3s -> nếu không chết thì gọi Crate `sysinfo` hoặc `taskkill /T /F` -> `Stopped`).
2. Tách `RuntimeService` ra làm các thành phần: `ProcessSpawner`, `ProcessMonitor`, `ProcessRegistry`.
3. Bỏ việc chèn `cmd /C` vào quá trình khởi tạo (Sử dụng trực tiếp file thực thi hoặc cấu hình Windows Job Objects để gom cụm tiến trình).

**Thứ tự implement:**
1. Cấu hình lại `ProcessCommand::Stop` trong `service.rs` để tự gọi `taskkill /T` bằng PID thay vì chỉ dùng `child.kill()`.
2. Sửa Frontend `ProcessLifecycleService` thành pure async, không quản lý timeout.
3. Refactor tách file `service.rs` thành các modules chuyên biệt.
