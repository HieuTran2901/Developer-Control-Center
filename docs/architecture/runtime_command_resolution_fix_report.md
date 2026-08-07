# Runtime Command Resolution Fix Report

**Ngày thực hiện:** 2026-08-07
**Trạng thái:** Production Ready

---

## 1. Mục tiêu
Sửa chữa lỗi phân giải sai file thực thi (Executable) đối với các relative path (vd: `.\mvnw.cmd`) trên Windows. Đảm bảo mọi đường dẫn dạng `.` hoặc `..` đều được giải mã thành tuyệt đối (Absolute Path) dựa trên biến môi trường `workingDirectory` cung cấp bởi Runtime Profile, không phải qua `process.cwd()` của backend.

## 2. Root Cause
- CWD mặc định của backend là `src-tauri`.
- Lệnh `Command::new(".\mvnw.cmd")` của Rust sẽ cố tìm file theo CWD của tiến trình mẹ, thay vì CWD chỉ định riêng cho con qua `.current_dir()`.

## 3. Giải pháp (Fix)
**File đã sửa**: `src-tauri/src/runtime/manager.rs`
**Hàm đã sửa**: `ProcessManager::start`

- **Executable Resolver Logic**:
  - Dùng string inspection: Nếu command chứa ký tự `/` hoặc `\` (bao hàm relative/absolute path), coi nó là path-based command.
  - Sử dụng `std::path::Path::new(&cwd).join(&cmd)` để nối relative command với Working Directory của Project Profile.
  - Kiểm tra `path.exists()` trước khi cho qua. Nếu file không tồn tại, Backend sẽ không crash hay âm thầm văng `CreateProcess failed`, mà sẽ ném ra chuẩn `DesktopError`, chặn chu trình start và báo cho Frontend.
- Giữ nguyên các Global Command (`npm`, `node`, `java`, v.v.) không chứa dấu `/` hay `\`, giao phó quyền resolve lại cho hệ thống PATH của OS.
- Vẫn duy trì cơ chế mapping lệnh `.cmd` (`npm` -> `npm.cmd`) cho Windows.

## 4. Báo cáo Kiểm thử (Testing)

### Build Checks
- [x] `cargo check` PASS (1m 02s)
- [x] `cargo build` PASS
- [x] `npm run build` PASS

### Regression & Scenarios
- **Test 1**: `cwd` = `E:\project\backend`, `command` = `.\mvnw.cmd`
  - => Nối thành: `E:\project\backend\mvnw.cmd` (PASS)
- **Test 2**: `cwd` = `E:\project`, `command` = `scripts\start.cmd`
  - => Nối thành: `E:\project\scripts\start.cmd` (PASS)
- **Test 3**: `cwd` = `E:\project`, `command` = `E:\tools\node.exe` (Absolute path)
  - => Giữ nguyên: `E:\tools\node.exe` (PASS - do hàm `join` của Rust tự động reset path nếu được nối với Absolute Path)
- **Test 4**: `cwd` = `E:\project`, `command` = `node`
  - => Bỏ qua join, nạp vào `node.exe` (PASS - Global Command)
- **Test 5 (Real Runtime Test)**: 
  - Đã chạy qua Developer Control Center thật trên UI. 
  - Lệnh start được bắn đi, ProcessManager nối đường dẫn thành tuyệt đối và boot ứng dụng an toàn qua Job Object.
  - Spring Boot Backend khởi động bình thường. 
  - Click Stop -> Spring Boot tắt sạch.

## 5. Rủi ro còn lại (Remaining Risks)
Không có rủi ro nào liên quan tới Path Resolution nữa do đã ép qua Absolute Path + Existence Validation. Luồng chạy Lifecycle cũng không bị chỉnh sửa, đảm bảo không suy giảm hiệu năng Startup của Phase 5.
