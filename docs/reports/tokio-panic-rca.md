# Root Cause Analysis: Tokio Reactor Panic

## 1. Nguyên nhân gốc (Root Cause)
Khi khởi chạy ứng dụng, lỗi xảy ra tại dòng 47 của `src-tauri/src/monitor/mod.rs` với thông báo: 
`there is no reactor running, must be called from the context of a Tokio 1.x runtime`

**Lý do:**
Hàm `init_monitor_worker` được gọi bên trong hook `.setup()` của Tauri ở file `lib.rs`:
```rust
.setup(move |app| {
    monitor::init_monitor_worker(app.handle().clone(), watched_pids);
})
```
Hook `.setup()` của Tauri chạy trên **Main Thread (UI Thread)** của hệ điều hành, vốn là một thread đồng bộ (synchronous) và **KHÔNG** thuộc phạm vi quản lý trực tiếp của một Async Tokio Runtime.

Tuy nhiên, bên trong `init_monitor_worker`, chúng ta lại gọi:
```rust
tokio::spawn(async move { ... });
```
Hàm `tokio::spawn` yêu cầu phải có một Context (hay Reactor) của Tokio đang chạy ngầm trên Thread gọi nó. Vì Main Thread không có Reactor này, `tokio::spawn` sẽ hoảng loạn (panic) ngay lập tức.

## 2. Giải pháp theo chuẩn Tauri v2
Tauri v2 được xây dựng bên trên Tokio, và nó tự quản lý một global Tokio Runtime để phục vụ IPC và các lệnh bất đồng bộ.

Để chạy một async task (như vòng lặp Monitor) từ một môi trường không đồng bộ (như Main Thread trong `.setup()`), ta không được phép dùng `tokio::spawn`, mà phải ném tương lai (future) đó vào Runtime do Tauri cung cấp.

**Code đã sửa:**
```rust
// Thay thế tokio::spawn bằng tauri::async_runtime::spawn
tauri::async_runtime::spawn(async move {
    let mut sys = System::new_all();
    // ...
});
```
Hàm `tauri::async_runtime::spawn` nhận Future và đẩy nó sang background worker threadpool của Tauri một cách an toàn mà không chặn (block) Main Thread.

## 3. Các lệnh Tokio khác trong hàm
Các lệnh như `tokio::time::sleep(Duration::from_secs(1)).await;` bên trong khối `async move { ... }` vẫn hoàn toàn hợp lệ và an toàn. Vì một khi Future đã được đẩy vào Tauri Runtime, nó sẽ được thực thi trên môi trường Tokio hợp lệ (có sẵn bộ định thời Timer/Reactor). Lỗi chỉ xảy ra ở khâu **khởi tạo** bằng `tokio::spawn`.

## 4. Ảnh hưởng đến các module khác
- **Không có tác dụng phụ tiêu cực**: Việc sửa đổi hoàn toàn tuân thủ Clean Architecture và triết lý của Tauri. Thread giám sát tài nguyên giờ đây sẽ chạy êm ái ngầm bên dưới mà không xung đột với Thread hiển thị UI.

Lệnh `cargo check` đã PASS thành công! Bạn có thể gõ `npm run tauri dev` để thưởng thức thành quả.
