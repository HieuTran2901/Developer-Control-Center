# Desktop Audit Reports

## Milestone History

### 2026-08-05 - Desktop UI Polish Pass
- **Các module hoàn thành**: Giao diện ứng dụng (Layout, Sidebar, Dashboard)
- **Quyết định kiến trúc**: Chuyển hướng sang Desktop-first layout, ưu tiên hiển thị toàn màn hình, bỏ responsive mobile.
- **Các file ảnh hưởng**: MainLayout.tsx, PageContainer.tsx, Sidebar.tsx, Header.tsx, Dashboard.tsx

### 2026-08-05 - Process Runtime Foundation & Rust Process Spawning Engine
- **Các module hoàn thành**: Process Runtime Foundation (TS) & Rust Tokio Spawning Engine.
- **Quyết định kiến trúc**: 
  - Áp dụng Clean Architecture cho Runtime Layer (Domain -> App -> Infra).
  - Giao tiếp Rust ↔ TS thông qua Tauri IPC Events.
- **Các file ảnh hưởng**: ProcessState.ts, ProcessModel.ts, EventBus.ts, TauriRuntimeService.ts, service.rs, registry.rs, runtime_cmds.rs.

### 2026-08-05 - Real Process Execution (Phase 1)
- **Các module hoàn thành**: Real Process Execution, Toggle Configuration, Sample Project test.
- **Quyết định kiến trúc**:
  - Tách cờ `USE_MOCK_RUNTIME` ra cấu hình riêng để tránh phá vỡ giao diện.
  - Sử dụng `Child::kill()` ở Phase 1 chấp nhận để lại Zombie process (vd: `node.exe`) để tập trung vào single responsibility.
- **Các file ảnh hưởng**: runtimeConfig.ts, Dashboard.tsx, ipc/index.ts, service.rs, mock/index.ts.


### 2026-08-05 - Log Streaming Foundation (Phase 2)
- **Các module hoàn thành**: Luồng xử lý log Async trong Rust (BufReader), LogBufferManager trong Frontend (Circular Buffer).
- **Quyết định kiến trúc**: Giới hạn Log ở mức 5000 lines trên Frontend để tiết kiệm RAM. Đọc stdout/stderr thành các line event rời rạc truyền qua IPC.
- **Các file ảnh hưởng**: service.rs, EventBus.ts, ipc/index.ts, LogBuffer.ts, services/index.ts.

### 2026-08-05 - Terminal UI Foundation (Phase 3A)
- **Các module hoàn thành**: Giao diện Terminal cơ bản (Dialog).
- **Quyết định kiến trúc**: 
  - Tách bạch Terminal Component chỉ làm Presentation Layer (subscribe qua EventBus).
  - Sử dụng `appendChild` trực tiếp vào DOM thay vì lưu Log Message vào React State để đạt hiệu suất cao nhất khi stream, tránh React Re-render toàn bộ list.
- **Các file ảnh hưởng**: Terminal.tsx, Dashboard.tsx.

### 2026-08-05 - Terminal Interaction & Performance (Phase 3B)
- **Các module hoàn thành**: `TerminalRenderer`, DOM Virtualization (Pruning), Terminal Toolbar (Copy, Clear, Auto Scroll Toggle), Terminal Metrics.
- **Quyết định kiến trúc**: 
  - Đóng gói logic DOM vào một class TypeScript thuần (`TerminalRenderer`).
  - Áp dụng DOM Pruning giữ đúng 500 node khi Auto Scroll đang bật.
  - Sử dụng Throttling (Interval 1s) cho React State Metrics để không block UI.
- **Các file ảnh hưởng**: TerminalRenderer.ts, Terminal.tsx.

### 2026-08-05 - Process Lifecycle Management (Phase 4)
- **Các module hoàn thành**: `ProcessLifecycleService` (TS), `terminator.rs` (Rust), Actor Pattern trong `service.rs`.
- **Quyết định kiến trúc**: 
  - Phân tách Lifecycle Flow ra khỏi RuntimeService cơ bản.
  - Rust sử dụng `tokio::select!` lắng nghe `rx.recv()` và `child.wait()`.
- **Các file ảnh hưởng**: service.rs, terminator.rs, ProcessLifecycleService.ts, Dashboard.tsx, EventBus.ts, ProcessState.ts, runtime_cmds.rs.

### 2026-08-05 - Workspace Manager Foundation (Phase 5A)
- **Các module hoàn thành**: Persistence cho `WorkspaceRepository` thông qua `TauriDesktopGateway`. Refactor toàn bộ `Service` sang `RuntimeProfile`.
- **Quyết định kiến trúc**: 
  - Lưu cấu hình xuống file `workspace.json` tại AppData Directory bằng Tauri Command của Rust.
  - Tách bạch cấu hình tĩnh (`RuntimeProfile`) và State Model (`RuntimeProfileViewModel` tại Frontend, `ProcessModel` tại Backend).
