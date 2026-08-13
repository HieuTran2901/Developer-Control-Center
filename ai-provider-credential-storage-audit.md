# AI Provider Credential Storage Audit

## 1. Executive Summary

- **Current Storage Mechanism**: Secrets/API keys are stored in a dedicated local file `ai_credentials.dat` under `{app_data_dir}/security/`, separated from general provider metadata (`ai_providers.json`). Secrets are obfuscated using a two-way XOR cipher with a hardcoded static salt (`DEVCTRL_SECURE_SALT_KEY_2026`).
- **Security Level**: **MODERATE / MEDIUM RISK**. Secrets are isolated from metadata, excluded from Git, memory-cleared in DTOs, and never sent back to the React UI on Edit operations. However, disk persistence uses static XOR obfuscation instead of OS-level secure enclaves (such as Windows Credential Manager, macOS Keychain, or Linux Secret Service / Keyring).
- **Biggest Risk**: Anyone with local filesystem read permissions or binary access can extract the static salt key from compiled code or memory and deobfuscate stored API keys in `ai_credentials.dat`.
- **GitHub Exposure Risk**: **ZERO / NEGLIGIBLE**. Secrets are saved outside the repository directory (`AppData`), `.gitignore` correctly filters build artifacts and environment files, and mock data contains only fake masked strings (`sk-proj-••••••••••••••••`).

---

## 2. Current Credential Architecture

```
[ User Input (React UI) ]
         │ (secretKey string in form state)
         ▼
[ AIProviderForm.tsx ]
         │ (OnSubmit payload: secretKey)
         ▼
[ AIProviderService.ts ]
         │ (Tauri IPC `invoke('ai_provider_create_cmd' | 'ai_provider_update_cmd')`)
         ▼
[ Rust Command (ai_provider_cmds.rs) ]
         │ (CreateAIProviderInput / UpdateAIProviderInput DTO)
         ▼
[ AIProviderService (service.rs) ]
 ┌───────┴───────────────────────────────┐
 │                                       │
 ▼                                       ▼
[ MetadataStore (metadata_store.rs) ]   [ CredentialStore (credential_store.rs) ]
 (Saves provider metadata WITHOUT secret) (XOR obfuscates & persists to `ai_credentials.dat`)
 (Saves to `ai_providers.json`)
                                         │
                                         │ (Retrieves secret on test_connection)
                                         ▼
                                [ Adapter (reqwest) ]
                                         │ (Sends HTTPS Request with Bearer / x-api-key)
                                         ▼
                                [ AI Provider API Endpoint ]
```

---

## 3. Exact Storage Location

- **Storage Type**: Obfuscated Local File (`ai_credentials.dat`).
- **Path**: `{app_data_dir}/security/ai_credentials.dat` (e.g., `C:\Users\<user>\AppData\Roaming\developer-control-center\security\ai_credentials.dat`).
- **Persistence**: **YES** (persisted across app restarts).
- **Encryption**: **NO** (XOR Obfuscation only; not cryptographically encrypted with hardware/OS keys).
- **Format**: Plaintext line-based key-value pairs formatted as `{provider_id}:{hex_obfuscated_secret}`.
- **Separation**: Provider metadata (`name`, `model`, `baseUrl`, `isDefault`, `status`) is stored in `{app_data_dir}/ai_providers.json`, completely stripped of secret keys.

---

## 4. Credential Lifecycle

