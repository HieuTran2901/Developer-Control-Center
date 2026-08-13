# Phase 2B — AI Gateway Foundation Implementation Plan

This implementation plan details the technical architecture, safety rules, request limits, total timeout, retry policy, security protections, and test matrix for building the **AI Gateway & Provider Runtime Foundation** in Developer Control Center (Tauri + Rust + React).

---

## 1. Executive Architecture & Flow

The AI Gateway serves as the **SINGLE ENTRY POINT** for all AI runtime capabilities in Developer Control Center.

### Architecture Flow:
```
[ React Frontend ]
       │
       │ (Sends AIRequest: providerId, model, messages, options - NO API KEYS)
       ▼
[ Tauri IPC: ai_gateway_send_request_cmd ]
       │
       ▼
[ AIGateway Engine (src-tauri/src/ai/gateway/core.rs) ]
       │
       ├─► 1. Pre-validation: Request Size Limits (message count, payload bytes, model length)
       ├─► 2. Resolve Provider Metadata (via MetadataStore)
       ├─► 3. Resolve Secret Credential (via OS CredentialStore / keyring - Rust only)
       ├─► 4. Resolve Provider Adapter (via ProviderResolver)
       │
       ▼
[ Total Timeout Wrapper (15 seconds TOTAL for request + retries + backoff) ]
       │
       ▼
[ Bounded Retry Loop (Max 2 retries on 429, 500, 502, 503, 504 with Jittered Backoff) ]
       │
       ▼
[ Provider Adapter (OpenAI / Anthropic / Custom / Mock) ]
       │
       │ (Reusable reqwest::Client with connection pooling & Keep-Alive)
       ▼
[ HTTPS API Endpoint ]
       │
       ▼
[ Provider Response ]
       │
       ├─► Map Success  ──► Unified AIResponse DTO (content, model, usage, finishReason)
       └─► Map Failure  ──► Sanitized AIError DTO (Zero Secret Leakage)
       │
       ▼
[ Return to React Frontend via IPC ]
```

---

## 2. Technical Specifications

### A. Request Size Limits (Pre-Execution Validation)
Before any provider lookup or network activity occurs, `AIGateway` validates `AIRequest`:
- **Max Messages Count**: `100` messages.
- **Max Single Message Length**: `64,000` characters.
- **Max Total Payload Size**: `256 KB` (`262,144` bytes).
- **Max Model Name Length**: `128` characters.

*Rule*: If any threshold is exceeded, the request is rejected immediately with `AIError::InvalidRequest("Request payload exceeds safety bounds")`. Silent truncation is **prohibited**.

### B. Total Gateway Timeout
- **Total Lifetime**: `15` seconds for the entire operation.
- The `15s` timeout is applied at the outer `AIGateway` level wrapping the initial attempt, retries, and backoff delays combined using `tokio::time::timeout`.
- Individual HTTP request timeouts are capped to fit within the remaining total budget.

### C. Retry Policy
- **Maximum Retries**: `2` retries (Max `3` total attempts: Initial + Retry 1 + Retry 2).
- **Retryable Errors**: HTTP `429` (Rate Limited), `500` (Internal Error), `502` (Bad Gateway), `503` (Service Unavailable), `504` (Gateway Timeout), and transient network disconnects.
- **NON-Retryable Errors**: HTTP `400` (Bad Request), `401` (Unauthorized), `403` (Forbidden), `404` (Not Found), `422` (Unprocessable Entity), and `InvalidRequest`.
- **Backoff & Jitter**: Base backoff of `100ms * 2^attempt` + random jitter (`0..50ms`). If `Retry-After` header is provided by the provider and falls within the remaining total timeout budget, `Retry-After` duration is preferred.

### D. Shared HTTP Client Reuse
- `AIGateway` maintains a thread-safe `Arc<reqwest::Client>` instance created with:
  - Connection pooling
  - TCP Keep-Alive
  - DNS cache reuse
  - Default timeout bounds
- Adapters accept `&reqwest::Client` to avoid per-request HTTP client allocation overhead.

### E. Secret Leakage Protection (CRITICAL)
- **Zero Exposure Guarantee**: Secret keys exist ONLY inside Rust memory during request execution and are never attached to `AIRequest`, `AIResponse`, or `AIError`.
- **Sanitized Errors**: `AIError` serialization strips raw HTTP headers, `Authorization: Bearer ...`, `x-api-key`, and raw error response bodies.
- **Leak Test Suite**: A dedicated test fixture uses a dummy key (`TEST_SECRET_DO_NOT_LEAK_123`) to explicitly verify that `serde_json::to_string(&error)` and `format!("{:?}", error)` do NOT reveal the key.

---

## 3. Domain Models & Contracts (`src-tauri/src/ai/gateway/models.rs`)

