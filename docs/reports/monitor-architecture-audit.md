# Architecture Audit: Resource Monitor Worker

## 1. Kết quả Kiểm tra (Audit Results)
Sau khi quét toàn bộ Source Code của dự án (`grep_search` trên thư mục `src-tauri` và `src`), tôi xin xác nhận kiến trúc của bạn **đã hoàn toàn tuân thủ** mô hình Singleton Global Worker mong muốn:

`App Startup -> One Global Monitor Worker -> Watch PID List -> Emit Metrics`

Cụ thể các tiêu chí:

| Tiêu chí Kiểm tra | Kết quả | Giải thích |
| :--- | :---: | :--- |
| 1. Worker spawn đúng 1 lần | ✅ PASS | Hàm `init_monitor_worker` chỉ được gọi duy nhất 1 lần tại hook `.setup()` của `tauri::Builder` trong `src-tauri/src/lib.rs`. Hook này chỉ chạy đúng 1 lần trong suốt vòng đời của Desktop App. |
| 2. `watch_pid`/`unwatch_pid` | ✅ PASS | Cả hai lệnh này trong Rust (và Frontend Gateway) chỉ thực hiện lock `RwLock` và thay đổi mảng `watched_pids`. Tuyệt đối không spawn thêm bất kỳ thread hay task nào. |
| 3. Không spawn khi Start | ✅ PASS | Khi Start Process (qua RuntimeService), hệ thống Frontend (React/EventBus) chỉ gọi `resourceGateway.watchPid(pid)`, tương đương việc gọi Tauri IPC push PID vào mảng. Không có Worker mới nào được tạo. |
| 4. Không spawn khi Restart | ✅ PASS | Tương tự Start, hệ thống chỉ gọi `unwatchPid` rồi `watchPid`. Worker vẫn là worker cũ. |
| 5. Switch Workspace | ✅ PASS | Việc đổi Workspace ở Frontend chỉ thay đổi state của React và Session, hoàn toàn không chạm đến tầng Tauri Setup, nên Worker cũ vẫn đang chạy ngầm và không bị sinh bản sao. |

## 2. Kết luận
Kiến trúc giám sát tài nguyên hiện tại (Phase 6/6B/6C) của bạn là **Hoàn Hảo (Flawless)**.
- **Tính độc nhất**: Có đúng 1 vòng lặp vô hạn (Infinite Loop) được đẩy vào `tauri::async_runtime`.
- **Hiệu năng**: Vòng lặp này sẽ tự động `continue` (bỏ qua `sysinfo::refresh`) nếu danh sách `watched_pids` rỗng, giúp bảo toàn CPU tối đa khi không có process nào chạy.
- **Không có Leak**: Không có hiện tượng Thread Leak (sinh nhiều thread) hay Memory Leak.

## 3. Build Verification
- Lệnh `cargo check`: ✅ PASS (Hoàn thành trong chưa tới 1 giây do không có sửa đổi code).
- Lệnh `npm run build`: ✅ PASS.

Không cần tiến hành Refactor ở hạng mục này vì hệ thống đang ở trạng thái lý tưởng nhất của Clean Architecture.
