# Technical Decisions

## Decision #1
**Date:** 2026-08-04
**Title:** Clean Architecture and Modular Structure
**Reason:** To ensure the desktop app remains maintainable, testable, and scalable for years without massive refactors.
**Alternative:** Standard monolithic React App with mixed logic.
**Impact:** Initial development is slightly slower but long-term maintenance is significantly easier.

## Decision #2
**Date:** 2026-08-05
**Title:** Desktop-First UI Design
**Reason:** The app needs to feel like a native desktop app (like VS Code or JetBrains) instead of a responsive website.
**Alternative:** Responsive mobile-first website design.
**Impact:** Removed mobile constraints, full-width layouts, dynamic sidebar, fixed aspect ratios for desktop.

## Decision #3
**Date:** 2026-08-05
**Title:** Rust Tokio Process Spawning
**Reason:** Need to manage system child processes reliably. 	okio::process provides async non-blocking spawn and handle management.
**Alternative:** Node.js child_process (not possible via standard Tauri without sidecar).
**Impact:** Requires robust async rust code and IPC communication to sync process state.

## Decision #4
**Date:** 2026-08-05
**Title:** Vì sao dùng Mock Runtime song song với Real Runtime
**Reason:** Để dễ dàng cô lập và test UI/UX trên Frontend mà không cần phải thực sự gọi OS process hay chờ build backend Rust, tiết kiệm thời gian phát triển giao diện.
**Alternative:** Xóa bỏ hoàn toàn Mock, chỉ gọi Rust.
**Impact:** Tăng cường tính độc lập của Frontend, đảm bảo khả năng chạy thử nghiệm ngay cả khi môi trường Rust có vấn đề. (Cấu hình qua `runtimeConfig.ts`).

## Decision #5
**Date:** 2026-08-05
**Title:** Vì sao Phase 1 dùng `Child::kill()`
**Reason:** Trong giai đoạn thử nghiệm Spawn ban đầu, dùng chuẩn của `tokio::process::Child::kill()` là đủ để kết thúc root process, đảm bảo tốc độ hoàn thành nhanh (single responsibility).
**Alternative:** Gọi API Windows Native (taskkill /T /F) để dọn dẹp (reap) toàn bộ Process Tree.
**Impact:** Có thể để lại Zombie Process (vd: `node.exe` khi tắt `cmd.exe`). Sẽ được xử lý nâng cao bằng crate `sysinfo` hoặc `taskkill` ở các milestone sau.

## Decision #6
**Date:** 2026-08-05
**Title:** Vì sao sử dụng `LogBufferManager` dạng Circular Buffer (Max 5000 lines) cho Frontend.
**Reason:** Để bảo vệ bộ nhớ RAM không bị phình to (Memory Leak) nếu một process in log vô hạn. Giữ 5000 lines là mức hợp lý để developer xem lại lịch sử trên Terminal UI.
**Alternative:** Dùng Redux store hoặc ghi ra file ở Frontend.
**Impact:** Frontend nhẹ hơn, nhưng log cũ sẽ bị mất (nếu cần xem log đầy đủ, sau này ta có thể làm tính năng ghi ra file ở backend Rust thay vì phụ thuộc Frontend).

## Decision #7
**Date:** 2026-08-05
**Title:** Vì sao dùng DOM Pruning thay vì React Virtualization Library
**Reason:** Để tối ưu số lượng Node hiển thị (MAX=500) mà không cần phụ thuộc vào thư viện ngoài (như `react-window` hoặc `react-virtuoso`). Cho phép thao tác `appendChild` nhanh gọn, không kích hoạt cơ chế React Diffing khi có log stream tốc độ cao.
**Alternative:** Dùng React List ảo hóa.
**Impact:** Mất khả năng cuộn quá 500 dòng cũ nhất nếu đang bật Auto Scroll. Cần tắt Auto Scroll để ngừng Pruning.

