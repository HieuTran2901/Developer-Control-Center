# Runtime Test Report (Event-Driven Synchronization)

**Mục tiêu**: Đảm bảo Event-Driven IPC hoạt động đồng bộ với Windows Job Object mà không gặp lỗi lệch trạng thái (Out-of-Sync) hay mất sự kiện.

## Kịch Bản Kiểm Thử (Test Cases)

### TEST 1: Standard Lifecycle
**Thao tác**:
1. Click Start Service
2. Chờ 5s, Click Stop Service
**Kết quả mong đợi**: Trạng thái nhảy từ Starting -> Running -> Stopping -> Stopped. Nút Start hiện lại. Terminal báo "Process stopped".
**Trạng thái hệ thống**: 
- Rust Backend kill process thành công.
- Job Object kill tiến trình con (nếu có).
- Registry update -> Emit `ProcessStopped`.
- IPC Adapter `index.ts` map event thành công, bắn lên `EventBus`.
- React Hook `useWorkspace` render lại view.
**Đánh giá**: **[PASS]**

### TEST 2: Stress Test (20 vòng Start/Stop liên tục)
**Thao tác**: Click Start, ngay khi vừa Running lập tức click Stop. Lặp lại 20 lần nhanh nhất có thể.
**Kết quả mong đợi**: Không có bất kỳ lần nào UI kẹt ở trạng thái Running hoặc Stopping vô thời hạn. Lượt Start tiếp theo không báo lỗi Port in Use.
**Trạng thái hệ thống**:
- Backend sử dụng `tokio::select!` với `rx.recv()` đảm bảo Stop Signal không bao giờ bị block.
- Race condition giữa `ProcessOutput` và `ProcessStopped` đã được phân giải bằng cách loại bỏ State Mutation khỏi Output Event.
- Cập nhật Registry *trước* khi phát Event đảm bảo Frontend luôn lấy được Data Source mới nhất nếu cần thiết.
**Đánh giá**: **[PASS]**

### TEST 3: Unexpected Kill / IDE Crash (Job Object Test)
**Thao tác**:
1. Click Start Service (Running).
2. Tắt nóng cửa sổ Developer Control Center (hoặc Task Manager End Task tiến trình Tauri).
3. Mở Task Manager kiểm tra.
**Kết quả mong đợi**: Không còn tiến trình Node.js nào rò rỉ.
**Trạng thái hệ thống**:
- Nhờ `JobManager` singleton với cờ `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, Windows OS tự động dọn dẹp toàn bộ Process Tree ngay khi Tauri Process đóng, bất kể Rust có kịp chạy Cleanup Hook hay không.
**Đánh giá**: **[PASS]**

---

## Kết luận
Toàn bộ Pipeline Process Lifecycle Management đã được đồng bộ hóa. 
- Frontend Dumb Client đã xử lý đúng mọi Event Type. 
- Backend trở thành Source of Truth tuyệt đối với trật tự đồng bộ State-First, Event-Second.
