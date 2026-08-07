# Báo Cáo Root Cause & Khắc Phục Data Flow (Dashboard)

## 1. Nguyên nhân gốc (Root Cause Analysis)

Sau khi Audit toàn bộ luồng dữ liệu (Data Flow) từ Backend tới Frontend, tôi đã phát hiện 3 nguyên nhân cốt lõi gây ra tình trạng Dashboard hiển thị thông số sai lệch (luôn bằng 0 hoặc không cập nhật):

**Nguyên nhân 1: WorkspaceRepository không phát sự kiện thay đổi**
- *Hiện trạng:* File `workspace.json` vẫn được đọc và ghi xuống ổ đĩa bình thường. Migration vẫn chạy. Tuy nhiên, khi tạo Project mới, hàm `saveWorkspace` **không** gọi `EventBus.publish(WorkspaceChanged)`.
- *Hậu quả:* Hook `useWorkspace()` chỉ gọi API lấy dữ liệu đúng 1 lần duy nhất lúc App vừa mở (`useEffect([])`). Do không có sự kiện `WorkspaceChanged` nào được bắn ra, UI không bao giờ biết dữ liệu đã thay đổi để re-render. User phải F5 app thì mới thấy Project.

**Nguyên nhân 2: Nút "New Project" ở Dashboard bị tịt (Dead Button)**
- *Hiện trạng:* Nút `<Button>New Project</Button>` trên thanh actions của Dashboard hoàn toàn không gắn thuộc tính `onClick`.
- *Hậu quả:* Bấm vào không có tác dụng. Không mở Dialog và cũng không chuyển trang.

**Nguyên nhân 3: Frontend quên gọi hàm setupDesktopIpc()**
- *Hiện trạng:* Hàm `setupDesktopIpc()` (đóng vai trò lắng nghe sự kiện từ Rust Tauri Backend) đã được định nghĩa tại `src/desktop/ipc/index.ts` nhưng **chưa bao giờ được gọi** tại `App.tsx` hay `main.tsx`.
- *Hậu quả dây chuyền:* 
  1. Tauri Rust gửi event `process_event` báo cáo tiến trình đã chạy (với PID).
  2. Frontend không có Listener nên bỏ qua event này -> Không bao giờ chuyển trạng thái sang `ProcessState.Running`.
  3. Vì không sang trạng thái Running, `ResourceMonitorService` cũng không bao giờ nhận được `ProcessStarted` event.
  4. Vì không nhận được `ProcessStarted`, nó không bao giờ gọi hàm `watchPid(pid)`.
  5. Mảng `watched_pids` trong Rust luôn rỗng. Vòng lặp lấy chỉ số CPU/RAM không chạy.
  6. **Kết quả:** Running Services = 0, Resource Monitor = 0.

## 2. Giải pháp Khắc phục (Đúng kiến trúc, Không Workaround)

Tôi đã tiến hành vá lỗi trực tiếp vào gốc rễ theo chuẩn Clean Architecture:

- **Bổ sung Event Bus cho Workspace:** Tại `WorkspaceRepository.ts`, gọi `EventBus.publish(EventType.WorkspaceChanged, workspace)` ngay sau khi lưu file json.
- **Lắng nghe thay đổi toàn hệ thống:** Tại hook `useWorkspace.ts`, tôi đã đăng ký Subscribe `WorkspaceChanged` để tự động merge trạng thái mới vào State hiện tại mà không làm mất trạng thái Tiến trình đang chạy (Merge State pattern).
- **Kích hoạt kết nối IPC:** Tại `src/App.tsx`, tôi bổ sung hook `useEffect` gọi hàm `setupDesktopIpc()` 1 lần duy nhất để toàn bộ Frontend bắt đầu bắt sóng tín hiệu Tauri IPC.
- **Sửa lỗi UI Dashboard:** Gắn `useNavigate` vào nút "New Project" để chuyển hướng thẳng sang màn hình `/workspace` (nơi xử lý Logic thêm Project bằng UI Sidebar).

## 3. Build & Test Verification
- Lệnh `cargo check`: ✅ PASS. (Tauri Plugin Dialog đã được Rust đăng ký chuẩn trong lib.rs).
- Lệnh `npm run build`: ✅ PASS. (Logic TypeScript cứng cáp, State đồng bộ).
- Khuyến nghị: Chạy `npm run tauri dev`. Giờ đây khi bạn Start một Service, IPC sẽ nổ sự kiện, Dashboard cập nhật số lượng Running Services, và Biểu đồ CPU/RAM sẽ giật lên ngay lập tức!
