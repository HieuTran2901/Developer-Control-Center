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
**Reason:** Chẩn đoán lỗi AG-9.13 từ Google token exchange xác nhận phản hồi `error='invalid_request', description='client_secret is missing.'` do Client ID trước đó (`1071006060591-...`) thuộc loại Confidential Client (Web Application proxy của Cloud Code). Client ID `884354919052-redacted.apps.googleusercontent.com` được khám phá trực tiếp từ module `[AuthProvider]` và `Keyring LoadStoredToken` của Antigravity binary là Native Desktop Public Client hỗ trợ PKCE trực tiếp không cần `client_secret`.
**Alternative:** Giữ nguyên client cũ hoặc giả mạo bí mật (bị từ chối vì vi phạm nguyên tắc bảo mật).
**Impact:** Client ID mặc định của DCC được chuyển sang `884354919052-redacted.apps.googleusercontent.com`.

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

## Decision #31
**Date:** 2026-08-16
**Title:** Structured Semantic Slot Layout & Vertical Alignment for Quota Group Cards (AG-9.30)
**Reason:** Khắc phục hiện tượng lệch hàng (vertical misalignment) của thẻ quota GPT-OSS 120B so với Claude và Gemini trong cùng một tài khoản. Hiện tượng này xuất phát từ việc sử dụng `justify-between` khiến thẻ không có nút mở rộng danh sách model con (`group.isShared == false`) bị đẩy phần Weekly xuống tận đáy thẻ.
**Alternative:** Dùng khoảng cách cứng (hard-coded margin-top/padding-top) hoặc chèn dữ liệu Weekly giả lập cho thẻ thiếu (vi phạm nguyên tắc Responsive và Data Correctness).
**Impact:**
1. **Semantic Slot Layout:** Cấu trúc mỗi thẻ quota group thành 3 slot chuẩn:
   - Slot 1: Short-term section (Header + 5h Progress Bar + Metadata)
   - Slot 2: Weekly section (Header + Weekly Progress Bar + Reset Countdown) hoặc Reserved Slot (`min-h-[58px]`) nếu nhóm không có Weekly.
   - Slot 3: Footer slot có `mt-auto` (Collapsible trigger nếu `isShared == true` hoặc spacer giữ chuẩn baseline).
2. **Horizontal Grid Items-Stretch:** Đảm bảo tất cả các thẻ quota group trong cùng một hàng có chiều cao đồng đều (`items-stretch` + `h-full`), trong khi Weekly section luôn bắt đầu tại cùng một tọa độ Y trên mọi thẻ anh em.
3. **Zero Data/Provider Mutation:** Không thay đổi bất kỳ logic backend, provider, hay tính toán quota nào; hoàn toàn duy trì sự trung thực của dữ liệu runtime.

## Decision #32
**Date:** 2026-08-16
**Title:** Bounded Asynchronous Semaphore Dispatching & Dynamic Deadline Recalculation for Quota Auto Refresh (AG-9.32)
**Reason:** Khắc phục hiện tượng tài khoản kết nối bị bỏ sót (account starvation) trong luồng auto-refresh ngầm khi số lượng tài khoản đăng ký vượt quá giới hạn semaphore (`MAX_CONCURRENT_REFRESHES = 2`), và khắc phục lỗi lệch hạn chót làm mới (`next_refresh_at`) khi người dùng thay đổi khoảng thời gian polling (polling interval).
**Alternative:** Tăng `MAX_CONCURRENT_REFRESHES` lên bằng số lượng tài khoản (che giấu lỗi, gây bùng nổ tài nguyên) hoặc bỏ qua việc tính toán lại deadline snapshot (khiến UI đếm lùi về 00:00 nhưng backend không kích hoạt refresh).
**Impact:**
1. **Asynchronous Bounded Dispatching:** Trong background loop của `QuotaPollingEngine`, thay thế việc gọi `try_acquire_owned()` đồng bộ bằng tác vụ bất đồng bộ `tokio::spawn(async move { if let Ok(permit) = sem.acquire_owned().await { ... } })`. Nhờ đó, tài khoản ở vị trí sau (như tài khoản thứ 3 và 4) sẽ kiên nhẫn chờ permit và được refresh đầy đủ ngay khi permit được giải phóng, tuyệt đối không bị drop.
2. **Storm-Free Pre-Scheduling:** Ngay khi một chu kỳ batch được kích hoạt, deadline `snap.next_refresh_at` của tất cả các tài khoản hợp lệ được tạm thời tịnh tiến về tương lai (`now_ts + interval_seconds`) trong cache `snapshots`, ngăn chặn triệt để hiện tượng vòng lặp 1 giây bị kích hoạt liên tục (polling storm) khi các tác vụ đang chờ permit.
3. **Dynamic Snapshot Deadline Synchronization:** Khi hàm `update_refresh_settings()` được gọi, hệ thống cập nhật đồng thời cả `next_global_refresh` lẫn toàn bộ `snap.next_refresh_at` của các snapshot trong bộ nhớ, đảm bảo nhịp đếm lùi trên UI và điều kiện kích hoạt backend luôn đồng bộ 100%.

## Decision #33
**Date:** 2026-08-16
**Title:** Canonical Account Ordering & Stable Identity Contract Across Presentation Boundaries (AG-9.34)
**Reason:** Khắc phục hiện tượng vị trí thẻ tài khoản bị xáo trộn giữa các lần khởi động DCC do thứ tự duyệt `HashMap` ngẫu nhiên trong Rust, hiện tượng nhầm lẫn account trong công cụ chẩn đoán do sử dụng `snapshots[0]`, và hiện tượng xáo trộn các nhóm quota tile do thứ tự trả về từ RPC.
**Alternative:** Dùng mảng cố định không phân tầng hoặc khóa vị trí trên localStorage (dễ lỗi thời, không giải quyết được nguồn dữ liệu backend).
**Impact:**
1. **Backend Canonical Ordering (`createdAt ASC -> accountId ASC`):** `AccountRegistry::list()` và `save_internal()` luôn sắp xếp danh sách tài khoản theo thứ tự tạo tăng dần, lấy `account_id` làm tiêu chí phụ. File `account_registry.json` duy trì thứ tự cố định và nhất quán trên đĩa.
2. **Frontend Invariant Snapshot Merging (`sortSnapshots`):** `QuotaDashboard.tsx` chuẩn hóa toàn bộ danh sách `snapshots` qua hàm `sortSnapshots()`, bảo đảm mọi sự kiện cập nhật bất đồng bộ (`quota:account-updated`) và các chu kỳ refresh đều giữ nguyên vị trí thẻ trên UI.
3. **Explicit Diagnostic & Modal Targeting:** Xóa bỏ hoàn toàn fallback nguy hiểm `snapshots[0]?.accountId`; thay vào đó sử dụng target ID tường minh kèm bộ chọn tài khoản (account selector) khi có nhiều tài khoản.
4. **Deterministic Quota Group & Model Hierarchy:** `groupModelsIntoQuotaPools()` sắp xếp các nhóm quota theo cấp bậc họ mô hình chuẩn (`Gemini -> Claude -> GPT -> DeepSeek -> Other`), đồng thời sắp xếp tên các model con theo thứ tự ABC.

## Decision #34
**Date:** 2026-08-16
**Title:** Quota Subsystem Integration Polish & Runtime State Synchronization (AG-9.36)
**Reason:** Nâng cao tính nhất quán trạng thái UI và trải nghiệm thời gian thực khi thực hiện Refresh All và quản lý vòng đời tài khoản quota.
**Alternative:** Giữ trạng thái tải độc lập cho từng thẻ hoặc bỏ qua loading state của từng thẻ khi làm mới toàn bộ.
**Impact:**
1. **Synchronized Refresh Indicator:** Khi người dùng bấm "Refresh All", thuộc tính `isRefreshing` của tất cả các `QuotaAccountCard` được kích hoạt đồng bộ (`refreshingAccountId === snap.accountId || isRefreshingAll`), cung cấp phản hồi trực quan tức thì trên toàn bộ giao diện dashboard.
2. **End-to-End State Machine Hardening:** Bảo toàn tuyệt đối các bất biến định danh từ AG-9.28 đến AG-9.35 (Identity isolation, fail-closed mismatch, dual window 5h+weekly, auto-refresh bounded concurrency).