```rust
pub enum AIRole { System, User, Assistant }

pub struct AIMessage { pub role: AIRole, pub content: String }

pub struct AIRequestOptions {
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub top_p: Option<f32>,
}

pub struct AIRequest {
    pub provider_id: String,
    pub model: Option<String>,
    pub messages: Vec<AIMessage>,
    pub options: Option<AIRequestOptions>,
}

pub struct AIUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

pub struct AIResponse {
    pub content: String,
    pub model: String,
    pub usage: Option<AIUsage>,
    pub finish_reason: Option<String>,
}

pub enum AIError {
    InvalidRequest(String),
    AuthenticationFailed(String),
    AccessDenied(String),
    RateLimited(String),
    ProviderUnavailable(String),
    Timeout(String),
    NetworkError(String),
    ProviderNotFound(String),
    CredentialNotFound(String),
    Internal(String),
}
```

---

## 4. Adapter & Resolver Architecture

### Adapter Trait (`src-tauri/src/ai/gateway/adapter.rs`):
```rust
#[async_trait::async_trait]
pub trait AIProviderAdapter: Send + Sync {
    fn provider_type(&self) -> ProviderType;

    async fn send_request(
        &self,
        client: &reqwest::Client,
        base_url: &str,
        model: &str,
        secret: &str,
        request: &AIRequest,
    ) -> Result<AIResponse, AIError>;
}
```

### Provider Resolver (`src-tauri/src/ai/gateway/resolver.rs`):
Maps `ProviderType` (`OpenAI`, `Anthropic`, `Custom`) to its concrete `AIProviderAdapter` implementation.

### Mock Adapter (`src-tauri/src/ai/gateway/mock_adapter.rs`):
Configurable mock adapter for deterministic unit testing of success, 429, 500, 401, 403, timeout, and request size rejection without network calls.

---

## 5. File Change Control

### Files to CREATE:
1. `src-tauri/src/ai/gateway/mod.rs`
2. `src-tauri/src/ai/gateway/models.rs`
3. `src-tauri/src/ai/gateway/adapter.rs`
4. `src-tauri/src/ai/gateway/resolver.rs`
5. `src-tauri/src/ai/gateway/core.rs`
6. `src-tauri/src/ai/gateway/mock_adapter.rs`
7. `src-tauri/src/ai/gateway/gateway_test.rs`
8. `src-tauri/src/commands/ai_gateway_cmds.rs`

### Files to MODIFY:
1. `src-tauri/src/ai/mod.rs` (Export gateway module)
2. `src-tauri/src/commands/mod.rs` (Export `ai_gateway_cmds`)
3. `src-tauri/src/lib.rs` (Register gateway state & `ai_gateway_send_request_cmd`)
4. `src/application/services/AIProviderService.ts` (Add `sendAIRequest` method for frontend IPC invocation)

### Files EXPLICITLY OUT OF SCOPE:
- `src/features/dashboard/`
- `src/features/security/`
- `src/features/terminal/`
- `src/features/cicd/`
- `src-tauri/src/security/`
- `src-tauri/src/monitor/`

---

## 6. Test Matrix (20+ Cases in `gateway_test.rs`)

1. `test_provider_resolver_openai`
2. `test_provider_resolver_anthropic`
3. `test_provider_resolver_custom`
4. `test_gateway_successful_request`
5. `test_gateway_missing_provider_metadata`
6. `test_gateway_missing_credential`
7. `test_request_limit_message_count_rejection`
8. `test_request_limit_message_length_rejection`
9. `test_request_limit_total_payload_rejection`
10. `test_retry_policy_429_success_after_retry`
11. `test_retry_policy_500_success_after_retry`
12. `test_retry_policy_502_retry`
13. `test_retry_policy_503_retry`
14. `test_retry_policy_504_retry`
15. `test_retry_policy_401_no_retry`
16. `test_retry_policy_403_no_retry`
17. `test_retry_policy_400_no_retry`
18. `test_max_retry_limit_exceeded`
19. `test_total_gateway_timeout_exceeded`
20. `test_secret_leakage_protection_in_error_serialization`
21. `test_secret_leakage_protection_in_bearer_header`
22. `test_secret_leakage_protection_in_x_api_key_header`
23. `test_custom_openai_compatible_adapter`

---

## 7. Verification Plan

1. **Rust Compilation**: Run `cargo check` in `src-tauri/` -> Must return code `0`.
2. **Rust Unit Testing**: Run `cargo test` in `src-tauri/` -> All tests (including 20+ gateway test cases) must **PASS** (`0 failed`).
3. **Frontend Compilation**: Run `npm run build` in root -> Must return code `0`.
4. **Static Security Audit**: Search workspace for leak vectors in logs/errors/IPC.
5. **Report Generation**: Output `docs/ai-gateway-foundation-implementation-report.md`.

---

## 8. Stop Gate & Approval Request

This plan satisfies all requirements of Stage B. Following rule guidelines, execution will **STOP** immediately after writing this document and await explicit user approval before entering Stage C (Implementation).
