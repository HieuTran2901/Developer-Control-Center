# Git Exposure Scan Lifecycle Fix Report

## 1. Root Cause Analysis

### Lỗi 1: Treo ở trạng thái "Scanning..." (Race Condition)
Quá trình quét Git Exposure Scan diễn ra cực kỳ nhanh vì scanner chỉ mở file `.git/config` và bỏ qua tất cả các file khác. Do tốc độ quá nhanh, trình tự sự kiện gửi về Frontend diễn ra như sau:
1. Rust backend khởi chạy thread async và ngay lập tức chạy qua toàn bộ thư mục rồi phát ra các sự kiện: `Started` -> `FindingsChunk` -> `Completed`.
2. Frontend (`EventBus`) nhận sự kiện `Completed` và thay đổi trạng thái UI sang `COMPLETED`.
3. Vài mili-giây sau, Promise của Tauri IPC command `invoke('start_security_scan_cmd')` bên trong hàm `handleStartScan` mới thực sự resolve.
4. Lập tức, đoạn code ngay dưới `await` chạy: `setStatus('SCANNING')`. Hành động này **đè lên (overwrite)** trạng thái `COMPLETED` đã được xử lý ở bước 2. Kết quả: UI vĩnh viễn kẹt ở `Scanning...`.

### Lỗi 2: Hiển thị "undefined files scanned"
Struct `SecurityScanEvent` trong Rust (`domain.rs`) sử dụng tên biến `scanned_files` (snake_case) cho payload của sự kiện `Progress`. Tuy nhiên, TypeScript DTO lại mong đợi thuộc tính `scannedFiles` (camelCase). Do `SecurityScanEvent` thiếu cấu hình mapping serde sang camelCase, field `scanned_files` bị trả về đúng dạng snake_case, khiến React component đọc thành `undefined`.

## 2. Các thay đổi đã thực hiện (Fixes)

### A. Backend Lifecycle & DTO Mapping (`src-tauri/src/security/domain.rs`)
- Bổ sung cấu hình `#[serde(rename = "camelCaseTươngỨng")]` cho từng field bên trong enum `SecurityScanEvent` (bao gồm `scanId`, `projectId`, `scannedFiles`, `currentScanner`).
- Tuyệt đối không thay đổi kiểu cấu trúc chung `tag="type", content="payload"` để đảm bảo tương thích 100% với EventBus hiện tại của frontend.
- Nhờ vậy, frontend giờ đây nhận đúng field `scannedFiles` và hiển thị đúng "X files scanned".

### B. Frontend State Flow (`src/features/security/pages/SecurityOverview.tsx`)
- Gỡ bỏ dòng `setScanId(id)` và `setStatus('SCANNING')` sau lời gọi `await securityService.startSecurityScan(...)`.
- Lí do: Trạng thái UI trong Event-driven Architecture phải hoàn toàn được quyết định bởi Event (`SecurityScanEvent::Started`). Bỏ đi các dòng này giúp triệt tiêu hoàn toàn race condition, đảm bảo nếu `Completed` đến trước, nó sẽ không bị đè lại.

## 3. Cấu trúc luồng (Flow) sau khi sửa

- **UI Trigger**: `handleStartScan` gọi `securityService.startSecurityScan` và **không làm gì thêm**.
- **Backend Lifecycle**:
  - `Started` -> `EventBus` -> UI (`SCANNING`)
  - Vòng lặp quét -> `Progress` -> `EventBus` -> UI (cập nhật số lượng `scannedFiles`)
  - Hoàn tất vòng lặp -> `FindingsChunk` (nếu có) -> `EventBus` -> UI (cập nhật Findings)
  - Kết thúc task -> `Completed` -> `EventBus` -> UI (`COMPLETED`)
- **IPC/Event Flow**: Đồng nhất, đơn luồng và an toàn về trạng thái. Cấu trúc JSON chuẩn xác.

## 4. Kiểm tra Regression & Testing

- **Quick Scan**: Hoạt động bình thường. Tiến trình (progress) hiện "X files scanned" chuẩn xác, không bị "undefined".
- **Full Scan**: Hoạt động bình thường. 
- **Git Exposure Scan**: 
  - Khi Start: Chuyển sang `SCANNING`.
  - Khi End: Chuyển dứt khoát sang `COMPLETED` với Findings = 1, báo cáo hiển thị chính xác credential bị lộ từ `.git/config`. Không còn tình trạng kẹt.

## 5. Remaining Technical Debt
- Hiện tại backend `engine.rs` đang dùng `ignore::Walk` lặp qua toàn bộ file trên filesystem ngay cả khi mode là `GitExposure` (chỉ cần đọc `.git/config`). Điều này gây lãng phí CPU không cần thiết, dù thời gian lặp vẫn rất nhanh (do `git_scanner` filter nhanh). Trong tương lai, nên tối ưu `engine.rs` bỏ qua `ignore::Walk` nếu mode là `GitExposure`.
