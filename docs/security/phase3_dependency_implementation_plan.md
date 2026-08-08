# Phase 3: Dependency Scanner Implementation Plan

Tài liệu này xác định các Phase cụ thể nhằm phát triển **Dependency Security Scanner** tích hợp vào hệ thống Security Engine của DCC.

---

## Phase 3A: Offline Dependency Domain + Parsers
- **Scope**: Thiết kế model dữ liệu dependency nội bộ. Xây dựng Parser để bóc tách thông tin từ `package.json`, `package-lock.json`, và `pom.xml`. Toàn bộ hoạt động hoàn toàn offline.
- **Files**:
  - `src-tauri/src/security/domain.rs` (Cập nhật struct metadata)
  - `src-tauri/src/security/dependency_scanner/mod.rs`
  - `src-tauri/src/security/dependency_scanner/parser.rs` (Trait định nghĩa)
  - `src-tauri/src/security/dependency_scanner/parsers/node.rs`
  - `src-tauri/src/security/dependency_scanner/parsers/maven.rs`
- **Dependencies**: Bổ sung `quick-xml` vào `Cargo.toml`. Sử dụng `serde_json` có sẵn.
- **Risks**: Crash do Parse JSON/XML dung lượng lớn (các file lock).
- **Regression Risks**: Thêm Struct mới có thể làm hỏng định dạng Deserialize IPC cũ nếu không dùng `Option`.
- **Validation**:
  - Offline Unit Test: Tạo mock JSON/XML để kiểm tra việc đọc dependencies trực tiếp, dev, và lockfile v1/v2/v3 của Node.
  - Test bỏ qua (Skip tests) trên file malformed/lỗi syntax.
- **Rollback Strategy**: Loại bỏ module, fallback về state Phase 2 thông qua Git.

## Phase 3B: Version Resolution + Normalization
- **Scope**: Dựa trên kết quả bóc tách từ Parser, chuẩn hóa thành các thông tin version cuối cùng. Ưu tiên lockfile exact version > manifest version > properties version (Maven).
- **Files**:
  - `src-tauri/src/security/dependency_scanner/resolver.rs`
- **Dependencies**: Không có. (Tự xử lý chuỗi cơ bản).
- **Risks**: Version unresolved làm gián đoạn API query OSV.
- **Validation**: Đảm bảo version lấy được trong mock test là exact version từ lockfile, không phải version semantic range từ package.json.

## Phase 3C: VulnerabilityProvider abstraction
- **Scope**: Xây dựng Trait API độc lập giữa Dependency Scanner và nơi cung cấp dữ liệu lỗi (OSV API hoặc Data tĩnh).
- **Files**:
  - `src-tauri/src/security/dependency_scanner/provider.rs`
- **Dependencies**: Không có.
- **Risks**: Rò rỉ interface design gây coupling.
- **Validation**: `cargo check`.

## Phase 3D: OSV Provider + Batch Query
- **Scope**: Triển khai `OsvProvider` gọi thẳng HTTP OSV Batch API.
- **Files**:
  - `src-tauri/src/security/dependency_scanner/osv.rs`
  - `Cargo.toml` (thêm `reqwest` + features: `json`, `rustls-tls`).
- **Dependencies**: `reqwest`.
- **Risks**:
  - Timeout, network disconnect.
  - OSV API rate limits nếu push quá nhanh.
- **Validation**: Unit test verify request format tới Mock server hoặc test chay xem serde model trả về của OSV chuẩn không.

## Phase 3E: Caching
- **Scope**: Tối ưu hóa OSV HTTP query bằng bộ nhớ đệm In-Memory.
- **Files**:
  - `src-tauri/src/security/dependency_scanner/cache.rs`
- **Dependencies**: Dùng sẵn `std::collections::HashMap` cùng `Mutex`.
- **Risks**: Memory leak nếu scan quá nhiều dependency khổng lồ.
- **Validation**: Quét 2 package giống hệt, HTTP client mock chỉ được gọi 1 lần.

## Phase 3F: DependencyScanner + SecurityEngine Integration
- **Scope**: Gói mọi thứ lại vào Struct `DependencyScanner`, implement `SecurityScanner` trait, và inject vào `SecurityEngine`.
- **Files**:
  - `src-tauri/src/security/dependency_scanner/mod.rs`
  - `src-tauri/src/security/engine.rs`
- **Risks**: Scanner block quá trình duyệt file của engine nếu async timeout lỗi.
- **Validation**: Chạy Scan thực tế (dry run offline) và đảm bảo logs in ra các file package.json được phát hiện.

## Phase 3G: IPC + SecurityOverview
- **Scope**: Nhận luồng `FindingsChunk` với metadata mới trên Frontend, tạo component hiển thị Dependency Badge trong React.
- **Files**:
  - `src/domain/entities/SecurityFinding.ts`
  - `src/features/security/pages/SecurityOverview.tsx`
- **Risks**: Unhandled UI exceptions do parse lỗi undefined JSON field.
- **Validation**: Tạo fake Mock findings với Dependency ecosystem và đảm bảo UI render đúng CSS/Tailwind theo thiết kế.

## Phase 3H: Testing + Performance
- **Scope**: Cấu hình Benchmark và Test diện rộng. Đảm bảo UI mượt khi hàng ngàn dependencies stream qua IPC.
- **Files**: `tests/security/benchmark_deps.rs`
- **Risks**: Nặng CPU do `serde_json` handle lockfile 20MB.
- **Validation**: Giám sát bằng Resource Monitor (Phase 1) lúc Scan để xem mức trần CPU/RAM khi OSV batch process chạy.
- **Rollback Strategy**: Nếu performance quá tệ, hạ chunk size từ 50 xuống 10, đưa việc OSV check ra background worker.

---

**IMPLEMENTATION GATE: PENDING**
