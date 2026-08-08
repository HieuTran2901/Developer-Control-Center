# Phase 3 Dependency Scanner Audit Report

## 1. Current Architecture
Developer Control Center hiện tại sử dụng kiến trúc Sạch (Clean Architecture) kết hợp Tauri/Rust cho Backend và React/TypeScript cho Frontend. Communication được thực hiện qua IPC với `SecurityScanEvent` và `FindingsChunk`. SecurityEngine quản lý runtime, thực hiện quét đệ quy thư mục an toàn và truyền content vào các implementation của trait `SecurityScanner`.

## 2. Existing Security Engine
Engine hiện tại đọc file tĩnh và gửi content thông qua string chunks tới các Scanners. Nó tích hợp sẵn cơ chế Cancellation qua `AtomicBool`, quản lý deduplication trong một run, và thực thi `SecurityRedactor` trước khi emit.

## 3. Dependency Scanner Requirements
- Phân tích Manifest/Lockfile để thu thập thông tin dependency tĩnh.
- Không thực thi mã, không chạy CLI tools (`npm audit`, `cargo audit`).
- Hỗ trợ Node (package.json, package-lock.json) và Java (pom.xml) trước tiên.
- Định dạng output trả về `Vec<SecurityFinding>` với `FindingsChunk`.

## 4. Manifest Analysis
- **Node**: Cần parser JSON. `package.json` định nghĩa required dependencies, `package-lock.json` định nghĩa resolved version.
- **Java**: Cần parser XML. `pom.xml` có thể dùng `<properties>` resolution phức tạp.

## 5. Lockfile Analysis
- Chỉ nên đánh giá severity và vulnerable status của các version đã được *resolve* trong lockfile thay vì version range.
- `package-lock.json` v2/v3 có trường `packages`, v1 có `dependencies`.

## 6. Version Resolution
- Version abstraction cần xử lý Semver ranges của Node. Nếu lockfile có sẵn version cụ thể, ta sẽ dựa vào lockfile để bỏ qua bước semver resolution phức tạp.
- Maven có fixed versions, snapshot, và range. Đối với POM resolution nội bộ (properties), chỉ nên thực thi resolve string interpolations `<version>${foo}</version>`.

## 7. Transitive Dependency Strategy
- Transitive dependencies chỉ có thể phát hiện thông qua **lockfile**.
- Nếu không có lockfile, manifest chỉ thể hiện Direct dependency. Ta sẽ gắn tag `DIRECT` hoặc `UNKNOWN_TRANSITIVE` nếu tree không toàn vẹn.
- Đối với `package-lock.json` v3, hệ thống cung cấp cây graph hoàn chỉnh ở `packages`.

## 8. Vulnerability Provider Architecture
Option A: Offline DB (sqlite). Quá nặng (hàng GB), cập nhật khó.
Option B: Online OSV API (osv.dev). Miễn phí, query by name/version/ecosystem, không bắt buộc token, standard schema.
Option C: Native Ecosystem APIs (npm registry, Maven central). Khác biệt format, dễ bị rate limit.

**Recommendation**: Sử dụng **Option B (OSV API)** theo kiến trúc `VulnerabilityProvider` abstraction. Có thể cache local offline để tránh query lại.

## 9. Network Security
- Tách biệt `VulnerabilityProvider` khỏi `DependencyScanner`.
- Scanner gọi trait `VulnerabilityProvider`, provider này gọi HTTP client (như `reqwest`).
- Gửi duy nhất data `ecosystem`, `name`, `version` dưới dạng query. KHÔNG GỬI PATH/SOURCE.

## 10. Cache Strategy
- Cache vulnerability kết quả truy vấn (hits & misses) theo hash key: `ecosystem:name:version`.
- Sử dụng in-memory LRU cache hoặc Disk Cache có TTL 24h.
- Trong Phase 3, ưu tiên in-memory `std::collections::HashMap` tĩnh cho đơn giản.

## 11. Domain Model
```rust
pub struct DependencyFindingExt {
    pub ecosystem: String, // "npm", "maven"
    pub package_name: String,
    pub installed_version: String,
    pub requested_version: Option<String>,
    pub dependency_type: DependencyType, // Direct, Transitive, Dev
    pub vulnerability_id: Option<String>, // CVE-XXX, GHSA-XXX
    pub fixed_version: Option<String>,
}
// Sẽ được map vào String struct JSON trong `evidence` hoặc thêm field `metadata` vào `SecurityFinding`
```

