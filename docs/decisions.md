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


## Decision #20
**Date:** 2026-08-15
**Title:** Chuẩn hóa RFC 7636 PKCE & Bóc tách Google OAuth Token Exchange Error
**Reason:** Cải thiện độ tin cậy và khả năng chẩn đoán của luồng kết nối tài khoản AI Quota OAuth. Ngăn chặn việc ẩn giấu nguyên nhân từ chối của Google trong lỗi generic HTTP 400 và đảm bảo `code_verifier` tuân thủ 100% chuẩn mật mã RFC 7636.
**Alternative:** Dùng chuỗi ngẫu nhiên dựa trên UUID/timestamp hoặc chỉ in mã status code HTTP.
**Impact:** `code_verifier` được tạo bằng OS-backed cryptographic random bytes (`BCryptGenRandom` / `getrandom`) trên bảng ký tự unreserved 64 ký tự. Khi có lỗi từ chối, Google error body (`error`, `error_description`) được giải mã và hiển thị an toàn trên giao diện DCC. Xem chi tiết tại [oauth_token_exchange_pkce_hardening_report.md](reports/oauth_token_exchange_pkce_hardening_report.md).

## Decision #21
**Date:** 2026-08-16
**Title:** Chuyển đổi OAuth Client ID sang Antigravity Native Desktop Auth Client (`88435491...apps.googleusercontent.com`)
**Reason:** Chẩn đoán lỗi AG-9.13 từ Google token exchange xác nhận phản hồi `error='invalid_request', description='client_secret is missing.'` do Client ID trước đó (`1071006060591-...`) thuộc loại Confidential Client (Web Application proxy của Cloud Code). Client ID `884354919052-36trc1jjb3tguiac32ov6cod268c5blh.apps.googleusercontent.com` được khám phá trực tiếp từ module `[AuthProvider]` và `Keyring LoadStoredToken` của Antigravity binary là Native Desktop Public Client hỗ trợ PKCE trực tiếp không cần `client_secret`.
**Alternative:** Giữ nguyên client cũ hoặc giả mạo bí mật (bị từ chối vì vi phạm nguyên tắc bảo mật).
**Impact:** Client ID mặc định của DCC được chuyển sang `884354919052-36trc1jjb3tguiac32ov6cod268c5blh.apps.googleusercontent.com`.

## Decision #22
**Date:** 2026-08-16
**Title:** Chuyển đổi Cơ chế AI Quota Monitoring sang Local Antigravity Language Server Bridge (Connect-RPC)
**Reason:** Dựa trên kết quả khám phá runtime thực tế từ AG-9.17, Antigravity sử dụng kiến trúc local daemon (`language_server.exe`) lắng nghe trên loopback HTTPS và cung cấp Connect-RPC endpoint `/exa.language_server_pb.LanguageServerService/GetUserStatus`. Việc DCC kết nối trực tiếp đến daemon cục bộ này loại bỏ hoàn toàn sự phụ thuộc vào luồng Google OAuth bên ngoài, không cần quản lý `client_secret`, không vi phạm nguyên tắc bảo mật và đạt độ chính xác 100% về quota live, reset times, credits của 14 models.
**Alternative:** Tiếp tục ép luồng Google OAuth phức tạp từ bên ngoài với nguy cơ bị chặn bởi chính sách Confidential Client của Google Cloud.
**Impact:** Xây dựng module `AntigravityDiscovery` và `AntigravityQuotaClient` trong Rust Backend. Tự động phát hiện PID, listening port và `--csrf_token` an toàn từ process metadata. Toàn bộ CSRF token chỉ lưu hành nội bộ Backend.

## Decision #23
**Date:** 2026-08-16
**Title:** Loại bỏ hoàn toàn Luồng Google OAuth khỏi Giao diện AI Quota UI & Kích hoạt Local Runtime Bridge
**Reason:** Kiểm toán mã nguồn AG-9.19 phát hiện nút "Connect Account" / "Retry Connection" trong `QuotaAccountCard.tsx` vẫn gọi `quotaPollingService.connectGoogleAccount()`, dẫn đến việc trigger luồng OAuth bên ngoài và gây ra lỗi `client_secret is missing`. Việc loại bỏ hoàn toàn các modal và lời gọi OAuth khỏi giao diện quota, chuyển sang nút "Connect to Antigravity" / "Detect Antigravity", đảm bảo 100% các thao tác người dùng đều đi qua Local Connect-RPC Bridge.
**Alternative:** Giữ nút OAuth song song với local bridge (gây nhầm lẫn cho người dùng và trigger lỗi Google OAuth không cần thiết).
**Impact:** Toàn bộ AI Quota UI chuyển sang sử dụng `AntigravityLocalRuntime` làm nguồn dữ liệu duy nhất. Không còn bất kỳ request nào gửi đến `oauth2.googleapis.com` trong quá trình monitor quota.

