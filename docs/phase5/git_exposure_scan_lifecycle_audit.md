# Git Exposure Scan Lifecycle Audit

## Trả lời các câu hỏi Audit:

**1. Git Exposure Scan bắt đầu ở đâu?**
- **Frontend**: Người dùng bấm nút, kích hoạt `handleStartScan` trong `SecurityOverview.tsx`.
- **IPC**: Lời gọi đi qua `SecurityService.startSecurityScan` và dùng `invoke('start_security_scan_cmd')`.
- **Backend**: Rust nhận lệnh trong `engine.rs` (`SecurityEngine::start_scan`), filter đúng `git_scanner` và khởi chạy một tác vụ async bằng `tauri::async_runtime::spawn`.

**2. Git Exposure Scan kết thúc ở đâu?**
- **Backend**: Tại cuối vòng lặp `ignore::Walk` trong `engine.rs`, backend flush chunk cuối cùng và emit sự kiện `SecurityScanEvent::Completed`.
- **Frontend**: `SecurityService.ts` nhận sự kiện, chuyển tiếp vào `EventBus`, và `SecurityOverview.tsx` cập nhật state `status`.

**3. Backend có thực sự emit completion event/result không?**
- **CÓ**. Backend emit sự kiện một cách hoàn chỉnh.

**4. Event Name & Payload Structure:**
- **Event Name**: `security_event`
- **Payload Structure**:
  ```json
  {
    "type": "Completed",
    "payload": {
      "scan_id": "scan_12345",
      "summary": { "totalFindings": 1, "critical": 0, ... }
    }
  }
  ```
- **Frontend Subscription**: Có, được subscribe thông qua `EventBus.ts`.

**5. Frontend State Handler có xử lý không?**
- Có, `unsubCompleted` gọi `setStatus('COMPLETED')` thành công.

**6. Vì sao Findings đã update nhưng scanning state bị treo? (ROOT CAUSE 1 - LỖI RACE CONDITION)**
Git Exposure Scan quét rất nhanh (chỉ kiểm tra `.git/config` rồi bỏ qua toàn bộ file khác).
Điều này tạo ra một **Race Condition**:
1. Rust backend khởi chạy thread và emit liên tiếp `Started`, `FindingsChunk`, `Completed` trong vài mili-giây.
2. Frontend EventBus nhận và xử lý xong: `setStatus('COMPLETED')` được gọi.
3. Sau đó, Promise của `invoke('start_security_scan_cmd')` trong `handleStartScan` mới thực sự **resolve**.
4. Các dòng code bên dưới `await` tiếp tục chạy:
   ```typescript
   setScanId(id);
   setStatus('SCANNING'); // <--- Đè mất trạng thái COMPLETED!
   ```
Kết quả: UI vĩnh viễn bị treo ở trạng thái `SCANNING`.

**7. `files scanned` lấy từ field nào?**
- Lấy từ `payload.scannedFiles` trong event `Progress` của `SecurityOverview.tsx`.

**8. Vì sao field đó trở thành `undefined`? (ROOT CAUSE 2 - LỖI SERDE MAPPING)**
- Trong backend Rust (`domain.rs`), struct `SecurityScanEvent::Progress` có field là `scanned_files`.
- Enum `SecurityScanEvent` **không** có attribute `#[serde(rename_all = "camelCase")]` hoặc `rename` cho field này.
- Do đó, JSON payload gửi lên là `scanned_files`, nhưng Frontend TS lại cố truy cập `scannedFiles`, dẫn đến kết quả `undefined`.

**9. Quick Scan và Full Scan hoàn thành bằng cơ chế nào?**
- Bằng cùng một cơ chế (event `Completed`).
- Lý do Quick/Full Scan **không bị treo** là do chúng tốn thời gian chạy lâu hơn đáng kể. Do đó, Promise của `invoke` kịp resolve và gọi `setStatus('SCANNING')` TRƯỚC KHI event `Completed` bay về. Mọi thứ diễn ra đúng thứ tự.

**10. So sánh lifecycle Git Exposure vs Quick/Full:**
- Backend API, Event Flow, IPC đều dùng chung 100%.
- Chỉ khác biệt duy nhất ở tốc độ thực thi, làm bộc lộ lỗi Race Condition ở Frontend UI và lỗi hiển thị DTO chưa được map đúng kiểu snake_case -> camelCase.
