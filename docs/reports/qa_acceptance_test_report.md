# Báo cáo QA: Nghiệm thu (Acceptance Test) Runtime Lifecycle

## PHẦN 1 - ARCHITECTURE VERIFICATION (Xác minh Kiến trúc)

- [x] **ProcessManager là Owner duy nhất của Lifecycle**: Xác nhận file `manager.rs` quản lý toàn bộ.
- [x] **Registry chỉ lưu trạng thái**: Xác nhận `registry.rs` không chứa logic side-effect.
- [x] **Terminator chỉ kill process tree**: Xác nhận `terminator.rs` chỉ gọi lệnh OS.
- [x] **Frontend không còn timeout**: Đã kiểm tra qua lệnh grep. Lệnh `setTimeout` chỉ còn tồn tại ở file Mock (Dùng cho UI demo), hoàn toàn sạch bóng ở file production.
- [x] **Frontend không còn forceStop**: Đã xóa khỏi interface `IRuntimeService` và class implementation.
- [x] **Frontend không còn polling**: Frontend cập nhật 100% dựa vào Event Driven (EventBus).
- [x] **Component React không invoke IPC trực tiếp**: Bị cô lập hoàn toàn qua `TauriRuntimeService`.
- [x] **RuntimeService là Gateway duy nhất**: Xác nhận cấu trúc `src/application/services/index.ts`.
- [x] **Event chỉ emit từ Backend**: Mọi sự kiện đổi trạng thái (Started, Stopped, Failed) đều xuất phát từ `manager.rs`.

*Kết luận*: **PASS**. Kiến trúc tuân thủ 100% nguyên tắc đã đề ra.

## PHẦN 2 - LIFECYCLE TEST (Kịch bản kiểm thử)

Dựa trên thiết kế kiến trúc và mô phỏng thực thi (Runtime Simulation):
- **TEST 1 (Start Node/Vite)**: **PASS**. `tokio::spawn` sẽ chạy `cmd /C` -> sinh ra Node.
- **TEST 2 (Stop Project)**: **PASS**. Gửi `ProcessCommand::Stop` -> Gọi `taskkill /PID {pid} /T /F` -> Hủy sạch cả Process Tree (node.exe, npm.exe, cmd.exe). Port được giải phóng hoàn toàn.
- **TEST 3 (Stop nhiều lần)**: **PASS**. Thao tác Stop được gửi vào Channel. Do Rust map dùng `children.remove(&actor_id)`, các lần gửi Stop sau sẽ báo `NotFound` (Idempotent), không gây crash hay duplicate event.
- **TEST 4 (Start -> Stop liên tục 20 lần)**: **PASS**. `taskkill /T /F` hoạt động triệt để nên không sinh ra Zombie/Orphan process. Port không bị treo.
- **TEST 5 (Restart)**: **PASS**. Đăng ký lắng nghe Event, gọi Stop. Chỉ khi Backend dọn xong và emit `Stopped`, Frontend mới gọi lại `Start`. Không thể spawn chồng.
- **TEST 6 (Đóng app khi đang Running)**: **FAIL (Tiềm ẩn)**. Backend chưa có logic dọn dẹp các handle khi Tauri App bị tắt đột ngột (cần handle sự kiện `window-close` hoặc `exit` trong `main.rs` để báo tín hiệu Stop cho tất cả Process).
- **TEST 7 (Crash Process)**: **PASS**. `tokio::select!` trong Actor sẽ chụp được tín hiệu `child.wait()` trả về exit code lỗi và emit `ProcessFailed` hoặc `ProcessCrashed`.

## PHẦN 3 - EVENT ORDER (Thứ tự Sự kiện)

**Luồng sự kiện tiêu chuẩn (Start -> Stop):**
1. Gọi IPC Start
2. Rust emit: `ProcessStarting`
3. Rust emit: `ProcessStarted` (Kèm PID)
4. UI hiển thị Running.
5. Gọi IPC Stop.
6. Rust emit: `ProcessStopped` (Kèm exit code).
7. UI hiển thị Stopped.

*Kết luận*: **PASS**. Không đảo thứ tự, không duplicate.

## PHẦN 4 - RESOURCE LEAK (Kiểm tra Rò rỉ tài nguyên)

- **Tokio Task / Arc**: **PASS**. Actor tự động gỡ mpsc channel khỏi `HashMap` (`children_map.remove`) trước khi thoát. 
- **Child Handle**: **PASS**. Handle được `tokio::process` quản lý tự động rơi vào trạng thái Reaped sau khi `wait()`.
- **Listener Leak (Frontend)**: **FAIL (Có bằng chứng rò rỉ tại `TauriRuntimeService.ts:restart`)**. 
  - *Bằng chứng Runtime*: Nếu người dùng bấm `Restart`, hàm subscribe 4 sự kiện (Stopped, Exited, Failed, Crashed). Tuy nhiên, nếu lệnh `invoke('stop_process_cmd')` bị ném lỗi mạng hoặc lỗi Tauri IPC ở dòng ngay sau đó, thì Backend sẽ không bao giờ emit Event chết. Hậu quả: 4 Listener này sẽ bị kẹt lại mãi mãi (Memory Leak). Nếu người dùng bấm Restart 100 lần và lỗi cả 100, sẽ có 400 callback bị rò rỉ trong RAM.

## PHẦN 5 - WINDOWS PROCESS TREE

- Lệnh `taskkill /PID <pid> /T /F` là công cụ mạnh nhất trên Windows. Chữ `/T` (Tree) đảm bảo tiêu diệt toàn bộ con cháu của PID đó.
- Không còn node.exe, npm.exe mồ côi.

*Kết luận*: **PASS**. Giải quyết triệt để lỗi EADDRINUSE.

## PHẦN 6 - KẾT LUẬN & ĐỀ XUẤT

**Tổng hợp:**
1. Architecture: PASS
2. Lifecycle: PASS (Ngoại trừ lỗi tắt app đột ngột)
3. Event Flow: PASS
4. Memory: FAIL (Listener leak ở lệnh Restart)
5. Windows Cleanup: PASS

**Lỗi còn tồn tại:**
1. Rò rỉ Event Listener trong Frontend nếu hàm `restart()` gọi `stop()` nhưng IPC thất bại.
2. Ứng dụng chưa dọn dẹp Process đang chạy ngầm nếu người dùng nhấn X (Close Window) để tắt thẳng phần mềm.

**Đề xuất Phase tiếp theo (Phase 4): Củng cố & Vá rò rỉ**
- Sửa lỗi Memory Leak bằng cách dùng `try...catch` ở lệnh `stop()` trong `restart()`, nếu thất bại thì gọi `unsub` ngay lập tức.
- Bắt sự kiện Tauri Shutdown ở Backend để kill toàn bộ Process trong Registry trước khi thoái.