## Decision #35
**Date:** 2026-08-16
**Title:** Account Removal Invariant & Late Event Resurrection Protection (AG-9.40)
**Reason:** Ngăn chặn triệt để hiện tượng tài khoản đã bị xóa bị tái xuất hiện (resurrect) trên giao diện do sự kiện `quota:account-updated` đến muộn từ một tác vụ làm mới ngầm đang chạy dở (in-flight), và đảm bảo bộ chọn chẩn đoán (diagnostics selector) không lưu giữ ID của tài khoản đã xóa.
**Alternative:** Cho phép sự kiện tự do append vào mảng snapshot và chờ đợt tải lại trang để tự sửa lỗi (gây giật lag giao diện và rủi ro hiển thị dữ liệu mồ côi).
**Impact:**
1. **Frontend Registered Account Gate:** Trong `onAccountUpdated`, nếu `accountId` không tồn tại trong danh sách snapshot hiện hành (`index < 0`), sự kiện sẽ bị bỏ qua (`return prev;`) thay vì tự động append.
2. **Backend Registry Verification Gate:** Trong `execute_account_refresh`, sau khi tác vụ hoàn thành và giải phóng cờ `in_flight`, hệ thống kiểm tra `registry.get(&acc.account_id).await.is_none()`. Nếu tài khoản đã bị xóa khỏi registry, snapshot sẽ không được ghi đè vào cache `snapshots` và sự kiện `quota:account-updated` sẽ không được phát ra.
3. **Diagnostic Target Invalidation:** Trong `handleRemoveAccount`, nếu tài khoản đang được chọn trong bảng chẩn đoán bị xóa, trạng thái `selectedDiagnosticAccountId` và `verificationResult` sẽ lập tức được làm rỗng.

## Decision #36
**Date:** 2026-08-16
**Title:** Quota Subsystem Canonical Invariants & Release Freeze (AG-9.41)
**Reason:** Thiết lập baseline hồi quy (regression baseline) chính thức và đóng băng subsystem AI Quota nhằm bảo vệ toàn bộ các bất biến kiến trúc (I1–I18) khỏi các thay đổi trong tương lai.
**Alternative:** Không đóng băng baseline, dẫn tới rủi ro các phase phát triển tiếp theo vô tình làm hỏng logic auto-refresh, định danh tài khoản hoặc thứ tự deterministic.
**Impact:**
1. **Canonical Invariant Framework (I1–I18):** Đóng băng 18 bất biến kiến trúc phân tầng (Identity I1-I5, Ordering I6-I8, Provider Isolation I9-I10, Polling Engine I11-I13, Removal & Lifecycle I14-I18).
2. **Subsystem Release Freeze:** Phân loại toàn bộ hệ thống AI Quota ở trạng thái `QUOTA_SUBSYSTEM_RELEASE_FROZEN`. Mọi thay đổi chức năng Quota trong tương lai bắt buộc phải chạy qua ma trận kiểm thử hồi quy AG-9.41.

## Decision #37
**Date:** 2026-08-16
**Title:** Whole-Application Non-Quota Runtime Hardening & Invariant Alignment (AG-9.43)
**Reason:** Áp dụng các nguyên tắc bất biến (deterministic ordering, safe listener lifecycle, stable React key identity) từ Quota sang toàn bộ các subsystem khác trong Developer Control Center theo kết quả audit AG-9.42.
**Alternative:** Giữ nguyên các pattern cũ ở các module khác, dẫn tới nguy cơ xáo trộn thứ tự process, rò rỉ listener khi unmount nhanh hoặc React rendering artifact khi lọc findings.
**Impact:**
1. **Deterministic Process Registry (F-01):** `RuntimeRegistry::get_all()` chuẩn hóa thứ tự trả về theo `start_time ASC -> id ASC`, loại bỏ tính ngẫu nhiên do `HashMap` gây ra.
2. **Leak-Proof Event Listener Lifecycle (F-02):** `PipelineContext.tsx` bảo đảm unregister listener ngay cả khi component unmount trước khi Promise `listen()` kịp resolve (`isMounted` guard + deferred `unsub()`).
3. **Stable Finding Identity (F-03):** `SecurityActiveFindings.tsx` chuyển từ `key={i}` sang `key={f.id}`, bảo đảm DOM state và hiệu ứng được giữ nguyên khi lọc kết quả scan.
4. **Deterministic History Tie-Breaker (F-04):** `PipelineHistoryStore::get_all_summaries()` bổ sung `pipeline_id ASC` làm tiêu chí sắp xếp phụ khi `updated_at_ms` bị trùng.

## Decision #38
**Date:** 2026-08-16
**Title:** Release Candidate Promotion & Production Baseline Readiness (AG-9.45)
**Reason:** Xác nhận toàn diện ứng dụng Developer Control Center đạt đầy đủ tiêu chuẩn tin cậy runtime, bảo toàn tuyệt đối AI Quota baseline (AG-9.41), hoàn thành hardening toàn hệ thống (AG-9.43), và xác nhận không có bất kỳ regression nào (AG-9.44).
**Alternative:** Tiếp tục ở trạng thái development không xác nhận RC, gây thiếu rõ ràng về mức độ ổn định của bản phát hành.
**Impact:**
1. **Release Candidate Promotion:** Phân loại toàn bộ Developer Control Center ở trạng thái `RELEASE_CANDIDATE_READY`.
2. **Cross-Subsystem Stability Guarantee:** Đóng băng toàn bộ các invariant định danh (I1–I18), thứ tự deterministic, quản lý tiến trình Windows Job Objects, cơ chế chống rò rỉ event listener và hệ thống bảo mật không rò rỉ credential.

## Decision #39
**Date:** 2026-08-16
**Title:** Multi-Instance Runtime Discovery & Individual Account Quota Routing (AG-9.47)
**Reason:** Cho phép Developer Control Center phát hiện nhiều tiến trình Antigravity Language Server đang chạy song song (ví dụ: các profile IDE khác nhau) và định tuyến từng tài khoản giám sát (`AccountMonitorConfig`) tới đúng instance runtime tương ứng của nó thay vì giới hạn ở runtime đầu tiên tìm thấy.
**Alternative:** Dùng giải pháp chuyển đổi tài khoản tuần tự (destructive logout/login gây hỏng phiên làm việc của lập trình viên) hoặc gộp quota (vi phạm tính độc lập của từng tài khoản).
**Impact:**
1. **Multi-Instance Discovery Engine (`discover_all_runtimes`):** Quét toàn bộ cây tiến trình hệ thống, phát hiện tất cả các instance `language_server.exe`, trích xuất `--csrf_token`, quét cổng TCP lắng nghe động và sắp xếp theo PID tăng dần.
2. **Dynamic Email Identity Probing (`get_runtime_email` & `find_matching_runtime_for_email`):** Thăm dò Connect-RPC `/GetUserStatus` cho từng instance runtime để lấy `userStatus.email` xác thực thời gian thực.
3. **Targeted Quota Dispatch:** Định tuyến lệnh làm mới quota của tài khoản tới đúng runtime instance có email khớp (`runtime_email == expected_email`). Nếu tài khoản không có runtime nào đang chạy, hệ thống fail-closed an toàn thành `AuthRequired` (0 live models) mà không gây ảnh hưởng tới các tài khoản khác đang hoạt động.
4. **Deterministic Tie-Breaker:** Nếu có nhiều runtime instance báo cáo cùng một email, runtime có PID nhỏ nhất sẽ được chọn có tính tất định.

## Decision #40
**Date:** 2026-08-16
**Title:** Google OAuth Primary + Antigravity Fallback Quota Architecture (AG-9.49)
**Reason:** Tích hợp Google OAuth / Cloud Code làm nguồn lấy quota chính (Primary), cho phép Developer Control Center giám sát quota đa tài khoản độc lập ngay cả khi không có bất kỳ tiến trình Antigravity IDE nào đang chạy, đồng thời giữ nguyên hệ thống Antigravity Language Server làm nguồn dự phòng cục bộ (Fallback) độc lập cho từng tài khoản.
**Alternative:** Thay thế hoàn toàn Antigravity bằng Google OAuth hoặc ngược lại, làm mất tính năng hoạt động offline/local khi không có kết nối OAuth.
**Impact:**
1. **GoogleCloudCodeQuotaProvider (PRIMARY):** Sử dụng Google OAuth 2.0 PKCE, lưu trữ refresh token độc lập theo từng tài khoản trong OS Keyring (`KeyringCredentialStorage`), tự động làm mới access token trên RAM và truy vấn Cloud Code API (`https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist`).
2. **AntigravityQuotaProvider (FALLBACK):** Tự động kích hoạt làm fallback độc lập cho từng tài khoản khi tài khoản chưa cấu hình OAuth, token hết hạn hoặc kết nối Google Cloud Code gặp lỗi mạng/timeout.
3. **Per-Account Independent Fail-Closed Safety:** Fallback được thực hiện theo phạm vi từng tài khoản riêng biệt, kiểm tra nghiêm ngặt `runtime_email == expected_email`. Tuyệt đối không xảy ra tình trạng lỗi ở tài khoản này dẫn đến lấy nhầm quota của tài khoản khác.