## 12. IPC Strategy
- Tái sử dụng `FindingsChunk`. Gom các dependency scan finding vào chunk 50 items.
- Không tạo type mới. Dùng `SecurityCategory::Dependency`.

## 13. Performance Strategy
- Parser Manifest: Chỉ parse JSON (package.json/lock) khi tìm thấy, tránh serialize thành struct khổng lồ, dùng `serde_json::Value` cho lockfile linh hoạt.
- OSV Lookup: Gộp batch requests `{"queries": [...]}` của OSV API thay vì HTTP request từng package một (OSV API hỗ trợ batch). Giảm số lượng network call.

## 14. Cancellation Strategy
- Kiểm tra `cancel_token` khi parse manifest, trước khi HTTP request, và trong vòng lặp batching findings.

## 15. Error Handling
- Nếu `package.json` lỗi syntax, bỏ qua không làm crash tiến trình.
- Nếu OSV API timeout (5s), ghi log/bỏ qua, trả về `Info` finding hoặc gán vulnerability = `UNKNOWN`.

## 16. Security Risks
- Network call có thể bị MITM nếu không dùng HTTPS/TLS verify. Bắt buộc dùng reqwest với tls.
- SSRF risk nếu API Endpoint bị inject (hardcode endpoint `https://api.osv.dev/v1/querybatch`).

## 17. False Positive Strategy
- Dev dependency có thể có severity thấp hơn Production dependency.
- Tuy nhiên, vulnerability OSV không đổi severity. Chỉ thay đổi `confidence` nếu version thuộc dạng khoảng (range) nhưng không xác thực được lockfile.

## 18. AI Readiness
- Cung cấp raw evidence chứa `ecosystem`, `package name`, `vulnerability details`, `remediation step` rõ ràng để AI sau này phân tích tác động bảo mật chéo.

## 19. Dependency Evaluation
- `serde_json` (Có sẵn, tốt cho JSON)
- `reqwest` (Cần thêm để gọi OSV HTTP API) - Alternatives: `ureq` (nhỏ gọn, thread-safe, không async), `hyper` (quá thấp). **Recommend**: `reqwest` (vì đã có `tokio` async).
- `quick-xml` (Cần thêm để parse POM.xml) - Alternative: `roxmltree` (ổn định). **Recommend**: `quick-xml` (nhanh, dễ serialize).
- `semver` (Không bắt buộc nếu chỉ dùng exact match lockfile + OSV batch query).

## 20. Test Matrix
- **Node**: `package.json` no lock, `package-lock.json` v2/v3.
- **Java**: `pom.xml` properties resolution.
- **Network**: timeout, OSV mock data.
- **Cancellation**: Dừng lúc đang gửi Batch HTTP OSV.

## 21. Benchmark Plan
- Quét repo có `package-lock.json` 1000 dependencies.
- Đo thời gian deserialize lockfile.
- Đo tốc độ chunk IPC.

## 22. Regression Risks
- Secret Scanner có thể bị chậm lại nếu Dependency Scanner block tokio thread quá lâu do network call. Phải dùng `tokio::spawn` không blocking.

## 23. Technical Debt
- POM XML parse sẽ khó xử lý các Parent POM inheritance. Cần accept nợ kỹ thuật: Chỉ scan POM hiện tại.

## 24. Implementation Phases
Chia thành 12 bước (Xem tài liệu Plan).

## 25. Files To Change
- `Cargo.toml` (Thêm reqwest, quick-xml)
- `src-tauri/src/security/domain.rs` (Cập nhật struct nếu cần, hoặc reuse)
- `src-tauri/src/security/dependency_scanner.rs` (Mới)
- `src-tauri/src/security/osv_provider.rs` (Mới)
- `src-tauri/src/security/engine.rs` (Đăng ký)
- Frontend UI.

## 26. Open Questions
- Thêm `reqwest` sẽ tăng ~2MB binary. `ureq` nhẹ hơn (chạy blocking trong async = `spawn_blocking`). Chúng ta dùng gì?
- Bắt buộc xử lý Java Maven không? (Tạm thời phase 3 làm Node.js trước rồi mở rộng).

## 27. Recommendation
Sử dụng mô hình OSV API Batch Lookup. Thực thi Node.js (package.json + lockfile) làm chuẩn cho Phase 3. 
Tạo `DependencyScanner` như một component độc lập và gọi OSV API batch endpoint để giảm thiểu connection timeout.