## Decision #24
**Date:** 2026-08-16
**Title:** Xác thực Account Identity & Đảm bảo Tính cô lập Quota Ownership trong Local Bridge
**Reason:** Kết quả kiểm toán AG-9.22 xác định bug nghiêm trọng khi một tài khoản mới (Account B) nhận nhầm quota của tài khoản đang đăng nhập trong Antigravity (Account A) do `QuotaProviderService` trước đây không kiểm tra identity trả về từ `GetUserStatus` mà gán thẳng `account_id` yêu cầu vào snapshot và ghi đè vào cache.
**Alternative:** Cho phép hiển thị quota của runtime hiện tại cho mọi tài khoản (gây sai lệch dữ liệu người dùng và vi phạm tính cô lập tài khoản).
**Impact:** Chuẩn hóa so sánh identity (`runtime_email == expected_email` case-insensitive & trimmed). Bổ sung `owner_email` vào `QuotaCacheEntry`. Khi xảy ra mismatch, hệ thống tuyệt đối không gán model quota, không ghi đè cache, gán trạng thái `AuthRequired` kèm thông báo chẩn đoán rõ ràng: *"Account mismatch: Antigravity is currently authenticated as [runtime_email], but this account is [expected_email]."*

## Decision #25
**Date:** 2026-08-16
**Title:** Kiến trúc Multi-Provider Quota Foundation (Provider Trait, Registry, Compound Cache Keys & Runtime Isolation)
**Reason:** Chuẩn bị nền tảng mở rộng đa nhà cung cấp AI quota (Antigravity, Codex, Claude Code) theo AG-9.25 mà không gây phá vỡ cơ chế Local Runtime Bridge hiện tại, không tái diễn lỗi Google OAuth và đảm bảo tính cô lập tuyệt đối giữa các provider.
**Alternative:** Tiếp tục gắn chặt Polling Engine với `AntigravityQuotaClient` và xử lý ad-hoc khi thêm provider mới.
**Impact:** 
1. Giới thiệu enum `QuotaProviderId` (`antigravity`, `codex`, `claude_code`).
2. Trừu tượng hóa `QuotaProvider` trait độc lập với Connect-RPC, CSRF và process discovery.
3. Thiết lập `QuotaProviderRegistry` quản lý việc phân phối runtime. `AntigravityQuotaProvider` là provider duy nhất được implement; `Codex` và `Claude Code` trả lỗi tường minh `ProviderNotImplemented` và tuyệt đối không fallback sang Antigravity.
4. Chuyển đổi toàn bộ cache key sang compound key `format!("{}:{}", provider_id, account_id)`.
5. Bổ sung trường `provider: Option<QuotaProviderId>` trong `AccountMonitorConfig` với cơ chế backward-compatibility tự động default về `antigravity` cho các tài khoản cũ.

## Decision #26
**Date:** 2026-08-16
**Title:** Antigravity Auto Quota Refresh, User-Configurable Polling & In-Flight Request Deduplication
**Reason:** Giải quyết nhu cầu tự động cập nhật AI quota theo chu kỳ định kỳ do người dùng tự cấu hình (OFF, 30s, 1m, 5m default, 10m, 15m, 30m, 60m), đồng thời ngăn chặn các request trùng lặp (in-flight race conditions) khi người dùng vừa bật auto-refresh vừa bấm "Refresh" thủ công.
**Alternative:** Dùng `setInterval` thuần ở Frontend (gây mất đồng bộ khi đóng/mở tab, tải lại UI hoặc restart app) hoặc gọi trùng lặp Connect-RPC endpoint.
**Impact:**
1. Tạo module `QuotaSettingsStore` lưu trữ cấu hình `QuotaRefreshSettings` vào file `quota_refresh_settings.json` trong AppData directory, đảm bảo persistent qua các lần khởi động lại DCC.
2. Xây dựng background timer loop trong `QuotaPollingEngine` với chu kỳ kiểm tra 1s để đáp ứng ngay lập tức khi người dùng bật/tắt hoặc đổi interval.
3. Bổ sung `in_flight: Arc<RwLock<HashSet<String>>>` trong `QuotaPollingEngine::execute_account_refresh` để deduplicate triệt để các request trùng lặp trên cùng một account.
4. Gửi các sự kiện IPC an toàn qua Tauri (`quota:account-updated` và `quota:engine-status-changed`).
5. Hiển thị bảng điều khiển trực quan tại `QuotaSummary.tsx` với công tắc Bật/Tắt, dropdown chọn chu kỳ (30s -> 60m) và đồng hồ đếm ngược thời gian thực (`Next refresh in MM:SS`).