## Decision #41
**Date:** 2026-08-16
**Title:** Google OAuth Account Connection UX & Multi-Account Management (AG-9.51)
**Reason:** Cung cấp trải nghiệm người dùng liền mạch để kết nối, kết nối lại hoặc ngắt kết nối Google OAuth trực tiếp từ giao diện Quota Dashboard mà không yêu cầu nhập thủ công bất kỳ token nào, đồng thời hiển thị minh bạch nguồn cung cấp quota (Primary Google Cloud Code vs Fallback Antigravity) trên từng card tài khoản.
**Alternative:** Bắt buộc người dùng nhập token hoặc chỉ cho phép một tài khoản Google duy nhất trên toàn ứng dụng.
**Impact:**
1. **One-Click Google Connect Modal (`AddAccountModal.tsx`):** Cho phép người dùng thêm tài khoản Google chỉ với 1 click xác thực qua trình duyệt mặc định sử dụng PKCE S256 và máy chủ loopback cục bộ an toàn.
2. **Dynamic Provider Badges (`QuotaAccountCard.tsx`):** Thẻ tài khoản hiển thị rõ nguồn dữ liệu `Google Cloud Code · Primary` (màu xanh dương) hoặc `Antigravity · Fallback` (màu xanh lá).
3. **Independent Disconnect Action (`quota_disconnect_google_account_cmd`):** Cho phép ngắt kết nối credential Google OAuth của tài khoản khỏi OS Keyring mà không xóa bỏ tài khoản khỏi danh mục quản lý DCC (tự động chuyển về trạng thái dự phòng Antigravity).

## Decision #42
**Date:** 2026-08-16
**Title:** Google OAuth Client Secret Backend Configuration & Token Exchange Hardening (AG-9.52)
**Reason:** Xử lý lỗi `HTTP 400 Bad Request: client_secret is missing` từ endpoint token của Google (`https://oauth2.googleapis.com/token`) do Google yêu cầu cung cấp client_secret đối với OAuth client đã cấu hình trong quá trình trao đổi mã ủy quyền (`authorization_code`) và làm mới token (`refresh_token`).
**Alternative:** Bỏ qua PKCE hoặc yêu cầu người dùng nhập thủ công client_secret vào giao diện web (gây rò rỉ bảo mật nghiêm trọng).
**Impact:**
1. **Paired Backend Credentials (`DEFAULT_GOOGLE_CLIENT_SECRET`):** Cấu hình `client_secret` an toàn tại backend Rust, có thể ghi đè qua biến môi trường `DCC_GOOGLE_OAUTH_CLIENT_SECRET`.
2. **Strict Frontend Isolation:** `client_secret` tuyệt đối không bao giờ được gửi sang frontend, không nằm trong React state, không xuất hiện trong IPC events và không được ghi log.
3. **Robust Token Exchange & Refresh:** Cả `exchange_auth_code` (với PKCE S256 `code_verifier`) và `refresh_access_token` đều truyền đầy đủ `client_id` và `client_secret` tới Google Token Endpoint, giải quyết triệt để lỗi HTTP 400.

## Decision #43
**Date:** 2026-08-16
**Title:** Google Cloud Code Quota API Chaining & Post-OAuth State Hardening (AG-9.53)
**Reason:** Sửa lỗi phân giải quota từ Google Cloud Code API bằng cách chuỗi 2 bước `loadCodeAssist` (lấy metadata và project ID) -> `retrieveUserQuotaSummary` (lấy danh sách bucket quota 5H và Weekly thực tế); đồng thời cách ly trạng thái Primary / Fallback để ngăn chặn việc ghi đè trạng thái `AuthRequired` lên các tài khoản Google đã kết nối thành công.
**Alternative:** Tiếp tục đọc trực tiếp mảng models từ `loadCodeAssist` (không tồn tại trong REST schema) hoặc để fallback tự động biến tài khoản Google thành `AuthRequired` khi Antigravity IDE không chạy.
**Impact:**
1. **Two-Step Cloud Code API Query (`GoogleCloudCodeQuotaProvider`):** Gọi `POST /v1internal:loadCodeAssist` để trích xuất `cloudaicompanionProject`, sau đó gọi `POST /v1internal:retrieveUserQuotaSummary` với project ID để bóc tách chính xác các bucket quota (`remainingFraction`, `resetTime`, cửa sổ 5H và Weekly).
2. **Strict Identity Verification (`/oauth2/v2/userinfo`):** Kiểm tra email của người dùng được xác thực qua UserInfo API so với `expected_email` để đảm bảo fail-closed và cô lập 100% tài khoản.
3. **Primary / Fallback Decoupling (`QuotaProviderService`):** Tài khoản đã có token Google OAuth trong Keyring sẽ giữ nguyên danh tính Google Provider khi gặp lỗi mạng/quota tạm thời, không bị ép chuyển thành `AuthRequired` khi Antigravity IDE cục bộ không chạy.
4. **Zero-Race Account Connection (`AddAccountModal.tsx` & `quota_oauth.rs`):** Không tạo placeholder account trước khi hoàn tất xác thực OAuth trên trình duyệt; chỉ đăng ký tài khoản vào registry sau khi đã nhận và lưu trữ refresh token an toàn.

## Decision #44
**Date:** 2026-08-16
**Title:** Google OAuth Client Pairing Alignment & Provider-Specific Auth State Hardening (AG-9.54)
**Reason:** Đồng bộ chính xác cặp `client_id` và `client_secret` của Google OAuth backend để loại bỏ hoàn toàn lỗi `HTTP 401 invalid_client` từ Google Token Endpoint; đồng thời tách biệt hiển thị lỗi xác thực của Google Primary khỏi thông báo offline của Antigravity Local Runtime trên giao diện người dùng.
**Alternative:** Dùng chung một secret cho mọi client hoặc hiển thị chung tiêu đề "Antigravity Local Runtime Offline" cho mọi lỗi xác thực (gây hiểu lầm cho người dùng khi giám sát tài khoản không chạy IDE).
**Impact:**
1. **Accurate Client Credentials Pairing (`DEFAULT_GOOGLE_CLIENT_SECRET`):** Cấu hình `GOCSPX-REDACTED-OAUTH-SECRET-PRIMARY` khớp 100% với `DEFAULT_GOOGLE_CLIENT_ID` (`884354919052-redacted.apps.googleusercontent.com`), đảm bảo token exchange và refresh thành công tuyệt đối.
2. **Provider-Specific Error UI (`QuotaAccountCard.tsx`):** Khi tài khoản Google gặp lỗi xác thực hoặc chưa kết nối, giao diện hiển thị banner riêng biệt `Google Authentication Required` với nút hành động `Connect Google OAuth` trực tiếp trên card, không còn bị gộp nhầm thành `Antigravity Local Runtime Offline`.
3. **Full 0-IDE Independence:** Cho phép giám sát quota tài khoản Google độc lập 100% mà không cần khởi chạy Antigravity IDE.

