# Phase 3 Dependency Scanner Implementation Plan

## Phase 3.1: Domain Model
- **Goal**: Mở rộng SecurityFinding/evidence hoặc metadata để chứa thông tin package ecosystem. 
- **Files**: `src-tauri/src/security/domain.rs`, `SecurityFinding.ts`.
- **Changes**: Thêm struct hoặc JSON enum cho Dependency metadata.
- **Risks**: Type breakage trên IPC.
- **Rollback Strategy**: Giữ type tương thích, fallback về Option<String>.

## Phase 3.2: Manifest Parser Abstraction
- **Goal**: Tạo Trait `ManifestParser` độc lập có thể phân tích JSON, XML và trả về generic dependency list.
- **Files**: `src-tauri/src/security/dependency_scanner.rs`.
- **Changes**: Định nghĩa `trait ManifestParser { fn parse(...) -> Vec<Package>; }`
- **Risks**: Không đáng kể.

## Phase 3.3: Node Dependency Parser
- **Goal**: Implement parser cho `package.json` và `package-lock.json`.
- **Files**: `src-tauri/src/security/parsers/node.rs`.
- **Changes**: Sử dụng `serde_json` để extract dependencies. Hỗ trợ lockfile v1/v2/v3 packages.

## Phase 3.4: Maven Dependency Parser
- **Goal**: Implement parser cho `pom.xml`.
- **Files**: `src-tauri/src/security/parsers/maven.rs`.
- **Changes**: Tích hợp crate `quick-xml` để extract dependency node đơn giản, bỏ qua inheritance phức tạp (như thiết kế architecture).

## Phase 3.5: Version Resolution
- **Goal**: Chuẩn hóa version extracted từ Manifest thành version OSV có thể chấp nhận.
- **Files**: Các module node/maven parser.
- **Changes**: Ưu tiên lockfile version (exact).

## Phase 3.6: Vulnerability Provider
- **Goal**: Triển khai `VulnerabilityProvider` kết nối tới OSV batch API.
- **Files**: `src-tauri/src/security/osv_provider.rs`, `Cargo.toml`.
- **Changes**: Thêm `reqwest` crate (hoặc `ureq`). Tạo trait `VulnerabilityProvider`.
- **Risks**: Quá nhiều connection. Bắt buộc dùng endpoint `querybatch` của OSV.

## Phase 3.7: Caching
- **Goal**: Caching HTTP lookup.
- **Files**: `osv_provider.rs`.
- **Changes**: Lưu kết quả tra cứu vào `HashMap<String, Option<VulnerabilityData>>` trong bộ nhớ tĩnh trong vòng đời quét.

## Phase 3.8: SecurityEngine Integration
- **Goal**: Đăng ký Scanner.
- **Files**: `src-tauri/src/security/engine.rs`.
- **Changes**: `engine.register_scanner(Box::new(DependencyScanner::new(osv_provider)))`.

## Phase 3.9: IPC Integration
- **Goal**: Tương thích IPC batching hiện tại.
- **Files**: `dependency_scanner.rs`, `engine.rs`.
- **Changes**: Map OSV finding thành `SecurityFinding` chuẩn với `category = Dependency`.

## Phase 3.10: Frontend Integration
- **Goal**: Cập nhật cách hiển thị trên UI.
- **Files**: `SecurityOverview.tsx`.
- **Changes**: Hiển thị riêng rẽ badge Dependency với thông tin version. (Sẽ update UI mở rộng).

## Phase 3.11: Testing
- **Goal**: Unit Test Mock OSV & Manifest Parsers.
- **Files**: `tests/*`.
- **Changes**: Add unit tests cho parser và batch logic.

## Phase 3.12: Performance Validation
- **Goal**: Đảm bảo tốc độ IPC chunk không block.
- **Changes**: Chạy scan trên file mock `package-lock.json` khổng lồ và xác thực latency/cancellation.
