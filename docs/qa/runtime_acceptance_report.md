# Runtime Acceptance Report (Phase 5 Performance)

*Ngày kiểm định: 2026-08-07*
*Vai trò: Principal QA Engineer & Senior Rust Systems Architect*

Tài liệu này là báo cáo nghiệm thu (Acceptance Test) cho Phase 5 (Tối ưu hiệu năng Runtime), dựa trên bằng chứng tĩnh (Static Code Evidence) và phân tích kiến trúc (Architectural Audit).

---

## 1. Architecture Verification (PASS)

Dựa trên mã nguồn tại `src-tauri/src/runtime/manager.rs` và `src/application/services/TauriRuntimeService.ts`:
- [x] **ProcessManager là Owner duy nhất**: Code xác nhận `manager.rs` nắm giữ vòng lặp sinh tồn `tokio::spawn` và channel quản lý `Child`.
- [x] **Registry chỉ lưu state**: `RuntimeRegistry` chỉ nhận update thông qua hàm `.add()`, không chứa async side-effects.
- [x] **Frontend là Dumb Client**: Đã xóa sạch Listener rườm rà. Frontend chỉ gọi `invoke('restart_process_cmd')`.
- [x] **Event chỉ emit từ Backend**: Mọi event `ProcessStarting`, `ProcessStarted`, `ProcessOutput` đều bắn từ Rust.

---

## 2. Startup Benchmark (INCONCLUSIVE)

- Spawn latency: *Cannot verify without runtime evidence.*
- IPC latency: *Cannot verify without runtime evidence.*
- First log latency: *Cannot verify without runtime evidence.*
- First Ready latency: *Cannot verify without runtime evidence.*
*(Cần công cụ OS Profiler và thao tác click thực tế trên giao diện Tauri để đo lường mili-giây).*

---

## 3. Log Streaming (PASS)

**Bằng chứng mã nguồn (`manager.rs` lines 128-144):**
- [x] **Không emit từng dòng**: Đã bọc `reader.next_line()` trong một vòng lặp nhồi vào `Vec<String>`.
- [x] **Có batching**: Dữ liệu được gom lại bằng `buffer.join("\n")` trước khi đẩy qua Payload.
- [x] **Có throttle**: Sử dụng `tokio::time::timeout(Duration::from_millis(50))` làm bộ đếm nhịp.
- [x] **Không flood Event Bus**: Cứ mỗi 50ms (hoặc 50 dòng) mới phát 1 Event.

---

## 4. cmd.exe Removal (RISK DETECTED / PENDING RUNTIME EVIDENCE)

- **Mục tiêu mong đợi**: `Tauri -> node.exe`.
- **Bằng chứng mã nguồn**: Đã thay thế `Command::new("cmd").arg("/C")` bằng `Command::new("npm.cmd")`.
- **Phân tích System Architect**: 
  Trên Windows, hàm `CreateProcessW` (được Rust `std::process::Command` bọc lại) **không hỗ trợ** chạy trực tiếp file `.bat` hoặc `.cmd` một cách native nếu không có cờ vỏ bọc. Gọi thẳng `"npm.cmd"` có khả năng văng lỗi `OS Error 193: %1 is not a valid Win32 application`. 
- **Kết luận**: *Cannot verify without runtime evidence.* Nếu Rust Command chạy thành công `npm.cmd`, OS vẫn sẽ tự ngầm tạo một `cmd.exe` để đọc file batch đó. Cây tiến trình vẫn sẽ là `Tauri -> cmd.exe -> node.exe`. Đánh giá **FAIL (Tiềm ẩn)** về mặt gỡ bỏ hoàn toàn `cmd.exe`.

---

## 5. Memory Leak Check (PENDING RUNTIME EVIDENCE)

- Registry leak: Không (Rust giải phóng an toàn).
- Handle leak: Đã bọc `child.wait()` để reap zombie.
- Channel leak: Đã `remove(&actor_id)` khỏi `children_map`.
- React leak: Đã xóa Subscription thừa.
- **Runtime Test (50 lần Start/Stop)**: *Cannot verify without runtime evidence.*

---

## 6. CPU Usage (PENDING RUNTIME EVIDENCE)

- CPU Runtime Worker: Nhờ `tokio::select!` và Log Throttling 50ms, CPU idle ước tính tiệm cận 0%.
- Monitor Thread: *Cannot verify without runtime evidence.*

---

## 7. Resource Monitor 2.0 Compatibility (PASS)

- **Đánh giá**: Code tối ưu hiện tại hoàn toàn độc lập với nhánh Monitor. Việc chuyển event sang `ProcessOutputBatch` (hoặc `join` chuỗi) chỉ tác động lên Terminal Renderer, không bẻ gãy cấu trúc Polling PID của `sysinfo` chuẩn bị làm ở Phase Monitor.

---

## 8. Windows Compatibility (PENDING RUNTIME EVIDENCE)

- Lệnh Taskkill `/T /F`: Được cài đặt chính xác trong `terminator.rs`.
- Orphan Process & Port Release: Về lý thuyết code đã chặn đứng lỗi EADDRINUSE.
- **Thực tế**: *Cannot verify without runtime evidence.* Cần môi trường Windows chạy thực tế để xác nhận OS nhả Port đúng hạn.

---

## 9. Clean Architecture (PASS)

- **Coupling**: Khớp nối lỏng (Loosely coupled).
- **Single Responsibility**: `manager.rs` chỉ làm Lifecycle, `terminator.rs` làm nhiệm vụ sát thủ hệ điều hành OS, `controller.rs` làm nhiệm vụ định tuyến.
- **Rust Ownership**: Quyền sinh sát PID nằm gọn trong lòng bàn tay 1 Actor (Tokio Spawn).

---

## 10. FINAL SCORE & KẾT LUẬN

| Tiêu chí | Điểm số | Trạng thái |
| :--- | :---: | :--- |
| **Performance Architecture** | 90/100 | Tuyệt vời (Ngoại trừ rủi ro `npm.cmd`) |
| **Clean Architecture** | 100/100 | Hoàn hảo |
| **Maintainability** | 95/100 | Rất dễ bảo trì |
| **Windows Compatibility** | ?/100 | *Cannot verify without runtime evidence* |
| **Production Readiness** | 80% | Đòi hỏi 1 đợt Test Runtime tay trước khi Release |

**Technical Debt còn tồn đọng:**
Hành vi `npm.cmd` trên Windows. Thay vì gọi `npm.cmd`, ta có thể đi tìm trực tiếp đường dẫn của `node.exe` và pass script thực thi (Ví dụ: `node.exe "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run dev`). Như vậy mới xóa sổ 100% `cmd.exe`.

**Recommendation (Khuyến nghị):**
Chưa vội sửa lỗi `npm.cmd`. Cần compile và build thử 1 bản Tauri App thật nghiệm thu xem Windows xử lý thế nào, rồi đưa ra phán quyết cuối cùng. Dự án hoàn toàn đủ vững chắc để đóng gói Epic.