## Decision #45
**Date:** 2026-08-16
**Title:** Google OAuth Re-Authorization & Invalid-Grant Recovery Hardening (AG-9.56)
**Reason:** Xử lý xác thực chuyên biệt khi refresh token của Google trả về `invalid_grant` (hết hạn hoặc bị thu hồi): phân loại rõ ràng trạng thái `ReauthorizationRequired`, ngăn chặn retry storm tự động làm quá tải endpoint, và triển khai quy trình re-authorization nguyên tử cho phép người dùng kết nối lại tài khoản trực tiếp trên giao diện mà không làm mất mát dữ liệu hoặc ảnh hưởng đến các tài khoản khác.
**Alternative:** Tiếp tục retry refresh token lỗi liên tục mỗi chu kỳ polling hoặc xóa sạch credential trước khi người dùng xác thực thành công.
**Impact:**
1. **Explicit `invalid_grant` Classification:** Trích xuất chi tiết mã lỗi từ Google Token Endpoint. Khi `error == "invalid_grant"`, chuyển trạng thái thành `ReauthorizationRequired` thay vì lỗi chung.
2. **Polling Storm Suppression:** Tự động bỏ qua các tài khoản `ReauthorizationRequired` trong chu kỳ refresh nền, ngăn chặn việc gọi vô ích tới Google API cho tới khi người dùng chủ động kết nối lại.
3. **Atomic Credential Replacement & Fail-Closed Validation:** Chỉ ghi đè Keyring credential sau khi exchange và kiểm tra identity thành công; thất bại không làm mất credential cũ.
4. **Dedicated Reauthorization UI:** Giao diện `QuotaAccountCard` hiển thị banner màu hổ phách `Google Reauthorization Required` cùng nút `Reconnect Google Account`.

## Decision #46
**Date:** 2026-08-16
**Title:** OAuth Credential Lifecycle Repair & Provider-State Correction (AG-9.58)
**Reason:** Ngăn chặn tuyệt đối việc lưu nhầm `access_token` vào ô chứa `refresh_token` trong Windows Credential Manager khi Google không trả về refresh token trên các lần đăng nhập lại; đồng thời sửa lỗi hiển thị badge trạng thái trên frontend để không bao giờ hiển thị "Antigravity Offline" cho tài khoản Google đang yêu cầu xác thực.
**Alternative:** Cho phép fallback lưu access token tạm thời (gây lỗi `invalid_grant` ngay chu kỳ refresh tiếp theo) hoặc giữ nguyên badge cứng nhắc trên UI.
**Impact:**
1. **Strict Token Separation Invariant (`quota_oauth.rs`):** Tuyệt đối chỉ lưu trữ refresh token thực thụ vào Keyring. Nếu Google không trả về refresh token, hệ thống giữ nguyên token cũ hợp lệ hoặc yêu cầu re-consent đầy đủ qua `access_type=offline&prompt=consent`.
2. **Decoupled Status Badge Rendering (`QuotaAccountCard.tsx`):** Hàm `renderStatusBadge` nhận diện chính xác `isGooglePrimary` để hiển thị `Google Auth Required` hoặc `Reauthorization Required`, giải quyết dứt điểm hiện tượng rò rỉ nhãn "Antigravity Offline" trên các card tài khoản Google.
3. **0-IDE Independence & Multi-Account Isolation:** Đảm bảo toàn bộ hệ sinh thái tài khoản Google hoạt động ổn định và lâu dài ngay cả khi Antigravity IDE hoàn toàn đóng.

## Decision #47
**Date:** 2026-08-16
**Title:** DCC-Owned Google OAuth Multi-Account Production Architecture (AG-9.60)
**Reason:** Hoàn thiện kiến trúc giám sát quota đa tài khoản Google độc lập 100% bằng Google OAuth 2.0 Desktop Client do DCC làm chủ sở hữu: sử dụng PKCE S256 + Loopback Listener, truy vấn trực tiếp Google Cloud Code API (`loadCodeAssist` và `retrieveUserQuotaSummary`), lưu trữ refresh token bảo mật theo từng `accountId` trong OS Keyring, đảm bảo 0 phụ thuộc vào Antigravity IDE hay `language_server.exe`.
**Alternative:** Tiếp tục phụ thuộc vào việc trích xuất session/credential từ `language_server.exe` của Antigravity (yêu cầu người dùng phải mở từng cửa sổ IDE riêng biệt cho từng tài khoản).
**Impact:**
1. **DCC-Owned OAuth Configuration:** Cấu hình OAuth Desktop Client hỗ trợ cả biến môi trường `DCC_GOOGLE_CLIENT_ID` / `DCC_GOOGLE_CLIENT_SECRET` lẫn fallback constants an toàn cho môi trường Desktop.
2. **Zero-IDE Operation:** Người dùng kết nối 1, 2, hoặc N tài khoản Google và theo dõi quota 5H/Weekly độc lập trong thời gian thực mà không cần mở bất kỳ tiến trình Antigravity nào.
3. **Strict Account & Credential Isolation:** Mỗi tài khoản được cách ly tuyệt đối từ Keyring (`<accountId>.developer-control-center:antigravity-oauth`), bộ nhớ đệm token, đến quá trình polling nền có giới hạn luồng (`MAX_CONCURRENT_REFRESHES = 2`).
4. **Resilience & Fallback Preservation:** Duy trì cơ chế Antigravity Local Runtime làm Fallback độc lập khi người dùng cấu hình giám sát tiến trình nội bộ, không làm xáo trộn hoặc làm rò rỉ trạng thái giữa các provider.