1. **Input**: User types key into `<input type="password">` in `AIProviderForm.tsx`. Held in React local state `secretKey`.
2. **State & IPC**: Form submit calls `aiProviderService.createProvider()` or `updateProvider()`, which serializes `secretKey` into Tauri IPC payload `CreateAIProviderInput` / `UpdateAIProviderInput`.
3. **Rust Handling**: Tauri command receives payload and passes it to `AIProviderService::create()` / `update()` in `src-tauri/src/ai/service.rs`.
4. **Metadata Storage**: Provider metadata is saved to `ai_providers.json` via `MetadataStore`. The secret key is **never** included in `AIProviderConfig`.
5. **Secret Persistence**: Secret key is saved to `ai_credentials.dat` via `CredentialStore::save_secret()`, which obfuscates string bytes with `DEVCTRL_SECURE_SALT_KEY_2026` XOR hex encoding.
6. **Retrieval & Usage**: When `test_connection` is triggered, `service.rs` fetches the secret via `credential_store.get_secret(id)` in memory and passes it directly to `adapters::test_provider_connection()`.
7. **HTTP Execution**: `reqwest::Client` constructs HTTPS header (`Authorization: Bearer <secret>` or `x-api-key: <secret>`) and dispatches the request with a 10-second timeout.
8. **Deletion**: Calling `deleteProvider(id)` invokes `MetadataStore::delete(id)` AND `CredentialStore::delete_secret(id)`, purging the key from both memory cache and disk file `ai_credentials.dat`.

---

## 5. Frontend Findings

- **Form State**: `secretKey` exists only transiently in component state (`AIProviderForm.tsx`) while the user is actively filling out the Add/Edit form.
- **Edit Mode Safety**: When editing an existing provider, `AIProviderCard` and `AIProviderForm` receive an `AIProvider` DTO object that **does not contain any API key field**. The UI displays `•••••••• (Configured securely)`. If the user does not click "Change API Key", `secretKey` remains `undefined` in the IPC request and Rust preserves the previously stored secret.
- **Browser Persistence**: `localStorage`, `sessionStorage`, `IndexedDB`, and cookies are **100% CLEAN**. No credentials are write-cached to browser storage.
- **Dev Mode Fallback**: If running in pure browser mode (without Tauri IPC), `AIProviderService.ts` maintains an in-memory `fallbackProviders` array without secret keys.

---

## 6. Rust / Tauri Findings

- **Commands**: `ai_provider_create_cmd` and `ai_provider_update_cmd` in `src-tauri/src/commands/ai_provider_cmds.rs` receive `secret_key: Option<String>`.
- **Memory Lifetime**: Secret exists in memory inside Rust `CredentialStore`'s `Mutex<HashMap<String, String>>` cache for fast lookup during connection tests.
- **No Leaks in Returns**: Commands return `AIProviderConfig`, which does not have a `secretKey` field. Secret keys are never serialized in IPC response DTOs back to React.

---

## 7. Persistence Findings

| Aspect | Detail |
|---|---|
| **File Location** | `{app_data_dir}/security/ai_credentials.dat` |
| **Format** | Line-separated `provider_id:obfuscated_hex` |
| **Cipher** | XOR byte-array transformation with key `DEVCTRL_SECURE_SALT_KEY_2026` |
| **Permissions** | Inherits standard user OS file permissions |
| **Cryptographic Protection** | Weak. Static XOR salt can be reversed by inspecting binary code |

---

## 8. Git / GitHub Exposure Analysis

- **Repository Cleanliness**: Verified `git status` and `.gitignore`.
- **Secrets in Code**: Zero real secrets hardcoded in source code or `mockAIProviders.ts`.
- **Ignore Rules**: `src-tauri/target/`, `.env`, and build outputs are ignored. User AppData directory (`ai_credentials.dat`) resides outside the Git repository root.
- **Risk Rating**: **NONE (0%)**. No possibility of accidental Git commit/push of credentials.

---

## 9. Logging Exposure Analysis

- **Console Logs**: `AIProviderService.ts` logs IPC error warnings, but does not print input payloads or secret keys.
- **Rust Logs**: No `println!`, `dbg!`, or `tracing` statements outputting `secret_key`.
- **Error Formatting**: Connection failure errors map to generic DTO messages (e.g., `"Authentication failed. Invalid API Key"`, `"Connection timed out after 10 seconds"`). Secret keys are strictly stripped from error tracebacks.

