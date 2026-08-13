# Phase 2B — AI Gateway Foundation Audit

## 1. Current Architecture
Hệ thống hiện tại đã hoàn thành **Phase 2A (Secure Credential Storage Migration)**:
- API Keys / Secrets được bảo mật 100% trong OS Credential Storage (Windows Credential Manager / Keychain / Secret Service via `keyring` crate) thông qua `CredentialStoreTrait`.
- Metadata của Provider (`id`, `name`, `model`, `baseUrl`, `isDefault`, `status`) được lưu trữ tại file JSON `{app_data_dir}/ai_providers.json` qua `MetadataStore`.
- React Frontend và Tauri IPC Commands hiện tại mới chỉ hỗ trợ CRUD Provider Metadata và kiểm tra kết nối (`test_connection`).
- Chưa có **Unified AI Gateway** tập trung để xử lý các AI Requests cho các tính năng trong tương lai (Pipeline Builder, Generation, Optimization).

## 2. Existing Components
- `src-tauri/src/ai/credential_store.rs`: `CredentialStoreTrait`, `OsCredentialStore`, `MockCredentialStore`, `LegacyXorMigrator`.
- `src-tauri/src/ai/metadata_store.rs`: `MetadataStore`.
- `src-tauri/src/ai/service.rs`: `AIProviderService`.
- `src-tauri/src/ai/adapters/`: `openai.rs`, `anthropic.rs`, `custom.rs`.
- `src-tauri/src/commands/ai_provider_cmds.rs`: Tauri commands cho CRUD & test connection.
- `src/application/services/AIProviderService.ts`: Frontend service wrapper.

## 3. Credential Flow
- **Resolution**: Secret được lưu ngầm trong OS Keyring (`developer-control-center:ai-provider`).
- **Access Rule**: Quá trình giải mã và đính kèm Bearer/API Key được thực hiện 100% bên trong Rust Runtime.
- **Frontend Isolation**: React tuyệt đối không chứa hay nhận Plaintext API Key ở bất kỳ DTO hay Event nào.

## 4. Provider Adapter Flow
- Các adapters hiện tại (`openai`, `anthropic`, `custom`) có logic HTTP `reqwest` riêng để test connection.
- **Chưa có Unified Trait**: Cần xây dựng `AIProviderAdapter` trait để chuẩn hóa việc nhận `AIRequest` -> dịch payload -> thực thi HTTP -> dịch response -> `AIResponse`.

## 5. IPC Flow
- Frontend gửi `AIRequest` (chứa `providerId`, `model`, `messages`, `options`). **Không chứa secret/apiKey**.
- Tauri IPC command `ai_gateway_send_request_cmd` nhận `AIRequest`, gọi `AIGateway`.
- `AIGateway` giải mã `providerId` -> lấy `AIProviderConfig` từ `MetadataStore` -> lấy `secret` từ `CredentialStore` -> gọi `ProviderAdapter`.
- `AIGateway` trả về `AIResponse` (chứa `content`, `model`, `usage`, `finishReason`). **Không chứa secret/apiKey**.

## 6. Missing Runtime Components (Cần tạo ở Stage B)
1. **Domain Models** (`src-tauri/src/ai/gateway/models.rs`): `AIRequest`, `AIMessage`, `AIResponse`, `AIUsage`, `AIError`.
2. **Adapter Trait** (`src-tauri/src/ai/gateway/adapter.rs`): Trait `AIProviderAdapter`.
3. **Provider Resolver** (`src-tauri/src/ai/gateway/resolver.rs`): Ánh xạ `ProviderType` -> `Adapter`.
4. **Mock Adapter** (`src-tauri/src/ai/gateway/mock_adapter.rs`): Giả lập response/error cho unit test.
5. **Gateway Engine** (`src-tauri/src/ai/gateway/core.rs`): Timeout (15s), Bounded Retry Policy (chỉ retry 429/5xx, KHÔNG retry 401/403/400).
6. **Tauri IPC Command** (`src-tauri/src/commands/ai_gateway_cmds.rs`): Command `ai_gateway_send_request_cmd`.
7. **Unit Tests** (`src-tauri/src/ai/gateway/gateway_test.rs`): Test resolution, retry, timeout, error normalization, leak check.

## 7. Security Risks & Mitigation
- **Risk 1: Secret leakage via errors/logs**: Sanitize toàn bộ `AIError` và log, tuyệt đối không đính kèm Bearer token hay `x-api-key`.
- **Risk 2: Infinite Retry loop**: Giới hạn max retry = 2 lần với exponential backoff. Chỉ retry 429, 500, 502, 503, 504.
- **Risk 3: Thread blocking**: Sử dụng `tokio::time::timeout` 15 giây cho toàn bộ gateway call.

## 8. Proposed File Changes
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
- `src-tauri/src/ai/mod.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/lib.rs`
- `src/application/services/AIProviderService.ts`

## 9. Dependency Assessment
- `reqwest`, `tokio`, `serde`, `serde_json`, `keyring` đều đã có sẵn trong `Cargo.toml`.
- **0 Dependency mới**.

## 10. Regression Risks
- Tất cả các module ngoài scope (Dashboard, Security Center, Terminal, Resource Monitor, CI/CD UI) không bị tác động.

## 11. Test Strategy
- Unit test 15+ kịch bản trong `gateway_test.rs` với `MockAIProviderAdapter`.
- Build verification bằng `cargo check`, `cargo test`, `npm run build`.

## 12. Final Audit Verdict
- Architecture hiện tại hoàn toàn sẵn sàng cho STAGE B (Implementation).
- **STAGE A AUDIT: PASS & READY FOR APPROVAL**.