## Decision #48
**Date:** 2026-08-16
**Title:** Canonical Google OAuth Environment Credential Migration (AG-9.61)
**Reason:** Thiết lập `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` làm nguồn cấu hình chính tắc (canonical authority) cho toàn bộ quy trình Google OAuth Desktop Client trong DCC; loại bỏ phân tán logic đọc biến môi trường bằng cách tập trung vào `GoogleOAuthConfig::resolve()`.
**Alternative:** Đọc rời rạc các biến môi trường tại từng service hoặc sử dụng hardcoded client ID/secret làm nguồn chính.
**Impact:**
1. **Canonical Configuration Resolver (`GoogleOAuthConfig`):** Một điểm định nghĩa duy nhất ưu tiên `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, hỗ trợ tương thích ngược với các alias cũ, loại bỏ nguy cơ lệch cặp client ID / secret.
2. **Safe Diagnostics:** Các endpoint chẩn đoán chỉ báo cáo trạng thái `CONFIGURED` / `ABSENT` và fingerprint của Client ID, tuyệt đối không làm lộ Client Secret qua IPC, logs, hoặc UI.
3. **Architecture Preservation:** Bảo toàn 100% Invariants I1–I18, quy trình phân tách Access/Refresh Token, cách ly Keyring theo `accountId`, và khả năng hoạt động độc lập 0-IDE.

## Decision #49
**Date:** 2026-08-16
**Title:** Explicit Antigravity Provider Connection & Stale Credential Safe Recovery (AG-9.62)
**Reason:** Tách biệt rõ ràng hành động "Connect Antigravity" khỏi luồng "onRefresh" thông thường của Google Primary: tạo endpoint `quota_connect_antigravity_account_cmd` để chuyển đổi rõ ràng provider sang `Antigravity`, thực hiện discovery Antigravity Language Server theo PID/email và đọc quota qua Connect-RPC ngay lập tức; đồng thời đảm bảo stale credential cũ bị `invalid_grant` không làm tắc nghẽn luồng kết nối Antigravity hoặc polling nền.
**Alternative:** Dùng chung hàm `onRefresh` dẫn tới việc click "Connect Antigravity" vẫn bị backend điều hướng ngược về `GoogleCloudCodeQuotaProvider`.
**Impact:**
1. **Dedicated Antigravity Connection (`quota_connect_antigravity_account_cmd`):** Người dùng có thể chủ động chuyển tài khoản sang giám sát qua Antigravity Local Runtime chỉ bằng một cú click, ngay cả khi tài khoản Google OAuth trước đó đang ở trạng thái `AuthRequired`.
2. **Disambiguated Provider Dispatching (`QuotaProviderService`):** Khi `provider == GoogleCloudCode`, hệ thống ưu tiên Google Primary (và dùng Antigravity làm fallback khi runtime có sẵn). Khi `provider == Antigravity`, hệ thống kết nối thẳng Antigravity runtime và hiển thị đúng nhãn Antigravity.
3. **Atomic Credential Recovery:** Người dùng kết nối lại Google OAuth sẽ ghi đè triệt để token lỗi cũ bằng refresh token chuẩn mực có `prompt=consent`.

## Decision #50
**Date:** 2026-08-17
**Title:** Cloud Quota Multi-Account Runtime Hardening (AG-9.64)
**Reason:** Hoàn thiện cơ chế giám sát quota Google Cloud Code Primary đa tài khoản (3+ tài khoản Google) hoàn toàn độc lập, không phụ thuộc vào Antigravity IDE hay tiến trình `language_server.exe`. Mỗi tài khoản lưu refresh token riêng biệt trong OS Keyring, tự động refresh access token tạm thời trong bộ nhớ, truy vấn trực tiếp Google Cloud Code API (`loadCodeAssist` + `retrieveUserQuotaSummary`), và ánh xạ chính xác vào `AccountQuotaSnapshot`.
**Alternative:** Bắt buộc người dùng mở nhiều cửa sổ/profile Antigravity IDE cho từng tài khoản hoặc sử dụng cơ chế token dùng chung toàn cục.
**Impact:**
1. **0-IDE Complete Independence:** Cho phép giám sát quota thời gian thực của 1, 3, 5, 10 hoặc 20+ tài khoản Google độc lập mà không cần mở bất kỳ cửa sổ Antigravity IDE hay tiến trình language server nào.
2. **Strict Identity & Failure Isolation:** Lỗi xác thực (`invalid_grant`) hoặc lỗi mạng trên Tài khoản B chỉ ảnh hưởng tới Tài khoản B, hoàn toàn không làm gián đoạn hoặc làm sai lệch luồng quota của Tài khoản A hay C.
3. **Concurrency & Performance Hardening:** Áp dụng `tokio::sync::Semaphore(2)` (`MAX_CONCURRENT_REFRESHES = 2`) và cơ chế chống hồi sinh (resurrection protection) nhằm tối ưu băng thông mạng và ngăn chặn tình trạng thắt cổ chai API.

## Decision #51
**Date:** 2026-08-17
**Title:** Multi-Account Quota Management UI & Account Lifecycle (AG-9.65)
**Reason:** Hoàn thiện giao diện người dùng và vòng đời quản lý đa tài khoản Google Cloud Code / Antigravity trên frontend: hỗ trợ kết nối, kết nối lại (reconnect), ngắt kết nối (disconnect mà không xóa tài khoản DCC), đổi tên, bật/tắt tự động kết nối khi khởi động, làm mới độc lập từng card hoặc làm mới đồng loạt (Refresh All có kiểm soát luồng backend), hiển thị thời gian sync tương đối và cảnh báo dữ liệu cũ khi mất kết nối mạng.
**Alternative:** Tự tạo logic polling riêng trên frontend hoặc xoá cứng tài khoản khỏi DCC khi ngắt kết nối Google OAuth.
**Impact:**
1. **Full Account Lifecycle Management:** Cung cấp đầy đủ các thao tác vòng đời trực quan trên từng Card tài khoản và modal thêm tài khoản nhanh chóng bằng 1-click Google OAuth.
2. **Accurate Visual Status Presentation:** Tách biệt rõ ràng các trạng thái `Google Cloud Code · Primary`, `Antigravity · Fallback`, `Google Auth Required`, `Reauthorization Required`, `Account Identity Mismatch`, và `Offline/Error`.
3. **Stale Data Preservation:** Khi xảy ra lỗi mạng tạm thời, giao diện giữ nguyên số liệu quota trước đó kèm banner thông báo "Using last known quota", ngăn chặn hiện tượng nhấp nháy hoặc biến mất dữ liệu bất ngờ.

## Decision #52
**Date:** 2026-08-17
**Title:** Multi-Account Production Validation & Observability (AG-9.66)
**Reason:** Kiểm chứng và nghiệm thu toàn diện hệ thống giám sát đa tài khoản trong điều kiện vận hành sản xuất thực tế: bảo toàn 100% Invariants I1–I18, kiểm chứng tính độc lập hoàn toàn 0-IDE, kiểm soát phân tách token nghiêm ngặt, cách ly lỗi giữa các tài khoản, cơ chế lưu/khôi phục dữ liệu an toàn qua Windows Credential Manager, và phát sự kiện telemetry an toàn không chứa bí mật.
**Alternative:** Dừng ở mức kiểm thử đơn vị cục bộ mà không kiểm chứng đầy đủ các kịch bản thực tế (restart, partial failure, network timeout, late-response resurrection).
**Impact:**
1. **Production-Grade Reliability:** Hệ thống chứng minh khả năng giám sát đồng thời 3, 5, 10, hoặc 20+ tài khoản Google độc lập với 0 tiến trình Antigravity IDE, tự động cách ly lỗi khi 1 tài khoản mất quyền mà không gây ảnh hưởng tới các tài khoản còn lại.
2. **Deterministic Data Integrity:** Đảm bảo tính toàn vẹn 1-1 từ cấu hình tài khoản, Keyring OS, Google UserInfo API, đến `ModelQuota` và giao diện người dùng.
3. **Zero Credential Exposure:** Cam kết tuyệt đối không làm lộ token, access header, hay client secret qua bất kỳ kênh log, IPC, hay UI state nào.

## Decision #53
**Date:** 2026-08-17
**Title:** Antigravity Multi-Runtime Identity Binding & Account Assignment (AG-9.67)
**Reason:** Xây dựng cơ chế phát hiện danh tính runtime động và gán ghép chính xác giữa tài khoản DCC và tiến trình Antigravity `language_server.exe` tương ứng: phát hiện tất cả các runtime đang chạy, truy vấn `POST /GetUserStatus` để lấy `userStatus.email`, và thực hiện so khớp email nghiêm ngặt (`find_matching_runtime_for_email`). Nếu runtime thuộc tài khoản Google khác, hệ thống báo `Account Identity Mismatch` và tuyệt đối không bao giờ hiển thị sai lệch quota của runtime khác lên card tài khoản.
**Alternative:** Gán runtime đầu tiên tìm thấy (`firstRuntime`) cho bất kỳ tài khoản nào bấm "Connect Antigravity", gây ô nhiễm dữ liệu quota chéo giữa các tài khoản.
**Impact:**
1. **Strict Identity Isolation:** Mỗi runtime Antigravity chỉ được bind vào tài khoản có email trùng khớp 100%. Không bao giờ gán nhầm quota của Runtime B cho Tài khoản A.
2. **Multi-Runtime Coexistence:** Hỗ trợ phát hiện và ghép cặp nhiều runtime Antigravity khác nhau chạy đồng thời trên máy, phân bổ độc lập cho từng card tài khoản DCC.
3. **Detailed Diagnostic Reporting:** Báo cáo chi tiết danh tính runtime đang chạy trên máy khi xảy ra mismatch, giúp người dùng dễ dàng nhận biết và đăng nhập đúng tài khoản trên Antigravity IDE.

## Decision #54
**Date:** 2026-08-17
**Title:** Cloud-Direct Multi-Account Quota Provider (AG-9.68)
**Reason:** Hoàn thiện và chuẩn hoá provider giám sát quota đám mây trực tiếp (Cloud-Direct Quota Provider) cho Google Cloud Code: kết nối thẳng HTTPS tới các endpoint nội bộ của Google Cloud Code (`loadCodeAssist` và `retrieveUserQuotaSummary`) thông qua Access Token tạm thời được làm mới từ Refresh Token lưu an toàn trong OS Keyring của từng tài khoản, loại bỏ 100% sự phụ thuộc vào Antigravity IDE hay tiến trình `language_server.exe`.
**Alternative:** Tiếp tục phụ thuộc vào Language Server RPC cục bộ đòi hỏi người dùng phải mở IDE cho từng tài khoản.
**Impact:**
1. **Zero-IDE Independence:** Cho phép giám sát quota chính xác của 1, 3, 5, 10 hoặc 20+ tài khoản Google mà không cần bất kỳ tiến trình Antigravity nào chạy trên máy.
2. **Strict Per-Account Pipeline:** Mỗi tài khoản được cấp phát luồng truy vấn độc lập, kiểm tra danh tính UserInfo email chặt chẽ, kiểm soát tốc độ qua `tokio::sync::Semaphore(2)`, và bảo lưu dữ liệu cũ an toàn khi mất mạng tạm thời.
3. **Additive Architecture:** Giữ nguyên vẹn Antigravity Local Runtime làm giải pháp Fallback tùy chọn, không gây xung đột với kiến trúc nền tảng.

## Decision #55
**Date:** 2026-08-17
**Title:** Cloud Quota Runtime Truth Verification (AG-9.69)
**Reason:** Thực hiện xác minh tính trung thực và toàn vẹn tuyệt đối của chu trình dữ liệu quota từ API Google Cloud Code đến giao diện người dùng: kiểm chứng 15 bước trace khép kín, phân tách chính xác cửa sổ quota 5 giờ và hàng tuần (Weekly), xác nhận không có trạng thái chia sẻ (zero shared state) giữa các tài khoản, và bảo đảm an toàn bảo mật không lộ bất kỳ token nào.
**Alternative:** Dừng ở mức kiểm thử giả lập mà không chứng minh tính toàn vẹn của chuỗi dữ liệu thực tế.
**Impact:**
1. **End-to-End Truth Trace:** Chứng minh sự tương ứng 1-1 từ phản hồi thô của Google (`loadCodeAssist` + `retrieveUserQuotaSummary`) qua `ModelQuota` và `AccountQuotaSnapshot` tới `QuotaAccountCard`.
2. **Deterministic Data Integrity:** Khẳng định 100% không có biến toàn cục, không dùng chung header hay cache, đảm bảo tính biệt lập hoàn toàn giữa các tài khoản.
3. **Verified Failure & Concurrency Models:** Kiểm chứng thành công ma trận lỗi (Scenarios A–G) và giới hạn đồng thời `MAX_CONCURRENT_REFRESHES = 2`.

## Decision #56
**Date:** 2026-08-17
**Title:** Intelligent Multi-Account Quota Orchestration (AG-9.70)
**Reason:** Xây dựng tầng điều phối đa tài khoản thông minh (Quota Orchestration Layer) hoàn toàn dựa trên dữ liệu quota thực tế đã qua xác thực: tính toán trạng thái sức khỏe hạn ngạch (Healthy, Warning, Critical, Exhausted), thuật toán xếp hạng tài khoản tất định dựa trên trọng số cửa sổ 5H (0.65) và Hàng tuần (0.35), công cụ cảnh báo tài khoản (Alert Engine), công cụ đếm ngược thời gian reset tập trung, và gợi ý tài khoản tối ưu (Optimal Recommended Account) hiển thị nổi bật trên Dashboard.
**Alternative:** Tổng hợp gộp hạn ngạch của nhiều tài khoản thành một chỉ số ảo (ảo tưởng tổng quota) hoặc hardcode các ngưỡng cảnh báo vào từng component React riêng lẻ.
**Impact:**
1. **Zero Data Fabrication:** Giữ nguyên tính toàn vẹn hạn ngạch độc lập của từng tài khoản, không tạo số liệu tổng hợp ảo, chỉ đưa ra đề xuất tài khoản tối ưu dựa trên điểm số thực tế.
2. **Centralized Time & Alert Engine:** Quản lý đếm ngược reset tập trung an toàn với clock skew, cảnh báo sớm khi quota giảm dưới 50% (Warning) hoặc 20% (Critical) hay khi reset sắp diễn ra trong 15 phút.
3. **Enhanced User Decision-Making:** Người dùng có thể ngay lập tức nhận biết tài khoản nào còn dồi dào quota nhất và thời điểm các tài khoản khác được reset để phân bổ công việc hiệu quả.

## Decision #57
**Date:** 2026-08-17
**Title:** Multi-Account Quota Dashboard V2 UI Architecture (AG-9.71)
**Reason:** Xây dựng giao diện Multi-Account Quota Dashboard V2 chuyên biệt cho hệ thống điều phối đa tài khoản thông minh theo chuẩn thiết kế desktop chuyên nghiệp: tích hợp Hero Card tài khoản tối ưu (Recommended Account), thanh tóm tắt chỉ số nhanh (Summary Metrics), bảng hạn ngạch đa tài khoản mật độ cao (Account Quota Table) với avatar và thanh tiến trình trực quan, bộ lọc trạng thái và tìm kiếm, cùng sidebar hiển thị cảnh báo thông minh (Smart Alerts), thao tác nhanh (Quick Actions) và thông tin chuyên sâu (Quota Insights). Toàn bộ giao diện V1 cũ được bảo toàn nguyên vẹn 100% làm fallback có thể chuyển đổi linh hoạt qua nút toggle.
**Alternative:** Ghi đè trực tiếp lên QuotaDashboard V1 gây nguy cơ hồi quy hoặc mất giải pháp fallback.
**Impact:**
1. **Non-Destructive V1/V2 Coexistence:** V1 và V2 cùng tồn tại độc lập, người dùng có thể chuyển đổi giữa V1 và V2 bất kỳ lúc nào với trạng thái lưu trong `localStorage`.
2. **Superior Multi-Account Scalability:** Bảng dữ liệu V2 tối ưu hiển thị mượt mà cho 1, 3, 5, 10 hoặc 20+ tài khoản mà không làm kéo dài màn hình quá mức.
3. **Instant Actionable Decision:** Trả lời trực quan câu hỏi "Nên dùng tài khoản nào ngay bây giờ?" trong vòng 2 giây thông qua Hero Card gợi ý tự động.

## Decision #58
**Date:** 2026-08-17
**Title:** Cloud-Direct Multi-Account Credential Binding & Provider Precedence (AG-9.72)
**Reason:** Thiết lập thứ tự ưu tiên nhà cung cấp hạn ngạch (Provider Precedence) tuyệt đối: Google Cloud Code / Google Primary luôn được ưu tiên hàng đầu cho mọi tài khoản có Google OAuth credential hợp lệ, hoàn toàn độc lập với các tiến trình `language_server.exe` cục bộ. Antigravity Local Runtime chỉ hoạt động như một fallback thuần túy khi có sự trùng khớp danh tính email chính xác (100% exact match) hoặc khi người dùng cấu hình thủ công.
**Alternative:** Cho phép cơ chế fallback quét qua các tiến trình `language_server.exe` của tài khoản khác gây ra cảnh báo `Account Identity Mismatch` sai lệch trên các tài khoản Google Primary.
**Impact:**
1. **True 0-IDE Multi-Account Operation:** Mọi tài khoản Google kết nối OAuth độc lập đều truy xuất hạn ngạch Cloud Code trực tiếp qua HTTPS mà không cần bất kỳ Antigravity IDE hay `language_server.exe` nào đang chạy.
2. **Strict Identity Isolation:** Credential của từng tài khoản được cô lập tuyệt đối theo namespace `accountId` trong OS Keyring, không chia sẻ access token hay Authorization header.
3. **Clean Error Separation:** Khi thiếu Google OAuth credential, hệ thống hiển thị chính xác trạng thái `Google OAuth connection required` thay vì rơi vào nhánh fallback cục bộ gây cảnh báo mismatch giả mạo.

## Decision #59
**Date:** 2026-08-17
**Title:** Cloud Credential Recovery & UI State Mapping Correction (AG-9.73)
**Reason:** Chuẩn hóa quy tắc hiển thị trạng thái tài khoản trên giao diện Quota Dashboard V2: các nhãn `Connected` và `Healthy` chỉ được phép xuất hiện khi và chỉ khi `snapshot.status === 'Online' && snapshot.quota !== null`. Mọi trạng thái khác (`Checking`, `AuthRequired`, `NetworkError`, `ProviderError`, `RateLimited`, `Disabled`, `Stale`) phải được ánh xạ rõ ràng với nhãn, màu sắc và thông điệp chẩn đoán trực quan riêng biệt, không để rơi vào nhánh fallback mặc định gây nhầm lẫn. Đồng thời quy trình khôi phục xác thực OAuth theo phạm vi từng tài khoản (Account-Scoped OAuth Recovery) được chuẩn hóa với cơ chế thay thế refresh token nguyên tử trong Windows Credential Manager.
**Alternative:** Giữ nguyên nhánh fallback hiển thị `Connected`/`Healthy` khi dữ liệu quota chưa sẵn sàng hoặc bị lỗi kết nối mạng.
**Impact:**
1. **Zero Misleading UI States:** Loại bỏ hoàn toàn tình trạng tài khoản hiển thị "Connected/Healthy" trong khi hạn ngạch là "No data" hoặc đang gặp lỗi kết nối mạng.
2. **Deterministic Account Recovery:** Cho phép người dùng kết nối lại từng tài khoản độc lập mà không làm ảnh hưởng đến các tài khoản khác hay ghi đè sai namespace trong Keyring.
3. **Robust 10-Step Cloud Direct Pipeline:** Đảm bảo toàn bộ 10 bước xác thực danh tính, lấy token, loadCodeAssist và retrieveUserQuotaSummary phải hoàn tất thành công trước khi tài khoản được đánh dấu `Online`.

## Decision #60
**Date:** 2026-08-17
**Title:** Production Multi-Account Quota Architecture Validation (AG-9.74)
**Reason:** Hoàn tất gói kiểm thử xác thực môi trường sản xuất (Production Validation Suite) bao gồm 18 kịch bản nghiêm ngặt (Tests A đến R): xác thực 4 tài khoản hoạt động đồng thời, vận hành hoàn toàn độc lập với 0 Antigravity IDE / 0 `language_server.exe`, kiểm tra tính bền vững sau khởi động lại DCC / Windows, cô lập lỗi mạng cho từng tài khoản riêng lẻ, tự động làm mới access token khi hết hạn, xử lý refresh token không hợp lệ, bảo vệ nghiêm ngặt chống sai lệch danh tính (Identity Mismatch), loại bỏ hiện tượng tài khoản ma khi xóa tài khoản trong lúc polling, xử lý cạn kiệt quota, đếm ngược reset mượt mà, tính toán đề xuất tài khoản tối ưu tất định, điều tiết lưu lượng tự động với bộ đệm giới hạn `tokio Semaphore(2)`, và bảo mật tuyệt đối các token xác thực.
**Alternative:** Dừng ở mức kiểm thử đơn vị cơ bản mà không kiểm tra toàn diện các kịch bản lỗi biên và vòng đời khởi động lại ứng dụng.
**Impact:**
1. **Production-Hardened System:** Hệ thống giám sát hạn ngạch đa tài khoản DCC đạt độ tin cậy và ổn định chuẩn sản xuất cao nhất.
2. **Strict Cryptographic & Data Isolation:** Đảm bảo 100% không có sự rò rỉ token, nhiễm chéo trạng thái hay giả lập số liệu hạn ngạch giữa các tài khoản.
3. **Zero IDE Overhead:** Người dùng có thể theo dõi hạn ngạch của toàn bộ các tài khoản Google mà không cần mở bất kỳ IDE Antigravity nào.

## Decision #61
**Date:** 2026-08-17
**Title:** Cloud Code Response Compatibility & Provisioning State Handling (AG-9.76)
**Reason:** Xử lý tương thích triệt để các trạng thái phản hồi từ Google Cloud Code API (`loadCodeAssist` và `retrieveUserQuotaSummary`). Khi một tài khoản Google đã hoàn tất xác thực OAuth hợp lệ nhưng chưa được kích hoạt/cấu hình dự án Gemini Code Assist trên Google Cloud (trả về mảng bucket rỗng, HTTP 400 hoặc HTTP 404), hệ thống sẽ phân loại trạng thái này thành "Provisioning / Quota Unavailable" thay vì ném lỗi `UnsupportedResponse` dẫn đến cảnh báo `ProviderError / API error` gây hiểu lầm. Đồng thời đảm bảo `quota = null` tuyệt đối (không bịa đặt số liệu hạn ngạch giả 0% hay 100%) và tự động loại trừ tài khoản chưa có hạn ngạch khỏi danh sách đề xuất sử dụng.
**Alternative:** Ném lỗi ProviderError khi mảng bucket hạn ngạch rỗng hoặc giả lập số liệu hạn ngạch 100% cho tài khoản.
**Impact:**
1. **Accurate Provisioning State:** Tài khoản Google hợp lệ nhưng chưa có dự án Gemini Code Assist được hiển thị rõ ràng là "Sync Pending / Quota Pending" với thông điệp chẩn đoán chi tiết.
2. **Strict Quota Integrity:** Duy trì nguyên tắc bất biến "Không bịa đặt số liệu": khi Cloud Code không trả về bucket hợp lệ, `snapshot.quota` luôn là `None`/`null`.
3. **Seamless Recommendation Filter:** QuotaOrchestrationService tự động loại bỏ tài khoản có `quota === null` khỏi bảng xếp hạng gợi ý tối ưu.

## Decision #62
**Date:** 2026-08-17
**Title:** Antigravity Cloud-Direct Quota Provider Alignment (AG-9.79)
**Reason:** Căn chỉnh luồng truy xuất hạn ngạch Cloud-Direct của DCC trực tiếp vào cụm máy chủ Antigravity remote backend (`https://daily-cloudcode-pa.googleapis.com` với fallback `https://cloudcode-pa.googleapis.com`) cùng bộ siêu dữ liệu định danh Antigravity (`ideType: ANTIGRAVITY`, `ideVersion: 2.8.1`, `pluginType: GEMINI`, `subclientType: HUB`). Cơ chế này cho phép DCC truy xuất trực tiếp hạn ngạch của các tài khoản Google mà không cần phụ thuộc vào tiến trình `language_server.exe` hay ứng dụng Antigravity IDE cục bộ.
**Alternative:** Tiếp tục phụ thuộc vào kết nối local Connect-RPC tới `language_server.exe` hoặc chỉ truy vấn standard GCP endpoint.
**Impact:**
1. **True 0-IDE Antigravity Quota Monitoring:** Giám sát toàn bộ hạn ngạch Antigravity của các tài khoản Google hoàn toàn qua Cloud-Direct HTTPS với 0 Antigravity IDE / 0 `language_server.exe`.
2. **Deterministic Multi-Account Isolation:** Từng tài khoản Google sử dụng độc lập OAuth refresh token trong OS Keyring để lấy access token tạm thời và truy vấn hạn ngạch riêng biệt.
3. **Seamless Orchestration & UI Integration:** Dữ liệu hạn ngạch chuẩn hóa trực tiếp đưa vào QuotaOrchestrationService và QuotaDashboard V2 mà không thay đổi bất kỳ công thức hay thành phần giao diện nào.

