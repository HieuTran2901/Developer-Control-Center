# Phase 2B — AI Gateway Foundation Audit

## 1. Current Architecture
Dự án Developer Control Center (DCC) hiện tại hoạt động theo mô hình Tauri 2 (Desktop App):
- **React Frontend**: Nằm tại `src/`, quản lý UI state và giao diện Settings -> AI Providers (`src/features/settings/`).
- **Tauri IPC Command**: Nằm tại `src-tauri/src/commands/ai_provider_cmds.rs`, đóng vai trò cầu nối giao tiếp IPC bất đồng bộ giữa React và Rust backend.
- **Rust Service Layer**: Nằm tại `src-tauri/src/ai/service.rs`, quản lý logic tổng thể cho AI Provider thông qua `MetadataStore` và `CredentialStore`.
- **OS Credential Store**: Đã được hoàn thành ở Phase 2A (`src-tauri/src/ai/credential_store.rs`), sử dụng crate `keyring` (Service: `developer-control-center:ai-provider`) để lưu trữ bí mật (API key) vào OS Keyring (Windows Credential Manager / Keychain / Secret Service).
- **HTTP Adapters**: Nằm tại `src-tauri/src/ai/adapters/`, hiện đã có adapter cho `openai`, `anthropic`, và `custom` để thực hiện kiểm tra kết nối (`test_connection`).

## 2. Existing AI Provider Flow
1. **User Input / Management**:
   - Trong giao diện Settings -> AI Providers, người dùng có thể Thêm (Add), Sửa (Edit), Xóa (Delete), Chọn mặc định (Set Default), và Test Connection cho từng AI Provider.
2. **Metadata Persistence**:
   - Thông tin Metadata của Provider (`id`, `name`, `providerType`, `model`, `baseUrl`, `enabled`, `isDefault`, `status`, `lastError`) được lưu trữ tại file JSON `{app_data_dir}/ai_providers.json` thông qua `MetadataStore`.
   - Structural Rule: Secret API Key **tuyệt đối không bao giờ xuất hiện** trong file JSON metadata này.

## 3. Existing Credential Flow
1. **Khởi tạo / Lưu trữ**:
   - Khi Form `AIProviderForm.tsx` Submit một Secret Key mới, payload gửi qua IPC command `ai_provider_create_cmd` hoặc `ai_provider_update_cmd`.
   - Rust command gọi `AIProviderService::create()` hoặc `update()`, trực tiếp đẩy Secret Key vào `OsCredentialStore` (OS Keyring via `keyring`).
2. **Truy xuất / Sử dụng**:
   - Secret Key được lấy trực tiếp trong môi trường Rust khi cần gọi HTTP (`service.test_connection()`).
   - Secret Key **tuyệt đối không bao giờ trả về React Frontend** (React chỉ nhận DTO `AIProviderConfig` không chứa Secret Key). Khi Edit, UI chỉ hiển thị chuỗi giả định `•••••••• (Configured securely)`.

## 4. Existing HTTP Layer
- **Client**: Sử dụng `reqwest::Client` (với `rustls` và `json` features) thiết lập thời gian Timeout cố định 10 giây (`Duration::from_secs(10)`).
- **Headers & Request Setup**:
  - `openai`: Gửi GET tới `{baseUrl}/models` (hoặc `{baseUrl}/v1/models`) với header `Authorization: Bearer <secret>`.
  - `anthropic`: Gửi GET tới `{baseUrl}/models` với header `x-api-key: <secret>` và `anthropic-version: 2023-06-01`.
  - `custom`: Gửi GET tới `{baseUrl}/v1/models` với header `Authorization: Bearer <secret>` (fallback về root URL nếu endpoint /models thất bại).
- **Trạng thái hiện tại**: Đã có HTTP request thật cho tính năng Test Connection, nhưng **chưa có unified AI Gateway**, **chưa có Retry Policy**, **chưa có Request/Response contract chung** cho AI Pipeline Builder (hiện các adapters mới dừng lại ở hàm `test_connection`).

## 5. Existing Test Connection
1. Frontend `AIProviders.tsx` gọi `aiProviderService.testConnection(id)`.
2. Frontend gọi Tauri IPC `invoke('ai_provider_test_connection_cmd', { id })`.
3. Rust `ai_provider_cmds.rs` chuyển tiếp tới `AIProviderService::test_connection(&id)`.
4. Rust cập nhật trạng thái tạm thời thành `AIProviderStatus::Testing`.
5. Rust đọc secret ngầm từ `self.credential_store.get_secret(id)`.
6. Rust gọi `adapters::test_provider_connection(...)` bằng `reqwest`.
7. Trả về kết quả thành công (`Connected`) hoặc thất bại (`Failed` kèm `last_error` đã được sanitize).