---

## 10. Network Exposure Analysis

- **OpenAI Endpoint**: `https://api.openai.com/v1/models` via `Authorization: Bearer <secret>`.
- **Anthropic Endpoint**: `https://api.anthropic.com/v1/models` via `x-api-key: <secret>`.
- **Custom Endpoint**: Target URL specified by user over HTTP/HTTPS with Bearer header.
- **Query Parameter Exposure**: **NONE**. Secrets are strictly placed in HTTP Request Headers, never in URL paths or query params.

---

## 11. Delete / Update Analysis

- **Update Behavior**: Updating provider details without providing a new secret key preserves the existing secret in `CredentialStore`. Providing a new key cleanly overwrites the record in `ai_credentials.dat`.
- **Delete Behavior**: Deleting a provider purges its entry from both `MetadataStore` (`ai_providers.json`) AND `CredentialStore` (`ai_credentials.dat` + memory HashMap cache). No orphan credentials remain.

---

## 12. AI Pipeline Builder Integration

- **Current Status**: AI Pipeline Builder currently operates on static AST domain models and mock generators. It does **NOT** yet consume or query stored AI Provider credentials.
- **Future Requirement**: When Pipeline Builder is connected, credential resolution must stay strictly inside Rust services without exposing secrets back to React.

---

## 13. Security Findings

| ID | Severity | Finding | Location | Risk |
|---|---|---|---|---|
| **SEC-01** | **MEDIUM** | Credentials use XOR obfuscation with static salt key rather than OS Keyring / Credential Manager | `src-tauri/src/ai/credential_store.rs` | Local users or malware with file read access to `AppData` can extract static salt `DEVCTRL_SECURE_SALT_KEY_2026` and recover plaintext API keys. |
| **SEC-02** | **LOW** | Secret key string remains in Rust process heap memory cache indefinitely | `src-tauri/src/ai/credential_store.rs` (`Mutex<HashMap>`) | Memory dump of the app process could reveal plaintext API keys. |
| **SEC-03** | **INFO** | Custom AI Provider allows plaintext HTTP connections (e.g., local Ollama) | `src-tauri/src/ai/adapters/custom.rs` | If a user configures a remote custom endpoint over unencrypted HTTP, credentials could be intercepted on the local network. |

---

## 14. Recommended Architecture

To achieve enterprise-grade desktop security, the credential store should evolve from file obfuscation to native OS Credential Managers:

```
[ Tauri IPC ]
     │
     ▼
[ AIProviderService (Rust) ]
     │
     ▼
[ Keyring / SecretStore Adapter ]
 ┌───┴───────────────────────────────┬───────────────────────────────┐
 ▼                                   ▼                               ▼
[ Windows Credential Manager ]    [ macOS Keychain ]             [ Linux Secret Service / Keyring ]
(CryptProtectData / CredWrite)   (SecItemAdd / Keychain API)    (libsecret / DBus)
```

---

## 15. Migration Plan

1. Add `keyring` crate to `src-tauri/Cargo.toml` (`keyring = "2.1"`).
2. Implement `KeyringCredentialStore` implementing the same `save_secret`, `get_secret`, `delete_secret` interface.
3. Add automatic one-time migration: on startup, read existing obfuscated keys from `ai_credentials.dat`, migrate them to OS Keyring, and securely delete `ai_credentials.dat`.

*(Note: Pursuant to strict audit guidelines, this migration plan is proposed only and has NOT been executed).*

---

## 16. Final Verdict

### Answers to Mandatory Questions:

1. **API key hiện tại được lưu ở đâu?**
   Lưu tại file riêng biệt `{app_data_dir}/security/ai_credentials.dat` trong thư mục OS AppData của ứng dụng.
2. **Có plaintext không?**
   Không nằm dạng plaintext hoàn toàn, nhưng được mã hóa dạng XOR Obfuscation với static salt string.