## Decision #63
**Date:** 2026-08-17
**Title:** Pending Quota UX Enhancement & Contextual Guidance (AG-9.82)
**Reason:** Bổ sung thông điệp hướng dẫn ngữ cảnh (Contextual Tooltip) và tab bộ lọc chuyên biệt (`Pending`) cho các tài khoản Google đã xác thực OAuth thành công nhưng chưa có dự án Gemini Code Assist khả dụng (`status === 'Online' && quota === null`). Tránh tuyệt đối việc hiển thị cảnh báo lỗi sai lệch (như "OAuth Failed" hay "Provider Error"), đồng thời cho phép người dùng lọc nhanh danh sách các tài khoản đang chờ kích hoạt hạn ngạch mà không làm ảnh hưởng đến danh sách tài khoản Healthy hoặc Auth Required.
**Alternative:** Không có bộ lọc chuyên biệt, khiến tài khoản Sync Pending chỉ xuất hiện trong tab All mà không có giải thích lý do.
**Impact:**
1. **Clear Semantic Guidance:** Người dùng hiểu rõ tài khoản Google đã kết nối thành công và chỉ đang chờ dự án Cloud được kích hoạt hạn ngạch.
2. **Dedicated Discoverability:** Bộ lọc `Pending` cung cấp số đếm chính xác và lọc nhanh tài khoản Sync Pending.
3. **Zero Backend Regression:** Giữ nguyên 100% logic OAuth, Keyring, backend polling và thuật toán xếp hạng đề xuất.