## Decision #27
**Date:** 2026-08-16
**Title:** Tích hợp AppHandle Bootstrap & Auto-Start An toàn cho Background Quota Polling
**Reason:** Đưa Antigravity Quota Polling Engine trở thành background service cấp ứng dụng thực thụ, hoạt động độc lập với vòng đời UI (survives React unmount, navigation, frontend reload) và đảm bảo các sự kiện Tauri (`quota:account-updated`, `quota:engine-status-changed`) được phát đi an toàn đến toàn bộ cửa sổ ứng dụng.
**Alternative:** Dựa vào thao tác mở trang `QuotaDashboard` của người dùng để kích hoạt engine (khiến background polling bị gián đoạn nếu người dùng chỉ dùng các tính năng khác của DCC).
**Impact:**
1. Gắn `AppHandle` vào `QuotaPollingEngine` an toàn trong hàm `setup()` của `src-tauri/src/lib.rs`.
2. Tự động đọc cấu hình `QuotaRefreshSettings` khi khởi động; nếu `autoRefreshEnabled == true` thì tự động khởi động background loop mà không làm block quá trình bootstrap của DCC.
3. Mọi lỗi khởi tạo quota subsystem đều là non-fatal, được bắt gọn và không gây crash ứng dụng.
4. Đảm bảo invariant I13: tối đa một background polling loop được phép chạy đồng thời.

## Decision #28
**Date:** 2026-08-16
**Title:** Quota Dashboard UI Density, Shared Quota Grouping & Presentation Layer Formatting
**Reason:** Cải thiện mật độ hiển thị (UI density) của Quota Dashboard, loại bỏ sự lặp lại của thanh tiến trình (progress bar) và thông số phần trăm khi nhiều model chia sẻ chung một quota pool (như các model Gemini hoặc Claude), đồng thời loại bỏ lỗi hiển thị số thực (floating-point artifacts như 31.607039999999998%).
**Alternative:** Giữ nguyên hiển thị từng model độc lập (khiến account card quá dài, vượt quá 1500px chiều cao khi có 14 model).
**Impact:**
1. Giới thiệu `QuotaGroupViewModel` và hàm helper `groupModelsIntoQuotaPools` tại tầng presentation (không làm thay đổi data model authoritative của backend).
2. Gom nhóm các model có cùng reset timestamp, remaining fraction và họ model vào chung 1 nhóm ("Gemini Shared Quota", "Claude Shared Quota", v.v.).
3. Hiển thị 1 thanh progress bar và 1 giá trị phần trăm duy nhất cho mỗi nhóm quota chia sẻ, mặc định thu gọn (collapsed by default) với nút mở rộng xem danh sách model con.
4. Thêm vùng cuộn nội bộ (`max-h-[340px] overflow-y-auto`) trong account card, giúp kích thước card luôn gọn gàng và ổn định.
5. Cập nhật `QuotaSummary.tsx` hiển thị tổng số quota group và tổng số model đang được giám sát trên toàn hệ thống.

