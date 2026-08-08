# Runtime Readiness Lifecycle 2.0 (Phase 7)

## 1. Current Architecture
- **ProcessState** trong Rust ( `model.rs`) và Frontend (`ProcessState.ts`) chia sẻ chung danh sách: `Idle`, `Starting`, `Running`, `Stopping`, `Stopped`, `Restarting`, `Failed`, `Exited`, `Crashed`.
- Sự kiện `ProcessStarted` được kích hoạt ngay lập tức khi Rust `Command::spawn()` trả về `Ok(child)` chứa PID.
- IPC Adapter (`ipc/index.ts`) map `ProcessStarted` thành `ProcessState.Running`.
- UI trong `Dashboard.tsx` và `WorkspacePage.tsx` dựa vào `ProcessState.Running` để kích hoạt nút Stop.

## 2. Current Problem
Việc `Command::spawn()` thành công chỉ có nghĩa OS đã cấp phát PID. Tuy nhiên, framework/ứng dụng bên trong (Spring Boot, Vite, Node) thường mất từ vài giây đến vài phút để resolve dependency, compile, start server và bind port. Do đó, nút Stop hiện lên lập tức trong khi ứng dụng chưa thực sự sẵn sàng, gây sai lệch về "Semantic Lifecycle". 

## 3. Root Cause
Kiến trúc hiện tại đã gộp chung (coupled) **OS Process Lifecycle** và **Application Readiness Lifecycle** thành một khái niệm duy nhất là `ProcessState`. Điều này vi phạm nguyên tắc Single Responsibility vì OS backend không thể biết khi nào application logic (port binding, DB connection) hoàn tất.

## 4. State Machine (Đề xuất)
Đề xuất sử dụng **Phương án C**: Tách biệt `ProcessState` (OS level) và `ReadinessState` (Application level) thay vì nhồi nhét tất cả vào `ProcessState`.

**ProcessState** (OS level):
- `Idle`: Chưa chạy.
- `Starting`: Đang gọi Windows API để spawn.
- `Running`: OS đã cấp PID và process đang giữ handle.
- `Stopping`: Đang gửi lệnh SIGKILL/taskkill.
- `Stopped`: Process đã kết thúc bình thường do Stop.
- `Failed`: Không thể spawn (vd: sai executable).
- `Crashed`: Process tự tắt đột ngột (ExitCode != 0).
- `Exited`: Process tự tắt (ExitCode = 0) dù không ai gọi Stop.

**ReadinessState** (App level):
- `Unknown`: Không áp dụng hoặc process chưa chạy.
- `Waiting`: Đang chờ signal/port.
- `Ready`: Application đã khởi động thành công.

## 5. Process Lifecycle vs Application Readiness
- Khi `spawn()` thành công: `ProcessState = Running`, `ReadinessState = Waiting`.
- Lúc này Backend tiếp tục stream stdout/stderr vào bộ buffer.
- `StartupReadinessChecker` sẽ phân tích buffer. Khi bắt được tín hiệu -> `ReadinessState = Ready`.

## 6. Readiness Detection Architecture
Developer Control Center phục vụ nhiều framework, do đó không thể hard-code HTTP Health check. 
Phương pháp tối ưu: **Log Pattern Detection** kết hợp **Timeout Fallback**.
- **Log Pattern**: Quét stdout/stderr theo Regex (vd: `ready in`, `Started .* in .* seconds`). Rất linh hoạt và non-intrusive.
- **Port Binding Detection**: (Tương lai) Nếu Runtime Profile định nghĩa port.
- **Timeout Fallback**: Nếu profile không cấu hình Readiness, mặc định tự động chuyển sang `Ready` sau 3 giây (đảm bảo backward compatibility cho các script đơn giản).

## 7. Backend Design
Tạo thêm abstraction `ReadinessMonitor` nằm song song với `LogReader`.
Khi Process được spawn:
1. `ProcessManager` cập nhật Registry `status = Running`, `readiness = Waiting`.
2. Truyền Regex pattern từ Profile xuống.
3. Trong loop đọc `stdout`, nếu bắt được Regex, trigger IPC event `ReadinessChanged(READY)` và ngừng quét.
4. Nếu quá timeout, tự động trigger `ReadinessChanged(READY)`.

## 8. Registry Design
Mở rộng `ProcessModel` (`model.rs` & `ProcessModel.ts`):
```rust
pub enum ReadinessState { Unknown, Waiting, Ready }

pub struct ProcessModel {
    ...
    pub status: ProcessState, // Vẫn giữ nguyên
    pub readiness: ReadinessState, // Field mới
}
```

