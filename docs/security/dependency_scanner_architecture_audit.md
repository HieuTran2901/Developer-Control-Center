# Dependency Scanner Architecture Audit

## A. SecurityScanner abstraction hiện tại có đủ để DependencyScanner không?
**Có.** `SecurityScanner` có interface `scan(path: &Path, cancel_token: Arc<AtomicBool>)`. `DependencyScanner` có thể tận dụng interface này: bỏ qua (skip) tất cả file ngoại trừ `package.json`, `package-lock.json`, `pom.xml`. Sau đó tự mở file, parse ra Dependency Model, và gọi VulnerabilityProvider để generate finding.

## B. SecurityEngine có thực sự cần sửa không?
**Không.** Kiến trúc hiện tại của `SecurityEngine` (quản lý I/O traversal, event chunking, deduplication, redaction) đã đủ khái quát. Việc sửa đổi Engine để nó tự parse file sẽ phá vỡ Clean Architecture. Chỉ cần `engine.register_scanner(Box::new(DependencyScanner::new(provider)))`.

## C. FindingsChunk có cần thay đổi không?
**Không.** `FindingsChunk` bọc `Vec<SecurityFinding>`, hoạt động tốt với bất kỳ finding category nào.

## D. EventBus có cần thay đổi không?
**Không.** Frontend EventBus vẫn nhận `SecurityFindingsChunkDetected`.

## E. SecurityFinding có cần structured metadata cho dependency không?
**Có.** Dependency Finding cần cấu trúc riêng (Ecosystem, Tên Package, Phiên bản cài đặt, Fixed version) để hiển thị chi tiết UI. `evidence: Option<RedactedEvidence>` hiện tại phù hợp với raw string, không phù hợp với structured data. Đề xuất: Thêm trường `pub metadata: Option<serde_json::Value>` vào `SecurityFinding` ở Rust và TS.

## F. Có nên dùng Option<serde_json::Value> hay typed DependencyMetadata / enum Ecosystem?
Nên dùng **Option<serde_json::Value>** trong lõi `SecurityFinding` để giữ tính Generic cho hệ thống (giống Record payload). Tuy nhiên, trước khi serialize thành Value, domain của Dependency Scanner sẽ dùng **typed `DependencyMetadata` struct**. Frontend sẽ định nghĩa type-safe intersection type như `SecurityFinding & { metadata: DependencyMetadata }`.

## Quan Điểm Kiến Trúc: Option A vs Option B
**Recommendation: OPTION A**.
*Lý do:* `SecurityEngine` nên là "Người điều phối" (Orchestrator) chứ không phải "Người hiểu biết" (God Object). Nếu Engine tự đọc file và truyền nội dung vào Scanner, nó sẽ phải load toàn bộ nội dung của mọi file vào RAM (nguy cơ OOM đối với file lock 20MB). Việc để `SecurityScanner` (Option A) tự quyết định có mở file ra đọc hay không (dựa trên tên file `path`) giúp tối ưu I/O. `DependencyScanner` chỉ mở file nếu đó là Manifest/Lockfile.

---

## Tóm tắt Component Domain Design

**1. DependencyMetadata (Rust & TS)**
```rust
#[derive(Serialize)]
pub struct DependencyMetadata {
    pub ecosystem: String,      // "npm", "maven"
    pub package_name: String,   // "lodash"
    pub current_version: String,// "4.17.15"
    pub fixed_version: Option<String>,
}
```

**2. Parser Abstraction**
```rust
pub trait DependencyManifestParser {
    fn parse(&self, content: &str) -> Result<Vec<ParsedDependency>, String>;
}
// Implementations: NodePackageParser, NodeLockfileParser, MavenPomParser
```

**3. VersionResolver**
Ưu tiên: 
1. Lockfile Exact Version
2. Manifest Version
3. Unresolved/Skip

**4. VulnerabilityProvider Abstraction**
```rust
#[async_trait]
pub trait VulnerabilityProvider: Send + Sync {
    async fn get_vulnerabilities(&self, deps: &[Dependency]) -> Result<Vec<Vulnerability>, String>;
}
// Implementation: OsvProvider
```

---

## DEPENDENCY DECISION
- **serde_json**: EXISTING (Tái sử dụng cho Node parser và API response).
- **quick-xml**: ADD (Cần thiết cho Maven `pom.xml`, không thể parse bằng regex tĩnh an toàn. Sẽ làm tăng nhẹ thời gian compile).
- **reqwest**: ADD (Bắt buộc để gọi API OSV Batching qua HTTP. `hyper` quá thấp, `ureq` blocking. `reqwest` phù hợp nhất vì có sẵn hệ sinh thái tokio).

---

## ARCHITECTURE STATUS: PASS
## DEPENDENCY DECISION:
- serde_json: EXISTING
- quick-xml: ADD
- HTTP client: ADD (reqwest)
## SECURITYENGINE CHANGE: NOT REQUIRED
## DOMAIN CHANGE: REQUIRED (Thêm trường metadata)
## FRONTEND CONTRACT CHANGE: REQUIRED
## PERFORMANCE RISK: MEDIUM (Cần kiểm soát size của JSON Lockfile)
## SECURITY RISK: LOW (Vẫn tuân thủ Redaction, không token, offline mode support thông qua caching)
## IMPLEMENTATION READY: YES
