# Dependency Scanner Implementation Plan

## Phase 3A: Offline Dependency Domain + Parsers
- **Scope**: Thiết kế model dữ liệu `DependencyMetadata`. Xây dựng interface `DependencyManifestParser` và implement `NodePackageParser` (package.json/lockfile) cùng `MavenPomParser` (pom.xml).
- **Files**:
  - `src-tauri/src/security/domain.rs`
  - `src-tauri/src/security/dependency_scanner/mod.rs`
  - `src-tauri/src/security/dependency_scanner/domain.rs`
  - `src-tauri/src/security/dependency_scanner/parser.rs`
  - `src-tauri/src/security/dependency_scanner/parsers/node.rs`
  - `src-tauri/src/security/dependency_scanner/parsers/maven.rs`
- **Dependencies**: Thêm `quick-xml` vào `Cargo.toml`.
- **Risks**: Crash khi deserialize XML lồng nhau hoặc JSON 20MB.
- **Regression Risks**: Phá vỡ Serialize/Deserialize struct do thêm `metadata`.
- **Validation**: `cargo check`, viết offline unit test JSON/XML mock data.
- **Rollback Strategy**: Loại bỏ mod `dependency_scanner` và phục hồi version cũ của `domain.rs`.

## Phase 3B: Version Resolution + Normalization
- **Scope**: Thiết kế `VersionResolver` kết hợp Manifest parser và Lockfile parser để xác định exact version theo mức ưu tiên: Lockfile -> Manifest -> Skip.
- **Files**: `src-tauri/src/security/dependency_scanner/resolver.rs`
- **Dependencies**: Tái sử dụng Code. Không thêm dependency.
- **Risks**: Rủi ro logic sai sót khi mapping lockfile với node_modules alias trong JSON v3.
- **Validation**: Đảm bảo mock test ưu tiên resolve lockfile version hơn package.json version.
- **Rollback Strategy**: Git revert file.

## Phase 3C: VulnerabilityProvider abstraction
- **Scope**: Tạo Trait API độc lập giữa Business Logic Scanner và Network Data Provider.
- **Files**: `src-tauri/src/security/dependency_scanner/provider.rs`
- **Dependencies**: `async_trait` (nếu cần thiết, hoặc dùng std future trait).
- **Risks**: None. Interface design phase.
- **Validation**: Compile thành công.
- **Rollback Strategy**: Git revert.

## Phase 3D: OSV Provider + Batch Query
- **Scope**: Triển khai `OsvProvider` tích hợp OSV HTTP Batch API (`POST /v1/querybatch`).
- **Files**: 
  - `src-tauri/src/security/dependency_scanner/osv.rs`
  - `Cargo.toml`
- **Dependencies**: Bổ sung `reqwest`.
- **Risks**: Endpoint timeout, Rate limit, HTTP 429/500 errors.
- **Validation**: Network mock / log timeout bypass. 
- **Rollback Strategy**: Chuyển `VulnerabilityProvider` về Dummy implementation (always return Ok(Empty)).

## Phase 3E: Caching
- **Scope**: Xây dựng cơ chế LRU in-memory cache tĩnh trong giới hạn một lần khởi chạy Scan để tránh query OSV API nhiều lần với cùng 1 package version.
- **Files**: `src-tauri/src/security/dependency_scanner/cache.rs`
- **Dependencies**: Không (Dùng HashMap hoặc LRU nếu project đã có cache crate, tạm thời dùng HashMap).
- **Risks**: Tràn RAM nếu cache map quá lớn.
- **Validation**: In log debug cache hit/miss count.
- **Rollback Strategy**: Xóa bypass cache.

## Phase 3F: DependencyScanner + SecurityEngine Integration
- **Scope**: Gói mọi thứ vào Struct `DependencyScanner`, tuân thủ trait `SecurityScanner`. Thực thi logic: Open File -> Parse -> Resolve -> Osv Query -> Tạo `SecurityFinding`.
- **Files**: `src-tauri/src/security/dependency_scanner/scanner.rs`, `src-tauri/src/security/engine.rs` (Đăng ký module).
- **Risks**: Scanner block tokio thread quá lâu do batch HTTP call đồng bộ mà không chịu yield.
- **Regression Risks**: Nếu không check `cancel_token`, module này sẽ cản trở Cancellation System.
- **Validation**: Test cancellation phải trả về Ok(vec![]) ngay tức thì.
- **Rollback Strategy**: Gỡ `register_scanner`.

## Phase 3G: IPC + SecurityOverview
- **Scope**: Frontend đón `FindingsChunk` có `metadata` và xử lý logic render.
- **Files**: `SecurityFinding.ts`, `SecurityOverview.tsx`
- **Risks**: Mất type-safety do parse generic JSON.
- **Validation**: Thử render UI với Dummy OSV Data.
- **Rollback Strategy**: Không hiển thị Dependency category, hoàn tác TS code.

## Phase 3H: Testing + Performance
- **Scope**: Thực hiện benchmark 1,000 tới 5,000 dependencies (dùng OSV QueryBatch size 1000/req). Đo đạc CPU/RAM.
- **Files**: `tests/security/dependency_bench.rs`
- **Risks**: Chậm chạp làm ảnh hưởng Secret Scanner do share cùng Tokio runtime.
- **Validation**: Nếu I/O chặn, tiến hành bọc File Open trong `spawn_blocking`.
