# Phase 3: Dependency Scanner Architecture Audit

## 1. Static Architecture Audit

### 1. SecurityScanner abstraction hiện tại có đủ để DependencyScanner không?
**Có.** Trait `SecurityScanner` yêu cầu hàm `scan(path: &Path, cancel_token: Arc<AtomicBool>) -> Pin<Box<dyn Future<Output = Result<Vec<SecurityFinding>, String>> + Send>>`. DependencyScanner có thể implement trait này, lọc đường dẫn `path` (ví dụ: chỉ xử lý nếu file name là `package.json`, `package-lock.json`, hoặc `pom.xml`), tiến hành parse và gọi Vulnerability Provider để trả về mảng finding.

### 2. SecurityEngine hiện tại có cần thay đổi không?
**Không.** Engine hiện tại duyệt file, quản lý cancellation token, deduplication và chunking rất tốt. Chỉ cần đăng ký thêm `DependencyScanner` vào Engine lúc khởi tạo. Không cần thay đổi core loop.

### 3. SecurityFinding có đủ metadata cho dependency vulnerability không?
**Không hoàn toàn.** `SecurityFinding` hiện có `title`, `description`, `category` (có thể dùng `SecurityCategory::Dependency`), và `evidence` (kiểu `RedactedEvidence`). Tuy nhiên, UI cần các dữ liệu có cấu trúc (structured data) như `ecosystem`, `package_name`, `version`, `fixed_version` để render badge đẹp mắt. 
*Đề xuất*: Thêm field `pub metadata: Option<serde_json::Value>` hoặc một Enum chuyên biệt `DependencyMetadata` vào `SecurityFinding` để Frontend có thể parse an toàn mà không phá vỡ cấu trúc cũ.

### 4. FindingsChunk có cần thay đổi không?
**Không.** `FindingsChunk` chứa `Vec<SecurityFinding>`, nó hoàn toàn agnostic (không phụ thuộc) vào nội dung của finding.

### 5. EventBus có cần thay đổi không?
**Không.** Các event `SecurityFindingsChunkDetected`, `SecurityScanProgress` vẫn hoạt động bình thường.

### 6. SecurityOverview cần thay đổi contract gì?
**Có.** Component `SecurityOverview` cần cập nhật để đọc field `metadata` mới, nhận diện category `Dependency`, và render riêng biệt (hiển thị Version, Ecosystem, Vulnerability ID).

### 7. Domain Dependency nên nằm ở đâu?
Nên nằm tại `src-tauri/src/security/domain.rs` (như `DependencyMetadata`, `Ecosystem`).

### 8. Parser abstraction nên nằm ở đâu?
Nên tạo một sub-module riêng: `src-tauri/src/security/dependency_scanner/parser.rs`.

### 9. VersionResolver nên nằm ở đâu?
Nằm trong `src-tauri/src/security/dependency_scanner/resolver.rs`. Nhiệm vụ chuẩn hóa version từ range (trong manifest) sang exact version (từ lockfile).

### 10. VulnerabilityProvider nên nằm ở đâu?
Trait này nên nằm tại `src-tauri/src/security/dependency_scanner/provider.rs` để trừu tượng hóa việc lấy dữ liệu lỗ hổng.

### 11. OSV integration có nên nằm trong security module hay infrastructure layer?
Do OSV phục vụ trực tiếp và duy nhất cho `DependencyScanner`, nó nên nằm trong `src-tauri/src/security/dependency_scanner/osv.rs`. Nếu sau này có nhiều module dùng OSV, ta có thể refactor xuống infrastructure layer, nhưng hiện tại giữ trong boundary của security module để đảm bảo Clean Architecture (Cohesion cao).

### 12. Có cần thêm reqwest không?
**Đề xuất thêm.** Hiện tại project chỉ có `tokio`, không có HTTP client. API OSV cần gọi HTTP POST batch. `reqwest` là chuẩn de-facto cho async HTTP trong Rust. (Có thể cân nhắc `ureq` nếu muốn giảm binary size, nhưng `ureq` blocking sẽ cần bọc trong `spawn_blocking`).

### 13. Có cần thêm quick-xml không?
**Đề xuất thêm.** Cần thiết để parse `pom.xml` của Maven. Mặc dù có thể dùng regex tĩnh cho các file POM đơn giản, nhưng XML rất phức tạp (tự đóng tag, CDATA, namespaces). `quick-xml` hoặc `roxmltree` là bắt buộc để đảm bảo chính xác.

### 14. Có cần thêm semver crate không?
**Không.** Nếu chúng ta áp dụng nguyên tắc: "OSV chấp nhận exact version và tự đánh giá range lỗ hổng", Scanner của chúng ta chỉ cần bóc tách **exact version** từ lockfiles (`package-lock.json`). Việc phân tích range (`^1.2.3`) không cần thiết nếu lockfile đã resolve ra `1.2.5`.

### 15. Có thể sử dụng dependency hiện tại không?
**Có.** `serde_json` (đã có trong `Cargo.toml`) hoàn toàn đủ sức parse `package.json` và `package-lock.json`. `tokio` (đã có) hỗ trợ tốt cho Async batching. `regex` (đã có) hỗ trợ Version normalization cơ bản.

---

## 2. Dependency Decision Matrix

| Dependency | Purpose | Alternatives | Decision | Lý do |
|---|---|---|---|---|
| `reqwest` | OSV API HTTP Client | `ureq`, `hyper` | **Thêm mới** | `hyper` quá low-level. `ureq` là blocking (sẽ block tokio workers nếu không cẩn thận). `reqwest` tích hợp native với tokio và serde. |
| `quick-xml` | Maven `pom.xml` parsing | Regex, `roxmltree` | **Thêm mới** | XML không thể parse bằng regex một cách an toàn. `quick-xml` nhanh, hỗ trợ serde. |
| `semver` | Node version parsing | Regex tĩnh | **Bỏ qua** | Chúng ta ưu tiên Lockfile (chứa exact version). Việc check semver match OSV sẽ được nhường cho OSV backend API xử lý. Không tăng size binary vô ích. |

---

## 3. Risk Register

| ID | Risk | Severity | Mitigation Strategy |
|---|---|---|---|
| R1 | Network API Rate Limiting (OSV) | High | Gom nhóm request bằng Batch API (e.g. 1000 packages/request). Caching kết quả. |
| R2 | Large Lockfile Parsing causing OOM/Freeze | High | Dùng `serde_json::from_reader` dạng stream nếu file cực lớn, hoặc giới hạn file size (< 10MB) trước khi parse. Đảm bảo chạy trong `spawn_blocking` hoặc `.await` yield hợp lý. |
| R3 | Transitive Dependencies missing in Manifest | Medium | Luôn ưu tiên đọc lockfile thay vì manifest thuần để có dependency tree đầy đủ nhất. Đánh dấu `UNKNOWN_TRANSITIVE` nếu không có lockfile. |
| R4 | Secret Leakage via Network | Critical | Chỉ gửi `ecosystem`, `package name` và `version` lên OSV API. Filter toàn bộ header/auth config trước khi lookup. |
| R5 | Cancellation Latency | High | Check `cancel_token` liên tục trong vòng lặp parse từng chunk package trước khi gọi OSV HTTP API. |

---

## 4. Implementation Gate
Quy trình Audit tĩnh kết thúc tại đây. Không có file mã nguồn nào bị thay đổi.
**IMPLEMENTATION GATE: PENDING**