## Decision #8
**Date:** 2026-08-05
**Title:** Actor Model cho Process Spawning & Lifecycle
**Reason:** Đảm bảo hệ thống có thể lắng nghe tự động (Natural exit/crash) đồng thời với việc nhận lệnh Stop từ người dùng, tránh Deadlock và mất trạng thái Process.
**Alternative:** Dùng Wait/Kill rời rạc.
**Impact:** `service.rs` trở nên đáng tin cậy tuyệt đối. Bất cứ khi nào Process exit, hệ thống tự gọi dọn dẹp Registry.

## Decision #9
**Date:** 2026-08-05
**Title:** Phân loại Graceful Stop và Force Stop
**Reason:** Ngăn chặn việc kill thẳng tay làm mất dữ liệu của Process con, nhưng vẫn có công cụ `taskkill /T /F` để diệt sạch Zombie Process (như node.exe spawn ra các server khác).
**Alternative:** Chỉ dùng `child.kill()`.
**Impact:** Cần Timeout 3s (xử lý tại TS ProcessLifecycleService) để chờ quá trình Graceful Stop, nếu thất bại mới Force Stop.

## Decision #10
**Date:** 2026-08-05
**Title:** Chuyển đổi Service thành Runtime Profile
**Reason:** Việc coi mỗi entry chạy như một "Service" gây nhầm lẫn khi người dùng muốn chạy các tác vụ rời rạc (One-off task) hoặc nhiều môi trường cho cùng một project. Cấu trúc mới là Workspace -> Project -> Runtime Profile hợp lý hơn.
**Alternative:** Giữ nguyên tên Service.
**Impact:** Sửa đổi hệ thống IPC (`serviceId` -> `profileId`) và giao diện hiển thị tại Dashboard. Đảm bảo nền tảng mở rộng trong các Phase tiếp theo.

## Decision #11
**Date:** 2026-08-05
**Title:** Lưu trữ cấu hình bằng Rust fs commands
**Reason:** Để không phải cài thêm Plugin FS của Tauri v2 gây nặng dự án, tôi đã tự viết lệnh `read_text_file` và `write_text_file` thông qua Rust.
**Impact:** `WorkspaceRepository` có thể dễ dàng load và save file `workspace.json` một cách nhẹ nhàng.

## Decision #12
**Date:** 2026-08-05
**Title:** Sử dụng @tauri-apps/plugin-dialog cho Folder Picker
**Reason:** Mặc dù dự án cố gắng hạn chế cài thêm Tauri plugins để nhẹ nhàng, nhưng Folder Picker của Desktop OS không thể làm được qua giao diện web truyền thống. Sử dụng plugin dialog là bắt buộc để có UX đạt chuẩn Desktop App (như VS Code/JetBrains).
**Alternative:** Bắt người dùng nhập tay đường dẫn, hoặc giả lập Web UI (không an toàn và xấu).
**Impact:** Cargo build thêm module `rfd`, cần cập nhật file `default.json` permissions.

## Decision #13
**Date:** 2026-08-05
**Title:** Tách rời Workspace Session và Workspace Config
**Reason:** Workspace cần được lưu trữ vào Git hoặc chia sẻ. Session (như màn hình đang mở, terminal) là state tuỳ biến của local. Vì vậy phải tách ra `workspace.json` và `session.json`.
**Alternative:** Gộp chung gây rối loạn khi sync file và dư thừa data không mong muốn.
**Impact:** Ứng dụng khôi phục chính xác trạng thái nơi người dùng dừng lại mà không phá hỏng thiết kế Domain Driven Design.

## Decision #14
**Date:** 2026-08-05
**Title:** Push-based Resource Monitoring
**Reason:** Giải pháp Polling CPU/RAM 1s/lần từ React sẽ làm Frontend rất chậm và giật lag, tốn pin.
**Alternative:** Dùng `sysinfo` crate trên Rust, chạy background thread và Push data lên Frontend qua Tauri Event. Frontend chỉ nhận và cập nhật React State.
**Impact:** 
- UI mượt mà.
- Rust có khả năng scale tốt để handle hàng trăm process.
- Frontend decoupled hoàn toàn (theo EventBus).