## Decision #29
**Date:** 2026-08-16
**Title:** Persistent Account Connection Intent & Automatic Runtime Reconnect on Application Startup (AG-9.29)
**Reason:** Khắc phục vấn đề tài khoản Antigravity bị mất trạng thái "Connected" sau khi đóng và mở lại DCC, buộc người dùng phải bấm "Connect Antigravity" thủ công mỗi lần khởi động lại ứng dụng.
**Alternative:** Lưu trữ trạng thái runtime kết nối (`is_connected: bool`) hoặc volatile tokens (CSRF, PID, Port) vào đĩa (gây rủi ro bảo mật nghiêm trọng và gây lỗi nếu Antigravity restart với PID/Port/CSRF mới).
**Impact:**
1. **Connection Intent Persistence:** Bổ sung trường cấu hình bền vững `auto_connect: bool` vào `AccountMonitorConfig` và `AccountQuotaSnapshot` với `#[serde(default = "default_true")]`, đảm bảo tương thích 100% ngược (backward compatibility) với các tài khoản cũ.
2. **Security Guarantee:** Tuyệt đối không lưu trữ hay tái sử dụng các dữ liệu tạm thời/nhạy cảm (PID, Port, CSRF token, session token). Quá trình kết nối lại luôn khám phá động runtime và xác thực identity (`runtime_email == expected_email`).
3. **Startup Reconnect Pass:** Tại Tauri `setup()`, ngay khi `AppHandle` được gắn vào `QuotaPollingEngine`, hệ thống thực hiện ngay một lượt đồng bộ khởi động (`reconnect_startup_accounts`) cho tất cả các tài khoản đang enabled và có `auto_connect == true`, bất kể chế độ auto-refresh định kỳ đang BẬT hay TẮT.
4. **Fail-Closed Identity Protection:** Trường hợp tài khoản trên Antigravity không khớp (mismatch email), hệ thống chuyển sang trạng thái `AuthRequired`, trả về 0 live models, không làm ô nhiễm cache và không bao giờ hiển thị sai quyền sở hữu quota.
5. **UI & User Control:** Bổ sung tùy chọn toggle *"Auto-connect on startup"* trong menu tác vụ của Account Card và tích hợp vào modal thêm tài khoản mới.
6. **Atomic Persistence:** Ghi file cấu hình tài khoản theo cơ chế atomic write (ghi file tạm `.tmp` rồi replace file chính) ngăn ngừa rủi ro file JSON bị hỏng khi tắt ứng dụng đột ngột.

## Decision #30
**Date:** 2026-08-16
**Title:** Real Weekly Quota Discovery, Dual-Window Integration & 2-Column High-Density UI Layout (AG-9.29)
**Reason:** Tích hợp dữ liệu Weekly Quota thật từ Antigravity runtime song song với quota ngắn hạn 5 giờ, đồng thời tái cấu trúc UI Quota Dashboard theo bố cục 2 cột với các thẻ quota group nằm ngang (horizontal tiles), loại bỏ hoàn toàn mock data và bảo vệ tuyệt đối tính cô lập danh tính (identity isolation).
**Alternative:** Dùng dữ liệu giả lập (mock data) hoặc tính toán Weekly Quota bằng cách suy diễn từ quota 5 giờ (vi phạm nguyên tắc Data Correctness).
**Impact:**
1. **Authoritative Runtime Endpoint:** Khám phá và tích hợp endpoint Connect-RPC `/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary`, trả về trực tiếp các quota bucket: `"5h"` (5-hour limit) và `"weekly"` (weekly limit) kèm theo `remainingFraction` và `resetTime` chuẩn xác của Google AI runtime.
2. **Dual-Window Domain Model:** Mở rộng `ModelQuota` với `weekly_remaining_fraction`, `weekly_remaining_percentage`, `weekly_reset_at` và `Vec<QuotaWindowInfo>`, cho phép biểu diễn đa cửa sổ quota (multi-window) một cách tổng quát và mở rộng.
3. **2-Column Responsive High-Density Layout:** Triển khai layout 2 cột độc lập (`grid-cols-1 lg:grid-cols-2 gap-3.5 items-start`), mỗi card chứa các thẻ quota group nằm ngang (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3`), tích hợp thanh tiến trình short-term (5h) và thanh tiến trình Weekly (sky blue) trên cùng một quota pool.
4. **Zero Mock Data & Fail-Closed Safety:** Mọi số liệu Weekly và 5h đều lấy trực tiếp từ `RetrieveUserQuotaSummary` và `GetUserStatus`. Khi xảy ra Identity Mismatch hoặc offline, toàn bộ quota đều bị ẩn (0 models, fail-closed) và không gây ô nhiễm cache.
5. **Unified Refresh Cycle:** Weekly Quota và 5h Quota được làm mới đồng thời trong cùng một chu kỳ polling của `QuotaPollingEngine`, không tạo thêm timer hay thread ngầm dư thừa.