## Decision #64
**Date:** 2026-08-17
**Title:** Google OAuth Reauthorization Credential Lifecycle Repair (AG-9.85)
**Reason:** Sửa lỗi vòng đời lưu trữ và kiểm tra chứng chỉ OAuth khi người dùng thực hiện kết nối lại (reconnect). Cụ thể:
1. Google OAuth URL thêm tham số `prompt=consent select_account` bắt buộc Google cấp mới `refresh_token` khi tái ủy quyền.
2. Cơ chế Transactional Credential Verification: kiểm tra tính hợp lệ của `refresh_token` trước khi lưu vào OS Keyring. Nếu Google không trả về `refresh_token` trên tài khoản có token cũ bị lỗi (`invalid_grant`), DCC sẽ loại bỏ token hỏng và yêu cầu cấp quyền mới thay vì giữ lại token hỏng.
3. Cập nhật chính xác `AccountRegistry::update` thay vì `register` khi sửa đổi tài khoản hiện có.
**Alternative:** Tiếp tục giữ lại refresh token cũ trong Keyring dẫn đến việc tài khoản bị Google từ chối `HTTP 400 invalid_grant` ngay sau khi OAuth thành công.
**Impact:**
1. **True Reauthorization Success:** Khi người dùng hoàn tất OAuth cho Account 3, chứng chỉ mới được xác thực trực tiếp và lưu trữ thành công.
2. **Deterministic Account ID Preservation:** Giữ nguyên ID tài khoản (`nakitosan912-gmail-com`) mà không tạo tài khoản trùng lặp.
3. **Multi-Account Credential Safety:** Đảm bảo 100% tính cô lập giữa các tài khoản và tuân thủ các bất biến I1–I18.