## Decision #15
**Date:** 2026-08-05
**Title:** Zero Dependency Charting & Circular Buffer
**Reason:** Ứng dụng Control Center cần hoạt động 24/7 mà không làm ngốn RAM của Developer. Nếu lưu mảng lịch sử dài sẽ gây Memory Leak. Nếu dùng thư viện Chart.js sẽ làm app nặng nề.
**Alternative:** Giới hạn 300 mẫu (5 phút) cho history. Sử dụng thẻ `<svg>` thuần để vẽ biểu đồ Sparkline cực nhẹ.
**Impact:** Hiệu năng đạt mức hoàn hảo, dashboard nhìn rất "pro" nhưng dung lượng Bundle không tăng thêm kb nào đáng kể.

## Decision #16
**Date:** 2026-08-05
**Title:** Rule-Based Analysis Engine (No AI)
**Reason:** Việc phân tích hiệu năng liên tục (1s/lần) nếu dùng LLM sẽ dẫn tới chi phí khổng lồ, lag hệ thống, token limit.
**Alternative:** Dùng các logic toán học (Moving Average, Threshold rules) để phân tích Trend, Spike, tính Health Score. Đóng gói kết quả vào `PerformanceSummary`.
**Impact:** Hiệu năng đạt mức tối ưu. Data được xử lý sạch sẽ, tạo tiền đề để khi có sự cố, AI chỉ cần đọc file JSON `PerformanceSummary` là sẽ bắt bệnh cực kỳ chuẩn xác và tiết kiệm token.

## Decision #17
**Date:** 2026-08-06
**Title:** Clean Architecture cho Process Lifecycle Data Propagation
**Reason:** Đảm bảo Presentation Layer không bị rò rỉ (leak) dữ liệu từ tầng hệ điều hành. Chỉ propagate các ProcessState ảnh hưởng đến UI (như `Crashed`). Các field như `parent_pid` được đóng gói hoàn toàn ở Backend để quản lý orphan process.
**Impact:** Giảm payload IPC, giữ Frontend code tập trung vào Presentation, tuân thủ nguyên tắc Single Responsibility. Xem chi tiết tại [phase2_architecture_review.md](reports/phase2_architecture_review.md).

## Decision #18
**Date:** 2026-08-06
**Title:** Xử lý Terminal ANSI Rendering
**Reason:** Chuyển đổi mã màu ANSI (Escape sequences) từ console output sang DOM an toàn mà không phá vỡ kiến trúc siêu nhẹ của TerminalRenderer hiện tại.
**Alternative:** Dùng `xterm.js` (quá nặng, mất quyền kiểm soát tuỳ biến DOM Pruning) hoặc tự viết Regex (khó maintain, không hỗ trợ true color).
**Impact:** Chọn sử dụng thư viện `ansi_up` kết hợp Pattern Adapter (`AnsiParser.ts`). Đảm bảo nhẹ, nhanh, chống XSS (`innerHTML`), và tái sử dụng được ở nơi khác. Xem chi tiết tại [terminal_ansi_architecture.md](reports/terminal_ansi_architecture.md).

## Decision #19
**Date:** 2026-08-06
**Title:** Xử lý triệt để Lỗi Process Stop (Orphan Process) trên Windows
**Reason:** Giải quyết lỗi tiến trình con (như `node.exe`) vẫn chạy ngầm sau khi ấn Stop do lệnh `child.kill()` chỉ diệt được lớp vỏ `cmd.exe`.
**Alternative:** Dùng Timeout phía Frontend (hiện tại đang bị vô hiệu hoá do Event race condition).
**Impact:** Quyết định dời toàn bộ trách nhiệm Quản lý Vòng đời (đặc biệt là logic Force Kill) xuống Rust Backend. Loại bỏ `cmd.exe /C` nếu có thể, hoặc áp dụng `taskkill /T` trực tiếp ở Backend. Xem chi tiết tại [process_stop_investigation.md](reports/process_stop_investigation.md).
