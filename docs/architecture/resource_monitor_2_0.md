# Architecture Design: Resource Monitor 2.0

Tài liệu này phác thảo kiến trúc cho hệ thống **Resource Monitor 2.0**, chuyển đổi từ một công cụ xem CPU/RAM đơn giản thành một hệ thống giám sát chuyên nghiệp cấp độ IDE (tương tự VSCode Process Explorer, JetBrains Runtime Monitor).

---

## Bước 1. Audit Kiến trúc Hiện Tại (Technical Debt & Rủi ro)

**Hiện trạng (Dữ liệu từ `monitor/mod.rs`):**
- **Luồng dữ liệu**: `sysinfo` quét PID -> Emit thẳng `process_metrics` mỗi 1 giây -> Frontend nhận và render.
- **Technical Debt & Rủi ro**:
  1. **Thiếu Process Tree**: Chỉ watch đúng Root PID. Thực tế Node.js/Vite thường sinh ra hàng loạt process con (esbuild, npm, worker). Do đó thông số RAM hiện tại là **sai lệch (thiếu hụt)**.
  2. **Vấn đề Hiệu năng (Fixed Interval)**: Vòng lặp `tokio::sleep(1s)` chạy vô thời hạn, kể cả khi UI bị thu nhỏ hoặc đang chạy hàng ngàn process, làm hao tổn CPU của chính ứng dụng.
  3. **Event Spam**: Gửi sự kiện liên tục qua IPC mà không có cơ chế Batch/Delta, gây tắc nghẽn Event Bus.
  4. **Không có Historical Data**: Data cũ bị ném bỏ, không thể vẽ biểu đồ (Chart).

---

## Bước 2. Thiết kế Resource Domain

Tầng Domain sẽ chia thành các Entity độc lập:

1. **`ProcessMetrics` (Thời gian thực)**:
   - Đại diện cho snapshot 1 thời điểm.
   - Trách nhiệm: Lưu CPU (%), RAM (bytes), Disk I/O (Read/Write), Network (RX/TX), Thread Count.
2. **`ProcessStatistics` (Thống kê tích lũy)**:
   - Trách nhiệm: Tính toán Peak RAM, Peak CPU, Moving Average (Trung bình trượt), Uptime.
3. **`HistoricalMetrics` (Lịch sử)**:
   - Trách nhiệm: Một Circular Buffer (Ví dụ 60 phần tử cho 60 giây) lưu trữ `ProcessMetrics` theo dòng thời gian để phục vụ vẽ Sparkline/Chart.
4. **`ProcessNode` (Cây tiến trình)**:
   - Trách nhiệm: Mapping quan hệ Cha - Con (Parent PID -> Children PIDs) để tính tổng hợp (Aggregated Metrics).

---

## Bước 3. Data Flow (Luồng dữ liệu)

Luồng dữ liệu một chiều (Unidirectional) tuân thủ Event-Driven:

```text
[Hệ điều hành Windows (OS)]
       ↓ (WMI / Procfs / sysinfo)
[Metrics Collector Worker (Rust)] --> Đo bóc tách cả Process Tree
       ↓
[Metrics Registry (Rust)] --> Tính toán Rolling Avg, Peak, lưu vào Circular Buffer
       ↓
[IPC Aggregator (Rust)] --> Đóng gói Batch / Delta
       ↓ (Tauri Event: `MetricsBatchUpdated`)
[Frontend Monitor Store (Zustand / TypedArray)]
       ↓
[React UI (Dashboard / Charts / Sparklines)]
```

---

## Bước 4. Polling Strategy (Chiến lược Cập nhật)

- **Adaptive Interval (Tần suất thích ứng)**:
  - Cửa sổ đang Active: 1000ms.
  - Cửa sổ bị thu nhỏ (Minimized/Blur): 5000ms hoặc **Paused** hoàn toàn.
  - Chế độ tiết kiệm Pin (Battery Saver): 5000ms.
- **Tree Resolution (Quét cây)**: Quét cấu trúc Process Cha-Con rất tốn kém. Sẽ chỉ cập nhật danh sách Tree (tìm con mới sinh ra) mỗi 5 giây, nhưng cập nhật CPU/RAM của những con đã biết mỗi 1 giây.
- **High CPU Protection**: Backend tự đo thời gian thực thi của chính luồng `sysinfo`. Nếu mất quá 100ms để quét, tự động tăng thời gian tick lên 2000ms (Auto-Throttle).

---

## Bước 5. Event System (Hệ thống Sự kiện IPC)

Backend chỉ phát các sự kiện sau:

- `MetricsBatchUpdated`: Chứa mảng dữ liệu cực mỏng (Delta: PID, CPU, RAM của tick mới nhất).
- `ProcessSpikeAlert`: Phát khi Backend phát hiện CPU tăng bất thường (>85%) hoặc RAM phình to. Phục vụ hiển thị cảnh báo đỏ trên UI.
- `HighResourceWarning`: Báo động phần cứng máy tính (VD: Hệ thống thực sự cạn RAM).

---

## Bước 6. Thiết kế Registry

**Quyết định Kiến trúc:** TÁCH RỜI `RuntimeRegistry` (Chứa ProcessModel, State vòng đời) và `MetricsRegistry` (Chứa Memory, CPU).
- **Lý do**: Tần suất truy cập hoàn toàn lệch pha. Lifecycle thao tác thưa thớt (lâu lâu mới Stop/Start), nhưng Metrics cập nhật hàng giây. Gộp chung sẽ gây **Deadlock** do tranh chấp `RwLock` hoặc `Mutex`.
- **Lưu trữ Metrics**: `MetricsRegistry` sẽ lưu trữ **Current Metrics, Peak, và Rolling Average (Moving Average)**. Không lưu toàn bộ lịch sử (History) dài hạn ở Backend để tránh ăn RAM Rust, chỉ giữ khoảng 60 điểm (1 phút) và đẩy Delta xuống Frontend.

---

## Bước 7. Thiết kế IPC

**Quyết định IPC:** Dùng **Diff IPC (Delta Update)** kết hợp **Batching**.
- Thay vì mỗi giây gửi toàn bộ mảng lớn JSON chứa 60 điểm cho mỗi Process, Backend gom tất cả các Process đang chạy, lập thành một payload cực nhỏ: `[{ pid: 1, cpu: 12.5, ram: 10245 }, { pid: 2, ... }]`.
- Frontend nhận Delta này và tự đẩy (push) vào Circular Buffer (Ví dụ mảng `Float32Array`) bên trong Zustand Store. Rất tiết kiệm CPU và Bandwidth IPC.

---

## Bước 8. Thiết kế Frontend

Giao diện sẽ phân tầng:
1. **Global Dashboard**: Thanh StatusBar hiển thị CPU/RAM tổng của toàn bộ Developer Control Center.
2. **Process List (như VSCode)**: Bảng chi tiết liệt kê các Service đang chạy kèm thanh Progress mini.
3. **Mini Sparkline Charts**: Tích hợp ngay trên Project Card (VD: Một đường đồ thị nhỏ, xanh/đỏ chớp tắt).
4. **Detail Panel / Monitor View**: Bấm vào để xem biểu đồ đường (Line Chart) chi tiết lịch sử tài nguyên, danh sách các tiến trình con (như Vite worker) và có nút `Kill` cho từng nhánh.

---

## Bước 9. Thiết kế Hiệu năng (Performance)

- **Scale to 100+ Process**: 
  - Backend: Chặn `sysinfo` quét toàn bộ máy tính. Bắt buộc dùng `sys.refresh_processes_specifics` kèm mảng PID chính xác.
  - Frontend Render Cost: Sử dụng `Canvas` API (hoặc thư viện uPlot/Chart.js Canvas) thay vì dùng `div/svg` cho các biểu đồ. Với 100 project x 60 điểm dữ liệu = 6000 DOM nodes sẽ làm treo UI React nếu dùng SVG. TypedArray `Float32Array` trong JavaScript sẽ loại bỏ tình trạng kẹt Garbage Collector.

---

## Bước 10. Roadmap Triển khai

Kế hoạch này sẽ được chia nhỏ thành 5 Phase độc lập:

**Phase 1: Backend Tree Collector**
- Mục tiêu: Gom đủ Process con cháu. Tách `MetricsRegistry` khỏi `RuntimeRegistry`.
- Tiêu chí: Lệnh test trả về tổng RAM của node + esbuild chuẩn xác.

**Phase 2: Adaptive Polling & IPC Delta**
- Mục tiêu: Chuyển đổi Worker thành Adaptive (tự giảm tốc khi ẩn app). Gửi IPC kiểu Delta Batch.
- Tiêu chí: Mở Task Manager, thấy app tốn < 0.5% CPU khi chạy ngầm.

**Phase 3: Event Alert System**
- Mục tiêu: Cài đặt logic phát hiện Spike, Threshold Alert.
- Tiêu chí: Sinh event `ProcessSpikeAlert` khi RAM vượt ngưỡng.

**Phase 4: Frontend State & Data Structures**
- Mục tiêu: Xây dựng Zustand Store dùng `Float32Array` Circular Buffer để lưu 60s lịch sử.
- Tiêu chí: Frontend giữ mượt FPS > 60 khi nhận event.

**Phase 5: UI Visualization**
- Mục tiêu: Vẽ Sparklines, Line Charts và Modal Process Explorer.
- Tiêu chí: Mượt, UX chuẩn IDE.