## 6. Existing DTOs
- **Rust DTOs** (`src-tauri/src/ai/models.rs`):
  - `ProviderType`: `OpenAI`, `Anthropic`, `Custom`
  - `AIProviderStatus`: `Untested`, `Testing`, `Connected`, `Failed`, `Disabled`
  - `AIProviderConfig`: Metadata công khai (không chứa key)
  - `CreateAIProviderInput` / `UpdateAIProviderInput`: DTO nhận dữ liệu từ Frontend
- **Frontend DTOs** (`src/features/settings/types/aiProvider.ts`):
  - `ProviderType`: `'openai' | 'anthropic' | 'custom'`
  - `AIProviderStatus`: `'UNTESTED' | 'TESTING' | 'CONNECTED' | 'FAILED' | 'DISABLED'`
  - `AIProvider`, `CreateAIProviderInput`, `UpdateAIProviderInput`

## 7. Existing Error Handling
- Rust `DesktopError` struct (`src-tauri/src/error.rs`) gồm: `kind: String`, `message: String`.
- Trong `adapters/`, lỗi HTTP được chuẩn hóa thành các `kind` như: `INVALID_CREDENTIALS`, `INVALID_BASE_URL`, `RATE_LIMITED`, `TIMEOUT`, `NETWORK_ERROR`, `PROVIDER_ERROR`.
- Thông báo lỗi an toàn, tuyệt đối không chứa Authorization header hay secret values.

## 8. Security Findings
- **Persistence Layer**: **PASS**. 100% Secret được cách ly trong OS Keyring (`keyring` crate).
- **Log Layer**: **PASS**. Không có log secret key hay bearer token ra console hay stdout.
- **IPC Boundary**: **PASS**. Trừ luồng Write một chiều từ Form khi user tạo/đổi key, không có IPC response nào trả secret key về React.
- **Frontend State**: **PASS**. Key chỉ nằm trong transient input state của form khi tạo mới, không lưu trong persistent React store hay browser storage (`localStorage`/`sessionStorage`).

## 9. Reusable Components
- `CredentialStoreTrait` và `OsCredentialStore` (Phase 2A) -> Tái sử dụng 100%.
- `MetadataStore` -> Tái sử dụng 100%.
- `reqwest::Client` setup trong `adapters/` -> Tái sử dụng và mở rộng thành Adapter Suite hoàn chỉnh.
- `AIProviderService` frontend & backend -> Tái sử dụng và tích hợp với `AIGateway`.

## 10. Required New Components (Cho Phase 2B Implementation)
1. **Unified AI Request & Response DTOs** (`src-tauri/src/ai/gateway/models.rs`):
   - `AIRequest`: `provider_id`, `model` (optional override), `messages`, `temperature`, `max_tokens`.
   - `AIMessage`: `role` (`"system"` | `"user"` | `"assistant"`), `content`.
   - `AIResponse`: `content`, `model`, `usage` (`prompt_tokens`, `completion_tokens`, `total_tokens`), `finish_reason`.
   - `AIError`: Unified error enum (`AuthenticationFailed`, `RateLimited`, `Timeout`, `NetworkError`, `ProviderUnavailable`, `InvalidRequest`, `CredentialNotFound`, `ProviderNotFound`).
2. **AI Provider Adapter Trait** (`src-tauri/src/ai/gateway/adapter.rs`):
   - `trait AIProviderAdapter: Send + Sync`: `fn provider_type(&self) -> ProviderType;`, `async fn test_connection(...)`, `async fn send_request(...)`.
3. **Provider Resolver & Registry** (`src-tauri/src/ai/gateway/resolver.rs`):
   - Quản lý việc ánh xạ từ `ProviderType` / `provider_id` sang đúng Adapter instance (`OpenAIAdapter`, `AnthropicAdapter`, `CustomAdapter`, `MockAIProviderAdapter`).