## 9. IPC Event Contract
Luồng chuẩn xác:
1. `ProcessStarting`
2. `ProcessStarted` (Mang theo `status: Running, readiness: Waiting`)
3. `ProcessReadinessChanged` (Mang theo `readiness: Ready`)
4. `ProcessStopped` (Reset readiness về `Unknown`)

Tất cả event phải được cập nhật vào `Registry` trên Backend trước khi emit để đảm bảo Frontend làm Dumb Client. Frontend `ipc/index.ts` chỉ đơn giản sync Registry.

## 10. Frontend State Mapping
Frontend không tự tính toán state mà đơn giản dùng:
```typescript
const isRunningAndReady = profile.status === ProcessState.Running && profile.readiness === ReadinessState.Ready;
const isWaiting = profile.status === ProcessState.Running && profile.readiness === ReadinessState.Waiting;
```

## 11. UI Behavior
- `IDLE`: Nút Start màu xanh (Enabled). Nút Stop ẩn/disabled.
- `WAITING`: Nút Start bị vô hiệu. Nút Stop thay đổi thành **Force Stop** (vẫn enabled để chống deadlock nhưng có UI cảnh báo). Label trạng thái là "Waiting..." hoặc "Starting...". Cờ loading spin được bật.
- `READY`: Nút Start vô hiệu. Nút Stop hoạt động bình thường. Label là "Running".
- Các trạng thái `FAILED/CRASHED/EXITED`: Trở về như IDLE.

## 12. Failure Handling
- **Process crash trong lúc waiting**: `ProcessCrashed` được emit, ghi đè state, Frontend tự động disable Stop và enable Start.
- **Log stream không có readiness signal**: Sau 1 khoảng Timeout (ví dụ 10s hoặc do profile cấu hình), ép `Readiness = Ready` để không bị kẹt mãi ở Waiting.
- **Internal Shutdown / Stop during Waiting**: Nút Force Stop vẫn gọi API Stop bình thường, Backend sẽ kill Process và emit `ProcessStopped`.

## 13. Timeout Strategy
Mặc định nếu RuntimeProfile không có trường `readinessRegex`, hệ thống sử dụng Fallback Timeout = 3000ms. Sau 3s, tự trigger `Ready`.
Nếu có `readinessRegex`, Timeout = 30000ms (30s) làm safety net.

## 14. Restart Interaction
Restart = Stop -> Đợi Stop -> Start -> Waiting -> Ready. Không thay đổi nguyên tắc, chỉ là UI sẽ đi qua phase Waiting một lần nữa.

## 15. Windows Job Object Interaction
Job Object hoàn toàn trong suốt với Application Readiness. Việc bind PID vào Job Object vẫn thực hiện ngay sau khi `spawn()`. Nút Stop dù bấm ở giai đoạn nào vẫn trigger Job Object termination một cách an toàn và triệt để.

## 16. Backward Compatibility
Các Event Frontend cũ như `ProcessStarted` vẫn mang `status = Running` nhưng UI component cần được cập nhật để đọc thêm field `readiness`. API cũ không bị gãy. 

## 17. Migration Plan
1. Update `ProcessModel` + `ProcessState.ts`.
2. Update Rust Backend (thêm Timeout/Regex logic vào loop đọc log hoặc tokio thread riêng).
3. Update `ipc/index.ts` trên Frontend.
4. Update UI Components (Dashboard, ResourcePanel).

## 18. Testing Strategy
1. **No-pattern Profile**: Mặc định timeout 3s sẽ chuyển thành Ready.
2. **Vite Pattern**: Set `readinessRegex: "ready in"` -> UI phải kẹt ở Waiting cho đến khi Vite compile xong và in ra dòng đó.
3. **Fail-fast Pattern**: Gõ sai lệnh (vd `vitexxx`), ProcessFailed phải kích hoạt ngay mà không kẹt Waiting.
4. **Crash-while-waiting**: Script chạy 2s rồi `process.exit(1)`, phải chuyển thành Crashed.

## 19. Risks
- Performance của Regex quét từng dòng log. (Giải pháp: Chỉ bật Regex cho đến khi Ready, sau đó disable Regex flag để giải phóng CPU).
- Lỗi cập nhật Registry không đồng bộ với Event. (Giải pháp: Luôn Registry.write() trước Emitter.emit()).

## 20. Acceptance Criteria
1. Nút Start bị disable và nút Stop hiển thị Loading trong quá trình framework đang boot.
2. Cờ `ReadinessState` được cập nhật thông qua backend event, không dùng `setTimeout` giả trên Frontend.
3. Mọi tính năng khác như Restart, Force Stop, Kill Tree (Windows Job) không bị ảnh hưởng.
4. Source code được tách bạch rõ ràng giữa OS Process Manager và Readiness Monitor.
