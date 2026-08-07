# Runtime Stop Flow Audit & Root Cause Analysis

Dưới đây là kết quả rà soát (Audit) toàn bộ đường đi của lệnh Stop, hoàn toàn dựa trên suy luận Runtime mà không sửa đổi mã nguồn.

## 1. Trạng thái Registry khi Running
- **ProcessModel**: Được lưu trong `RuntimeRegistry` với `status = Running`.
- **Child Handle**: Không lưu trong Registry. Nó được giữ bởi vòng lặp `tokio::select!` bên trong Actor (`manager.rs`).
- **PID**: Được lưu trong biến cục bộ `pid_opt` của Actor, đồng thời update vào `ProcessModel`.
- **RuntimeId**: Tồn tại dưới dạng `actor_id` (`projectId-profileId`).

## 2. Kiểm tra Đường đi lệnh Stop (Flow Audit)

| Bước | Thực thi | Kết quả | Ghi chú / Lỗi phát hiện |
| :--- | :---: | :--- | :--- |
| `Frontend Button` | Có | **PASS** | React UI truyền đúng ID. |
| `TauriRuntimeService.stop()` | Có | **PASS** | Gọi `invoke('stop_process_cmd')`. |
| `IPC invoke` | Có | **PASS** | Gọi `runtime_cmds.rs`. |
| `controller.rs` | Có | **PASS** | Gọi `manager.stop()`. |
| `manager.stop()` | Có | **PASS** | Lấy khóa Mutex, **xóa `tx` khỏi `children_map`**, gửi lệnh `ProcessCommand::Stop` qua channel. |
| `Actor recv()` | Có | **PASS** | Actor nhận được tín hiệu Stop trong `tokio::select!`. Vẫn giữ được Child Handle. |
| `Graceful Kill (child.kill())` | Có | **FAIL** | Đây chính là lúc thảm họa xảy ra. Lệnh này lập tức giết chết `cmd.exe`. |
| `Timeout / Wait` | Có | **PASS** | `child.wait()` lập tức trả về `Ok` vì `cmd.exe` đã chết. Bỏ qua nhánh Err Timeout. |
| `taskkill /T /F` | Có | **FAIL** | Lệnh gọi `force_kill_process_tree(pid)` được thực thi nhưng **thất bại ngầm**. |
| `Cleanup / Emit` | Có | **PASS** | Actor ghi nhận `Exited`, cập nhật Registry thành `Exited`, và emit `ProcessStopped`. Frontend nhận event đổi trạng thái sang Stopped dù Node vẫn đang chạy ngầm. |

---

## 3. ROOT CAUSE ANALYSIS (Nguyên nhân Cốt lõi)

Hiện tượng tiến trình Node.js/Vite vẫn tiếp tục chạy sau khi bấm Stop là do **Lỗi Logic Tiêu Diệt Tiến Trình (Process Tree Termination Logic Flaw)**.

**Chi tiết:**
- **File**: `src-tauri/src/runtime/manager.rs`
- **Function**: `tokio::spawn` Actor, nhánh xử lý `ProcessCommand::Stop` (khoảng dòng 197-210).

**Dòng code gây án:**
```rust
// 1. Attempt graceful stop
let _ = child.kill().await;

// 2. Wait with timeout
// ...
// On Windows, child.kill() only kills cmd.exe. We must kill orphans.
if let Some(pid) = pid_opt {
    let _ = crate::runtime::terminator::force_kill_process_tree(pid).await;
}
```

**Tại sao nó thất bại?**
1. Lệnh `child.kill().await` trên Windows sẽ gọi thẳng hàm OS `TerminateProcess` nhắm vào vỏ bọc `cmd.exe`. Lớp vỏ này chết **ngay lập tức**.
2. Tiến trình Node.js và Vite bên trong trở thành **Orphan Process** (Tiến trình mồ côi) và vẫn tiếp tục bám vào Port.
3. Khi code chạy tiếp tới lệnh `force_kill_process_tree(pid)` gọi `taskkill /PID <pid> /T /F`.
4. Trớ trêu thay, `pid` lúc này là PID của `cmd.exe`. Vì `cmd.exe` **đã chết ở bước 1**, hệ điều hành Windows trả về lỗi: `ERROR: The process "<pid>" not found.`
5. Do `taskkill` không tìm thấy PID gốc, nó **từ chối** thực hiện việc dò tìm Process Tree (`/T`). Hậu quả là các tiến trình con (node, npm, vite) không bao giờ bị tiêu diệt.
6. Hàm `force_kill_process_tree` phớt lờ lỗi này (hoặc trả về Err nhưng block mã bỏ qua lỗi bằng `let _ =`), khiến Actor lầm tưởng quá trình dọn dẹp đã thành công và emit `ProcessStopped`.

**Kết luận (ROOT CAUSE):** Việc gọi `child.kill().await` TRƯỚC KHI gọi `taskkill /T` đã tự tay xóa sổ "dấu vết" PID gốc, khiến Windows không thể lần theo cây tiến trình để diệt cỏ tận gốc.

---

## 4. KẾT LUẬN & ĐỀ XUẤT

| Checklist | Trạng thái |
| :--- | :---: |
| Trạng thái Registry hợp lệ không? | Có |
| Lệnh Stop có đi tới Actor không? | Có |
| Child Handle có bị mất không? | Không |
| Taskkill có chạy không? | Có (Nhưng fail ở mức OS) |
| Lỗi xuất phát do code hay OS? | Do logic code thứ tự sai |

**Đề xuất sửa lỗi (Khi được phép sửa code):**
Đảo ngược logic trên Windows. Không bao giờ gọi `child.kill().await` trước. Phải gọi `force_kill_process_tree(pid)` ngay lập tức để tiêu diệt toàn bộ từ ngọn đến gốc, sau đó mới gọi `child.kill()` (nếu cần dọn dẹp tokio handle) và `child.wait()`.
