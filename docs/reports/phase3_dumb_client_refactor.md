# Báo cáo Kiến trúc Phase 3: Frontend Dumb Client Refactor

## 1. Các file đã thay đổi

- `src/application/interfaces/services/IRuntimeService.ts`
  - Loại bỏ các method `forceStop` và `kill` vì chúng đã trở nên dư thừa.
- `src/application/services/ProcessLifecycleService.ts`
  - Biến thành một pure passthrough wrapper.
  - Loại bỏ hoàn toàn khối lệnh `setTimeout` 3 giây, `clearTimeout`, và logic `forceStop`.
- `src/application/services/TauriRuntimeService.ts`
  - Chuẩn hóa thành Gateway duy nhất (Single IPC Gateway).
  - Loại bỏ các thao tác sửa đổi State trực tiếp (`registry.add`, `registry.update`).
  - Loại bỏ các hàm phát sự kiện mô phỏng (`EventBus.publish`) trong `start` và `stop`.

## 2. Lifecycle logic đã loại bỏ

- **Bỏ Polling / Timeout**: Trình đếm ngược 3 giây ở Frontend đã bị xóa sạch. Frontend không còn tự định đoạt số phận của tiến trình.
- **Bỏ ForceStop Request**: UI không còn quyền gửi tín hiệu `forceStop` ép buộc, vì mọi hành động Stop đều được Rust Backend tự động quyết định mức độ kill (Graceful hay Force) dựa trên trạng thái OS.
- **Bỏ Premature State Update**: Việc tự ý cập nhật trạng thái `Starting` hay `Stopping` và emit sự kiện ngay khi click chuột đã bị loại bỏ. Promise trả về từ RuntimeService chỉ có ý nghĩa: *Đã bắn lệnh qua IPC thành công*.

## 3. Luồng Runtime mới

Với thiết kế "Dumb Client", luồng hoạt động hiện tại như sau:

1. UI (VD: Nút Run) gọi `ProcessLifecycleService.start()`
2. Tín hiệu truyền tới `TauriRuntimeService`, kích hoạt `invoke('start_process_cmd')`.
3. Promise `resolve()` ngay lập tức. Giao diện **chưa thay đổi ngay**.
4. Rust Backend thực thi lệnh spawn trên OS.
5. OS tạo Process thành công.
6. Rust Backend cập nhật Registry và emit sự kiện `ProcessStarted`.
7. `ipc/index.ts` ở Frontend lắng nghe được sự kiện, tiến hành cập nhật `RuntimeRegistry` ở Frontend và publish `EventType.ProcessStarted`.
8. React Store (Zustand/Context) nhận tín hiệu, kích hoạt UI re-render (đổi nút Run thành Stop, hiển thị PID, thời gian chạy).

Đối với tính năng **Restart**: Sử dụng kỹ thuật *Event Subscription* thay vì `setTimeout` mù. `restart()` sẽ gửi lệnh `stop`, sau đó ngầm đăng ký lắng nghe sự kiện chết của tiến trình (Stopped, Exited, Failed, Crashed). Khi và chỉ khi Backend xác nhận Process đã chết, hàm callback mới gỡ bỏ toàn bộ listener (chống memory leak) và tự động gọi lại `start()`.

## 4. Danh sách PASS/FAIL theo Tiêu chí Kiến trúc

| Tiêu chí | Trạng thái | Ghi chú |
| :--- | :---: | :--- |
| **Không thêm logic Stop mới ở Frontend** | PASS | Bỏ toàn bộ, không thêm mới. |
| **TauriRuntimeService là Gateway IPC duy nhất** | PASS | Mọi IPC call đều được route qua đây. |
| **Component không gọi IPC trực tiếp** | PASS | Tách bạch nhờ `ProcessLifecycleService`. |
| **Promise chỉ biểu thị Backend đã nhận lệnh** | PASS | Promise trả về ngay sau khi `invoke` thành công mà không chờ State đổi. |
| **UI chỉ cập nhật state qua Backend Event** | PASS | Xóa sạch `registry.update` trong `start`/`stop`. Mọi update nhường lại cho `ipc/index.ts`. |
| **Loại bỏ timeout, forceStop, retry** | PASS | Code đã được xóa hoàn toàn khỏi TS. |
| **Chống Memory Leak ở Event Listener** | PASS | Kỹ thuật tự hủy listener (`unsubStopped()`, v.v.) trong hàm `restart()` đảm bảo không bị rò rỉ. |