- **Các file tạo mới/sửa đổi**: `src-tauri/src/commands/fs_cmds.rs`, `WorkspaceRepository.ts`, `IDesktopGateway.ts`, `Dashboard.tsx`, `useWorkspace.ts`, v.v.

### 2026-08-05 - Workspace Manager UI & Project Configuration (Phase 5B)
- **Các module hoàn thành**: Giao diện Workspace Manager, Project Editor, Profile Editor, Desktop Folder Picker.
- **Quyết định kiến trúc**: 
  - Cài đặt plugin `@tauri-apps/plugin-dialog` cho Tauri để hiện Folder Picker native của hệ điều hành. Điều này giúp UX mượt mà giống VS Code.
  - Sử dụng Two-pane layout cho màn hình Workspace (Left sidebar Tree-view, Right panel detail forms).
- **Các file tạo mới/sửa đổi**: `WorkspaceSidebar.tsx`, `ProjectEditor.tsx`, `ProfileEditor.tsx`, `WorkspacePage.tsx`, cấu hình Tauri dialog plugin trong `lib.rs` và `Cargo.toml`.

### 2026-08-05 - Workspace Session & State Management (Phase 5C)
- **Các module hoàn thành**: Quản lý phiên làm việc tách rời khỏi cấu trúc Workspace tĩnh thông qua `ApplicationStateService`. Hỗ trợ versioning cho Workspace.
- **Quyết định kiến trúc**: 
  - Tạo `session.json` lưu trạng thái hiện tại (sidebar, project selected, active terminal, recent workspaces).
  - Áp dụng Migration Pattern (`WorkspaceMigrationService`) để luôn update schema tự động.
- **Các file tạo mới/sửa đổi**: `WorkspaceSession.ts`, `WorkspaceMigrationService.ts`, `ApplicationStateService.ts`. Sửa đổi `Workspace.ts`, `WorkspaceRepository.ts`, `useWorkspace.ts`, `Dashboard.tsx`, `WorkspacePage.tsx`.

### 2026-08-05 - Resource Monitor Foundation (Phase 6)
- **Các module hoàn thành**: Backend Rust Monitor, ProcessMetrics domain, EventBus cho Metrics, Resource Monitor Service. ResourcePanel component.
- **Quyết định kiến trúc**:
  - Dùng `sysinfo` trên Rust thay vì NodeJS/CLI để lấy CPU/RAM mượt và chuẩn xác nhất trên mọi HĐH.
  - Rust chỉ gửi Event cho các PID được đánh dấu "watch", Frontend không polling.
  - Tách rời Service: Frontend Resource Monitor chỉ lấy sự kiện từ EventBus chứ không gọi IPC trực tiếp hay dính với RuntimeService.
- **Các file tạo mới/sửa đổi**: `src-tauri/src/monitor/mod.rs`, sửa `lib.rs` và `Cargo.toml`. `ProcessMetrics.ts`, `IResourceGateway.ts`, `TauriResourceGateway.ts`, `MockResourceGateway.ts`, `ResourceMonitorService.ts`, `ResourcePanel.tsx`.

### 2026-08-05 - Resource History & Alert System (Phase 6B)
- **Các module hoàn thành**: Lịch sử tài nguyên vòng lặp (Circular Buffer), Hệ thống Cảnh báo tự động (Alert), Biểu đồ Sparkline (SVG thuần).
- **Quyết định kiến trúc**:
  - Tự xây dựng SparklineChart bằng SVG để giảm thiểu dependencies. Biểu đồ chỉ nặng vài bytes thay vì hàng trăm KBs như ChartJS.
  - Sử dụng Circular Buffer cho `ProcessHistory` để cắt mảng sau 300 mẫu (O(1)). Tránh Memory Leak khi mở app trong nhiều giờ.
  - Logic cảnh báo (Alert) tách rời khỏi MonitorService, tuân thủ nguyên tắc Single Responsibility.
- **Các file tạo mới/sửa đổi**: `SparklineChart.tsx`, `AlertPanel.tsx`, `ResourcePanel.tsx`. Thêm Domain `Alert.ts`, `ProcessHistory.ts`. Các service `AlertService.ts`, `ResourceHistoryService.ts`.

### 2026-08-05 - Performance Analysis Engine (Phase 6C)
- **Các module hoàn thành**: `PerformanceAnalysisService`, `PerformanceSummary` domain, Health Score Engine.
- **Quyết định kiến trúc**:
  - Không sử dụng AI/LLM cho tầng phân tích này, chỉ dùng toán học cơ bản (Moving Average, Threshold rules) để đảm bảo O(N) cực nhanh và không tốn kém tài nguyên.
  - Tách bạch rõ ràng Analysis Layer: Service này đọc `ProcessHistory` và xuất ra `PerformanceSummary`. Giao diện chỉ nhận `PerformanceSummary` và render (Dumb UI).
- **Các file tạo mới/sửa đổi**: `PerformanceSummary.ts`, `PerformanceAnalysisService.ts`, `ResourcePanel.tsx`, `index.ts`, `EventBus.ts`.