## Decision #65
**Date:** 2026-08-17
**Title:** Account Reconnect Credential Lifecycle Hardening & Stale Token Auto-Purge (AG-9.87)
**Reason:** Thiết lập cơ chế tự động xóa bỏ chứng chỉ hết hạn/bị thu hồi (`invalid_grant`) khỏi OS Keyring trong cả quá trình polling nền lẫn quy trình OAuth reconnect. Khi Google không trả về `refresh_token` trên tài khoản có chứng chỉ hỏng, DCC dứt khoát xóa token hỏng và chuyển trạng thái về `ReauthorizationRequired`, không cho phép bất kỳ tiến trình polling nào tải lại token hỏng. Đồng thời biên dịch lại toàn bộ executable binary của DCC trên đĩa.
**Alternative:** Không xóa token hỏng dẫn đến việc tiến trình nền liên tục tái sử dụng token đã chết và đưa tài khoản trở lại AuthRequired ngay sau khi kết nối.
**Impact:**
1. **Zero Dead Token Resurrection:** Token bị Google từ chối `invalid_grant` sẽ bị xóa hoàn toàn khỏi OS Keyring.
2. **Deterministic Generic Reconnect:** Hoạt động nhất quán cho mọi tài khoản Google mà không phụ thuộc vào bất kỳ hardcoding nào.
3. **Fresh Executable Binary:** Toàn bộ bản cập nhật Rust được biên dịch hoàn chỉnh vào `target/debug/developer-control-center.exe`.

## Decision #66
**Date:** 2026-08-17
**Title:** Google OAuth Account Add UI State Synchronization & Ingestion Guard (AG-9.90)
**Reason:** Khắc phục lỗi bất đồng bộ trạng thái giao diện React khi thêm tài khoản Google qua OAuth trong cửa sổ modal "Add AI Quota Account". Cụ thể:
1. `AddAccountModal`: Bổ sung callback xác định `onAccountAdded?: (accountId?: string) => Promise<void> | void`, kích hoạt trực tiếp ngay khi `quotaPollingService.connectGoogleAccount('new', true)` trả về `res.success === true` trước khi đóng modal, loại bỏ hoàn toàn cơ chế `setTimeout` chờ đợi không tất định.
2. Quota Dashboards (`MultiAccountQuotaDashboard` & `QuotaDashboard`): Cập nhật listener sự kiện `quota:account-updated` để tự động bổ sung (append) snapshot của tài khoản mới thay vì loại bỏ (`return prev`) khi chưa tìm thấy ID trong danh sách hiện tại.
3. Quản lý an toàn vòng đời xóa tài khoản (Removal & Stale Event Protection): Sử dụng `removedAccountIdsRef` để ngăn chặn các sự kiện trễ (stale in-flight events) làm tái sinh (resurrect) tài khoản đã bị người dùng xóa khỏi hệ thống.
**Alternative:** Dựa vào thao tác làm mới trang (page reload) hoặc khởi động lại ứng dụng để hiển thị tài khoản mới.
**Impact:**
3. **Strict Invariant & Isolation Preservation:** Bảo toàn 100% các bất biến I1–I18, bảo vệ tuyệt đối tính cô lập giữa các tài khoản và không làm thay đổi các quy tắc bảo mật OAuth PKCE.

## Decision #67
**Date:** 2026-08-17
**Title:** Google OAuth Refresh Token Acquisition & Atomic Credential Recovery (AG-9.92)
**Reason:** Ngăn chặn tuyệt đối việc tạo ra tài khoản "Connected" giả mạo hoặc rơi vào trạng thái `AuthRequired` ngay sau khi đăng nhập Google OAuth thành công mà không có `refresh_token` hợp lệ. Cụ thể:
1. **Phân định rạch ròi Thêm mới (New Account) vs Kết nối lại (Reconnect):**
   - **Tài khoản mới (New Account):** Bắt buộc Google phải trả về `refresh_token` hợp lệ và vượt qua bài kiểm tra xác thực trực tiếp (`refresh_access_token`). Nếu Google không trả về `refresh_token` (do tái sử dụng consent cũ), DCC hủy bỏ toàn bộ giao dịch (Atomic Rollback), không ghi vào Keyring, không đăng ký vào `account_registry.json`, và trả về lỗi kiểu `MissingRefreshToken` cùng hướng dẫn chi tiết người dùng hủy kết nối DCC tại `https://myaccount.google.com/connections` rồi thử lại.
   - **Kết nối lại (Reconnect):** Nếu có `refresh_token` mới, kiểm tra trước khi ghi đè; nếu Google không trả về `refresh_token` mới thì kiểm tra token hiện có trong Keyring. Nếu token cũ còn sống, giữ lại và cập nhật timestamp; nếu token cũ đã chết (`invalid_grant`), xóa sạch token hỏng khỏi Windows Credential Manager (bao gồm cả legacy generic target) và trả về `ReauthorizationRequired`.
2. **Loại bỏ hiện tượng Polling sớm (Premature Polling):** `refresh_account_now` chỉ được kích hoạt sau khi chứng chỉ đã được xác thực và lưu trữ thành công vào Keyring và Registry.
3. **Cải thiện trải nghiệm phục hồi lỗi (UX Recovery):** `AddAccountModal` hiển thị thẻ hướng dẫn ngữ cảnh trực quan khi Google không trả về `refresh_token`.
**Alternative:** Cho phép đăng ký tài khoản mới khi không có `refresh_token` khiến tài khoản bị biến thành `AuthRequired` ngay lập tức.
**Impact:**
3. **Zero Dead Token Resurrection:** Đảm bảo 100% token hỏng bị xóa hoàn toàn khỏi Windows Credential Manager.

## Decision #68
**Date:** 2026-08-17
**Title:** Google OAuth Programmatic Grant Revocation & Automated Grant Recovery (AG-9.94)
**Reason:** Giải quyết triệt để tình trạng bế tắc khi Google Authorization Server tái sử dụng consent grant cũ đã bị vô hiệu hóa trên backend Google, dẫn đến việc bỏ qua `refresh_token` (`refresh_token: None`) trong quá trình đăng nhập và làm tài khoản bị kẹt vĩnh viễn ở trạng thái `AuthRequired`. Cụ thể:
1. **Thu hồi Grant tự động qua Google Revoke Endpoint (`https://oauth2.googleapis.com/revoke`):** Khi Google trả về `access_token` nhưng bỏ qua `refresh_token` và tài khoản không có refresh token hợp lệ trong Keyring, DCC chủ động gọi Revoke API với `access_token` để hủy bỏ consent grant cũ trên máy chủ Google.
2. **Khai mở chu kỳ cấp mới Refresh Token (New Refresh Token Issuance):** Nhờ việc grant cũ đã bị thu hồi trực tiếp trên máy chủ Google, trong lần kết nối/kết nối lại tiếp theo, Google sẽ bắt buộc người dùng cấp quyền offline consent mới và trả về một `refresh_token` hoàn toàn mới.
3. **Cơ chế phục hồi tường minh (Explicit Grant Recovery State):** Thiết lập trạng thái `GrantRecoveryRequired` cho các tài khoản bị thu hồi chứng chỉ, hỗ trợ nút bấm phục hồi 1-click trên giao diện Quota Dashboard mà không làm đóng băng hay treo tiến trình polling nền.
**Alternative:** Bắt buộc người dùng phải tự điều hướng thủ công ra ngoài trình duyệt để tìm và xóa quyền của ứng dụng trong trang quản lý Google Account Connections.
**Impact:**
1. **Automated Grant Reset:** Xóa tan tình trạng bế tắc lặp lại vô tận (infinite re-auth loop) mà không đòi hỏi thao tác can thiệp phức tạp từ người dùng.
2. **Zero-Touch Consent Invalidation:** Tự động giải phóng consent cũ để Google Authorization Server cấp phát refresh token mới 100% hợp lệ.
3. **Strict Invariant & Isolation Preservation:** Bảo toàn tuyệt đối các bất biến I1–I18 và tính cô lập giữa các tài khoản.






































