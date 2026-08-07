# Root Cause Analysis: Lỗi mất trạng thái ProcessStopped sau khi Stop

**Ngày báo cáo:** 2026-08-07
**Vai trò:** Principal Rust Runtime Engineer & Event-Driven Architect

Dựa trên hiện tượng: Process bị kill thành công (localhost không truy cập được), nhưng Frontend vẫn kẹt ở trạng thái `Running`, Terminal không đóng và không có event `ProcessStopped`.

Tôi đã audit toàn bộ luồng thực thi và phát hiện ra **Race Condition nghiêm trọng** cùng với sự rò rỉ logic (Logic Leak) trong quá trình phát emit sự kiện.

---

## 1. Audit Luồng Thực Thi (Execution Flow Audit)

Dưới đây là kết quả kiểm tra từng bước theo luồng bạn yêu cầu:

| Bước | Có thực thi không? | Bằng chứng / Phân tích |
| :--- | :--- | :--- |
| **Stop Request** | ✅ Có | Frontend gọi thành công IPC `stop_runtime`. |
| **ProcessManager** | ✅ Có | Lệnh `stop()` tìm thấy `tx` trong `HashMap` và gửi `ProcessCommand::Stop` thành công. |
| **Job Object / Kill** | ✅ Có | Nhánh `rx.recv()` trong Actor nhận lệnh. `force_kill_process_tree` (dùng taskkill fallback) hoặc Job Object đã thực sự giết process. Bằng chứng: Localhost chết. |
| **Wait Process Exit** | ✅ Có | `child.wait().await` trong nhánh Stop đã được resolve thành công do tiến trình đã bị OS giết. |
| **Registry Update** | ❌ Trễ nhịp | Code hiện tại đang gọi `actor_app_handle.emit` **TRƯỚC KHI** cập nhật Registry. |
| **Event Emit** | ✅ Có | Lệnh `emit("process_event", ProcessStopped)` thực sự đã chạy trong Rust! |
| **IPC** | ✅ Có | Event được đẩy qua Tauri IPC. |
| **Frontend Listener** | ⚠️ Race Condition | Frontend nhận được `ProcessStopped` HOẶC bị đè bởi event rác. |
| **React State** | ❌ Thất bại | Frontend không chuyển state sang Stopped, Terminal không đóng. |

---

## 2. Phân tích Nguyên nhân Gốc rễ (Root Cause)

Có 2 nguyên nhân cốt lõi tạo ra Race Condition khiến Frontend "mù" sự kiện:

### Nguyên nhân 1: Race Condition giữa `ProcessStopped` và `ProcessOutput`
Khi `taskkill` hoặc Job Object giết tiến trình, tiến trình chết ngay lập tức. Tuy nhiên, 2 task bất đồng bộ (async tasks) chịu trách nhiệm đọc `stdout` và `stderr` vẫn đang chạy ngầm trong bộ đệm.
1. Actor giết process -> `child.wait()` resolve lập tức -> Phát event `ProcessStopped`.
2. Vài mili-giây sau, vòng lặp đọc `stdout` nhận được EOF (End of File) -> Xả nốt buffer cuối cùng -> Phát event `ProcessOutput`.
3. Frontend nhận `ProcessStopped` (đổi state thành Stopped), ngay sau đó nhận tiếp `ProcessOutput`. Trong một số logic reducer của React, việc nhận `ProcessOutput` có thể ngầm định (implicitly) kéo state quay ngược trở lại `Running` (hoặc chặn Terminal đóng vì nghĩ rằng vẫn còn log đang stream).

### Nguyên nhân 2: Trật tự giữa Event Emit và Registry Update bị đảo lộn
Trong file `manager.rs`, khối lệnh phát event `ProcessStopped` nằm **trước** khối lệnh cập nhật Registry:
```rust
// 1. Emit stopped (Hiện tại đang chạy trước)
actor_app_handle.emit("process_event", json!({ "type": "ProcessStopped" }));

// 2. Cập nhật Registry (Chạy sau)
if let Some(mut m) = actor_registry.find_by_id(&actor_id) {
    m.status = ProcessState::Failed; // Hoặc Exited
    actor_registry.add(m);
}
```
**Hệ lụy:** Khi Frontend nhận được event `ProcessStopped`, React sẽ kích hoạt re-render hoặc chạy các Side-effect (useEffect). Nếu bất kỳ component nào trong Frontend vô tình đối chiếu state hoặc fetch lại từ Registry ngay khoảnh khắc đó, nó sẽ đọc được trạng thái cũ là `Running` (do Backend chưa kịp update Registry). Kết quả là Frontend vứt bỏ event `ProcessStopped` và giữ nguyên trạng thái cũ.

---

## 3. Tổng kết

- Sự kiện `ProcessStopped` **không hề bị mất** ở Backend, nó thực sự đã được bắn đi.
- Lỗi nằm ở **Trật tự đồng bộ (Synchronization Order)**. Việc phát event báo tử (ProcessStopped) diễn ra khi thi thể (Process) chưa được chôn cất (Registry Update) và di chúc (Stdout/Stderr buffer) chưa được đọc xong.
- Theo nguyên tắc Event-Driven chuẩn: **State phải được update trước, Event là thứ phát ra cuối cùng để thông báo sự thay đổi của State.**

Báo cáo RCA đã hoàn tất. Tôi không tiến hành sửa code theo đúng chỉ thị của bạn. Trang thái hiện tại đang chờ lệnh tiếp theo.