4. **AI Gateway Core** (`src-tauri/src/ai/gateway/core.rs`):
   - Trung tâm tiếp nhận `AIRequest`, giải mã Provider, lấy Secret từ `CredentialStore`, áp dụng Request Policy (Timeout & Bounded Retry Policy cho lỗi tạm thời 429/5xx, KHÔNG retry 401/403/400), gọi Adapter và map kết quả về `AIResponse` / normalized `AIError`.
5. **Mock AI Provider Adapter** (`src-tauri/src/ai/gateway/mock_adapter.rs`):
   - Phục vụ kiểm thử giả lập không cần mạng thật cho các lỗi 401, 429, timeout, success.
6. **Tauri IPC Command** cho AI Gateway (`src-tauri/src/commands/ai_gateway_cmds.rs`):
   - `ai_gateway_send_request_cmd(app, request)` -> Gửi AI request từ frontend nhưng lấy secret ngầm ở Rust.

## 11. Files Expected To Change / Create
### Files to Create:
- `src-tauri/src/ai/gateway/mod.rs`
- `src-tauri/src/ai/gateway/models.rs`
- `src-tauri/src/ai/gateway/adapter.rs`
- `src-tauri/src/ai/gateway/resolver.rs`
- `src-tauri/src/ai/gateway/core.rs`
- `src-tauri/src/ai/gateway/mock_adapter.rs`
- `src-tauri/src/ai/gateway/gateway_test.rs`
- `src-tauri/src/commands/ai_gateway_cmds.rs`

### Files to Modify:
- `src-tauri/src/ai/mod.rs` (Export gateway module)
- `src-tauri/src/commands/mod.rs` (Export `ai_gateway_cmds`)
- `src-tauri/src/lib.rs` (Register gateway state và `ai_gateway_send_request_cmd`)
- `src/application/services/AIProviderService.ts` (Bổ sung method `sendAIRequest` cho frontend wrapper)

## 12. Files Explicitly Out Of Scope
- Dashboard UI (`src/features/dashboard/`)
- Security UI & Engine (`src/features/security/`, `src-tauri/src/security/`)
- Terminal & Process Monitor (`src/features/terminal/`, `src-tauri/src/monitor/`, `src-tauri/src/runtime/`)
- Sidebar & Header Layout (`src/shared/components/layouts/`)
- AI Pipeline Builder UI & Pipeline Execution Engine (Tuyệt đối không xây dựng ở Phase này).

## 13. Dependency Assessment
- `reqwest` = `0.13.4` (Đã có sẵn)
- `tokio` = `1` (Đã có sẵn)
- `serde` = `1` / `serde_json` = `1` (Đã có sẵn)
- `keyring` = `2.1.0` (Đã có từ Phase 2A)
- **Kết luận Dependency**: **0 dependency mới cần thêm**. Mọi thư viện cần thiết đã sẵn sàng trong `Cargo.toml`.

## 14. Risks
- **Timeout & Retry contention**: Cần kiểm soát thời gian retry tránh khiến Tauri IPC thread bị treo lâu.
- **Provider API Format variation**: Payload response của OpenAI và Anthropic có cấu trúc JSON khác nhau. Cần bảo đảm Adapter map chính xác về `AIResponse` chung.

## 15. Implementation Plan Summary
1. Định nghĩa `AIRequest`, `AIResponse`, `AIError` DTOs.
2. Xây dựng Trait `AIProviderAdapter` và refactor Adapters (OpenAI, Anthropic, Custom, Mock).
3. Triển khai `ProviderResolver` và `AIGateway` tích hợp Retry Policy (chỉ retry 429, 502, 503, 504 tối đa 2 lần với backoff) và Timeout (15s).
4. Khai báo Tauri IPC command `ai_gateway_send_request_cmd` nhận `AIRequest` và trả về `AIResponse`.
5. Viết Unit Tests đầy đủ cho AIGateway (mock provider, retry, timeout, normalized error, no secret leak).

## 16. Verification Plan
1. **Unit Tests**: `cargo test` kiểm thử Resolver, Mock Provider, Retry, Error Normalization, và Security leakage check.
2. **Compilation**: `cargo check` và `npm run build` PASS 100%.
3. **Regression Check**: Đảm bảo các tính năng Settings AI Provider, Security, Process Monitor không bị suy giảm.

## 17. Final Audit Verdict
- Architecture hiện tại đã có nền tảng an toàn từ Phase 2A.
- Mọi điều kiện tiên quyết để triển khai Phase 2B (AI Gateway Foundation) đã sẵn sàng.
- **AUDIT STATUS: PASS & READY FOR APPROVAL**.
