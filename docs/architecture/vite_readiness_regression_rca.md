# Vite Readiness Regression RCA

## 1. Symptom
Khi khởi động profile `npm run dev`, process chạy thành công, Vite server hoạt động, terminal hiển thị log bình thường, nhưng giao diện Developer Control Center bị kẹt mãi ở trạng thái `STARTING` thay vì chuyển sang `READY/RUNNING`.

## 2. Expected Flow
- User click Run
- Backend `ProcessManager` spawn process
- Backend emit `ProcessStarted` (trạng thái: `Waiting`)
- Backend đọc `stdout`, match log với pattern `Local:`
- Khi match thành công, backend cập nhật Registry và emit `ProcessReadinessChanged` (`ready`)
- Frontend nhận event, cập nhật React state, UI hiển thị `READY`.

## 3. Actual Flow
- Backend spawn process và emit `ProcessStarted` (`Waiting`). UI hiển thị `STARTING`.
- Backend đọc `stdout` nhưng **KHÔNG match được pattern**.
- Backend KHÔNG BAO GIỜ emit `ProcessReadinessChanged`.
- UI bị kẹt ở `STARTING` vô thời hạn (vì trước đó timeout 3s đã bị gỡ bỏ để chuyển sang cơ chế thông minh này).

## 4. Runtime Evidence
Người dùng xác nhận Terminal vẫn hiển thị log bình thường. Điều này chứng minh `tokio` chunking và buffer hoạt động tốt, log không bị mất hay rớt. Node.js/Vite đã thực sự in ra dòng chữ có chứa `Local:`. Điểm đứt gãy nằm ở chính Regex Matcher.

## 5. Event Trace
1. `manager.rs` sinh ra child process.
2. `ReadinessResolver` gán đúng strategy là `ReadinessStrategy::LogPattern("Local:")`.
3. Vòng lặp `tokio::spawn` đọc từng line của Vite.
4. `regex.is_match(&line)` trả về `false` đối với dòng log của Vite.

## 6. Readiness Strategy Audit
Strategy được sử dụng cho `npm`/`vite` hiện tại là:
`ReadinessStrategy::LogPattern { pattern: "Local:".to_string() }`
Backend sử dụng `regex::Regex::new("Local:")` để match trực tiếp trên chuỗi `stdout` thô (raw string) chưa qua xử lý.

## 7. Vite stdout Analysis
Nếu xem mã nguồn của Vite (chẳng hạn dùng package `picocolors`), log startup của Vite được format như sau:
```javascript
console.log(`  ${colors.green('➜')}  ${colors.bold('Local')}:   ${colorUrl(localUrl)}`)
```
Lưu ý kỹ đoạn: `colors.bold('Local') + ':'`. 
Vite CHỈ áp dụng in đậm cho chữ `Local`, không bao gồm dấu hai chấm `:`.

## 8. ANSI / Chunking Analysis
Chuỗi byte thực tế Vite đẩy ra `stdout` sẽ chứa các ANSI escape sequences. Chuỗi raw trông sẽ giống như sau:
`\x1b[32m➜\x1b[39m  \x1b[1mLocal\x1b[22m:   \x1b[36mhttp://localhost:5173/\x1b[39m`

Bởi vì ANSI escape code un-bold (`\x1b[22m` hoặc `\x1b[0m`) bị chèn **NGAY GIỮA** chữ `Local` và dấu `:`. Dẫn đến chuỗi liền kề `"Local:"` thực sự **không hề tồn tại** trong raw output của Vite.

## 9. Backend Analysis
Do backend match trực tiếp trên raw output có chứa ANSI, `Regex::new("Local:")` thất bại. Logic update trạng thái trong `manager.rs` bị bỏ qua.

## 10. IPC Analysis
`src/desktop/ipc/index.ts` đã được map event `ProcessReadinessChanged` chính xác (line 23). Frontend hoàn toàn không có lỗi drop event. Vấn đề 100% nằm ở backend không emit event.

## 11. Frontend Analysis
Frontend nhận payload `readiness: "waiting"` từ `ProcessStarted`. File `useWorkspace.ts` map biến này vào `readinessState` của profile. Do không bao giờ nhận được `"ready"`, `Dashboard.tsx` tiếp tục render `STARTING`.

## 12. Root Cause
**C. ANSI parsing bug & B. Vite Log Pattern mismatch**
Lỗi xuất phát từ việc chuỗi raw log của Vite chứa ký tự ANSI chèn giữa các từ khoá (e.g., `Local\x1b[22m:`). Backend hiện tại không thực hiện "strip ANSI" trước khi kiểm tra readiness, dẫn đến việc Regex `"Local:"` match thất bại.

## 13. Impact on Spring Boot
Spring Boot hoạt động bình thường vì log của nó: `Started Application in 2.1 seconds` không có các ANSI codes cắt ngang giữa những từ khoá quan trọng, hoặc Regex `.*` của chúng ta đã vô tình "nuốt" qua cả các mã ANSI đó nếu có.

## 14. Recommended Fix
**Tuỳ chọn 1 (Nhanh và rủi ro thấp)**: Sửa Regex của Vite trong `readiness.rs` để dung nạp mã ANSI chèn giữa, ví dụ: `"Local.*:"` hoặc đổi pattern thành `"VITE v.* ready in"`.
**Tuỳ chọn 2 (Triệt để)**: Implement hàm `strip_ansi` (dùng regex `\x1b\[[0-9;]*m`) cho `line` trước khi đưa vào `re.is_match(&clean_line)` trong `manager.rs` (tất nhiên output gửi lên Terminal vẫn giữ nguyên raw ANSI).

## 15. Regression Risk
Rất thấp nếu áp dụng Tuỳ chọn 1.

## 16. Validation Plan
Cập nhật pattern trong `ReadinessResolver`, start lại `npm run dev` và quan sát UI cập nhật đúng từ `STARTING` sang `READY/RUNNING`.