3. **Có nằm trong source code không?**
   Không. Source code chỉ chứa fake masked strings (`sk-proj-••••••••••••••••`) trong file mock data.
4. **Có nằm trong Git không?**
   Không. File storage nằm ngoài git repository directory.
5. **Có khả năng push lên GitHub không?**
   Không.
6. **Có nằm trong frontend persistent storage không?**
   Không. `localStorage`, `sessionStorage` và `IndexedDB` hoàn toàn sạch.
7. **Có nên chuyển sang OS Credential Manager không?**
   Có. Nên chuyển sang OS Credential Manager (Windows Credential Manager / Keychain / libsecret) ở phase sau để đạt độ an toàn cao nhất.
8. **Mức độ rủi ro hiện tại là gì?**
   **MEDIUM (Trung bình)**. Đã tách biệt hoàn toàn khỏi Frontend/Git/Metadata/Logs, nhưng đĩa cứng sử dụng mã hóa XOR tĩnh thay vì OS Keyring.

---

### Detailed Answers to the 20 Specific Audit Points:

1. **API key được nhập từ UI ở đâu?**: Tại `AIProviderForm.tsx` (thẻ input type password).
2. **API key được giữ trong React state nào?**: Giữ trong component state `secretKey` (`useState`) trong lúc mở Form.
3. **API key có đi qua IPC/Tauri command không?**: Có, truyền qua IPC payload của `ai_provider_create_cmd` và `ai_provider_update_cmd`.
4. **API key có được gửi từ React sang Rust không?**: Có, một chiều khi người dùng tạo mới hoặc cập nhật key.
5. **Rust nhận API key ở đâu?**: Tại `src-tauri/src/commands/ai_provider_cmds.rs` trong struct DTO `CreateAIProviderInput` / `UpdateAIProviderInput`.
6. **API key cuối cùng được lưu ở đâu?**: Tại file `{app_data_dir}/security/ai_credentials.dat`.
7. **Có lưu vào localStorage/sessionStorage không?**: Không.
8. **Có lưu vào JSON/config/workspace file không?**: Không. File metadata `ai_providers.json` đã được bóc tách hoàn toàn secret key.
9. **Có lưu vào database không?**: Không.
10. **Có lưu vào OS Credential Manager / Keychain / Secret Service không?**: Chưa (hiện đang dùng XOR file storage `ai_credentials.dat`).
11. **API key có xuất hiện trong log không?**: Không.
12. **API key có xuất hiện trong error message không?**: Không. Error message được sanitise về các enum thông báo ngắn.
13. **API key có xuất hiện trong DevTools / browser memory không?**: Chỉ xuất hiện trong transient state khi form nhâp key đang mở, không tồn tại trong persistent store/global state.
14. **API key có được serialize cùng provider metadata không?**: Không. Struct `AIProviderConfig` không chứa field `secret_key`.
15. **API key có thể bị Git commit/push lên GitHub không?**: Không.
16. **Khi Edit Provider, API key thật có được load lại về frontend không?**: Không. UI hiển thị `•••••••• (Configured securely)` và backend chỉ update key nếu user nhập key mới.
17. **Khi Delete Provider, secret có thực sự bị xóa hay chỉ xóa metadata?**: Xóa thực sự cả ở metadata JSON và file `ai_credentials.dat`.
18. **Khi Test Connection, secret đi qua những layer nào?**: Rust `service.rs` -> `credential_store.get_secret()` -> `adapters::test_provider_connection()` -> `reqwest` client HTTP header. Không đi qua Frontend.
19. **Khi AI Pipeline Builder sử dụng provider, secret đi qua những layer nào?**: Chưa kết nối (Pipeline Builder hiện chưa consume credentials).
20. **Có bất kỳ đường nào khiến secret rò rỉ khỏi secure boundary hay không?**: Không có đường rò rỉ trên Network/Frontend/Logs/Git, đường duy nhất là local file access với XOR salt extraction.
