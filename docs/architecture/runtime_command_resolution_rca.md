# Root Cause Analysis: Runtime Command Resolution

**Ngày báo cáo:** 2026-08-07
**Phân loại lỗi:** C. Executable Resolver bug & E. Windows process spawning bug (Rust `std::process::Command` Gotcha)

---

## 1. Trace Flow & Source of Truth

- **Runtime Profile**: `workingDirectory` được cấu hình đúng trên UI (`E:\Github project\ai-travel-marketplace\backend`).
- **Tauri IPC**: DTO truyền xuống `cwd` chính xác.
- **ProcessManager `start()`**: Nhận được biến `cwd` chính xác tại `manager.rs`.

---

## 2. Phân tích Hiện Tượng (The Bug)

Trong file **`src-tauri/src/runtime/manager.rs`**, luồng tạo Command diễn ra như sau:

**Dòng 87-89: Command Parser**
```rust
let mut parts = command.split_whitespace();
let cmd = parts.next().unwrap_or("").to_string(); // = ".\mvnw.cmd"
let args: Vec<String> = parts.map(|s| s.to_string()).collect(); // = ["spring-boot:run"]
```
=> **Command Parser hoạt động CHÍNH XÁC**. Không bị lỗi gộp toàn bộ chuỗi thành executable.

**Dòng 100-102: Executable Resolver & Spawner**
```rust
100: _ => &cmd, // resolved_cmd = ".\mvnw.cmd"
101: };
102: let mut c = Command::new(resolved_cmd);
```
=> **Lỗi bắt đầu từ đây**. 

**Dòng 114: Working Directory**
```rust
114: child_cmd.current_dir(cwd);
```
=> Hàm `.current_dir(cwd)` chỉ thiết lập thư mục làm việc cho **Child Process sau khi nó đã được spawn thành công**. Nó **không** làm thay đổi cơ chế tìm kiếm file thực thi (Executable Resolution) của lệnh `Command::new()`.

---

## 3. Root Cause (Nguyên nhân gốc rễ)

Theo thiết kế của thư viện chuẩn Rust (`std::process::Command` mà `tokio` wrap lại) và Windows API (`CreateProcessW`):
Khi bạn truyền một đường dẫn tương đối có chứa ký tự phân tách (như `.\mvnw.cmd` hoặc `./script.sh`) vào `Command::new()`, **OS sẽ phân giải đường dẫn này dựa trên Current Working Directory của TIẾN TRÌNH CHA (Tauri App)**, chứ không phải dựa trên đường dẫn vừa set ở `.current_dir()`.

Vì Developer Control Center (Tauri App) khi chạy ở chế độ dev có CWD là `E:\Github project\Developer-Control-Center\src-tauri`, nên `.\mvnw.cmd` lập tức bị biến thành `E:\Github project\Developer-Control-Center\src-tauri\mvnw.cmd`. OS đi tìm file này, không thấy, nên văng lỗi `"is not recognized as an internal or external command"`.

---

## 4. Tổng Hợp Đánh Giá

- **A. Configuration bug**: Không. UI lưu đúng CWD.
- **B. Command Parser bug**: Không. Tách executable và args đúng.
- **C. Executable Resolver bug**: **CÓ**. Không biến đổi relative path thành absolute path theo ngữ cảnh của project profile.
- **D. Working Directory propagation bug**: Không. CWD đi thẳng từ UI xuống Rust nguyên vẹn.
- **E. Windows process spawning bug**: **CÓ**. Hiểu lầm cơ chế resolve executable của `Command::new()` và `.current_dir()`.

---

## 5. Minimal Architectural Fix (Đề xuất)

Để giữ đúng Clean Architecture, chúng ta không được hack. Giải pháp là nâng cấp "Executable Resolver" trong `ProcessManager` để nó nhận thức được ngữ cảnh thư mục:

**Expected Behavior**:
Bất cứ executable nào chứa ký tự phân tách thư mục (`/` hoặc `\`) đều phải được join với `cwd` thành Absolute Path **trước khi** nạp vào `Command::new()`. Các command toàn cục (chỉ có tên như `npm`, `cargo`) thì giữ nguyên để OS tìm trong biến môi trường `PATH`.

**Cách sửa dự kiến (không đụng code theo yêu cầu)**:
Tại `manager.rs`, trước khi gọi `Command::new`, ta kiểm tra xem chuỗi có phải là đường dẫn tương đối không, nếu có thì ép nó thành absolute path:

```rust
let is_relative_or_absolute = cmd.contains('/') || cmd.contains('\\');
let executable_path = if is_relative_or_absolute {
    std::path::Path::new(&cwd).join(&cmd).to_string_lossy().to_string()
} else {
    // Giữ nguyên logic cũ (npm -> npm.cmd, etc.)
    ...
};
let mut c = Command::new(executable_path);
```

Báo cáo RCA đã hoàn tất.
