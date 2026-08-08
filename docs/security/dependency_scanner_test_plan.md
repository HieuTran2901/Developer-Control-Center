# Dependency Scanner Test Plan

## A. NODE
1. **package.json đơn giản**: Test parse `dependencies`, `devDependencies`, `optionalDependencies` mà không có lockfile. (Mock JSON).
2. **package-lock v1**: Đọc `dependencies` object. Đảm bảo version match exact.
3. **package-lock v2 & v3**: Đọc `packages` object, xử lý cấu trúc mới của npm. Đảm bảo parse đúng name và exact version.
4. **dependency không có version**: Đảm bảo Parser không throw error, skip hoặc gán giá trị unknown.
5. **malformed JSON**: Báo lỗi Result Err() thay vì Panic. Progress vẫn tiếp tục với các file khác.
6. **empty dependencies**: Trả về Mảng rỗng (0 dependencies).
7. **duplicate dependency**: Hashmap trong VersionResolver sẽ xử lý trùng lặp.
8. **dev dependency**: Phân biệt trường `type=Dev` để OSV finding mapping mức `confidence` hoặc hiển thị UI chi tiết.

## B. MAVEN
1. **pom.xml đơn giản**: Parse XML node `dependency` với `groupId`, `artifactId`, `version`.
2. **dependency có version**: Normal.
3. **dependency thiếu version**: (e.g. kế thừa từ parent pom hoặc dependencyManagement). Phase 3A: Đánh dấu `Unresolved`, không lỗi.
4. **malformed XML**: Báo Err(), không crash, engine tiếp tục.
5. **dependencyManagement**: Parse và bỏ qua dependency block này vì không trực tiếp cài đặt (hoặc chỉ dùng như lock resolve hint nếu implement nâng cao). Phase 3A: Skip.
6. **inherited version**: Bỏ qua nếu không parse được (limitation của static scan không chạy Maven reactor).

## C. OSV
1. **vulnerable package**: Mock HTTP OSV response trả về 1 lỗ hổng. (Test mapper `SecurityFinding`).
2. **safe package**: Mock HTTP OSV trả về `{"vulns": []}`.
3. **multiple vulnerabilities**: Chọn severity lớn nhất hoặc tạo multiple findings (dựa trên format design).
4. **batch query**: Send query mảng json `{"queries": [{"package": {"name": ...}}]}` size 1000.
5. **duplicate dependency**: Cache layer sẽ chặn HTTP call lần 2. (Cache hit counter == 1).
6. **network failure**: `VulnerabilityProvider` trả về `Err`, Scanner đổi status thành Error nhưng không crash App.
7. **timeout**: 5 giây timeout, throw Warning.
8. **cancellation**: Đang request mà cancel token trigger, lập tức abort request loop.

## D. ENGINE
1. **Secret + Dependency cùng chạy**: Đảm bảo Engine spawn Future `scan` cho cả hai Scanner. (Integration test `SecurityEngine::start_scan`).
2. **FindingsChunk vẫn đúng**: Chunk vẫn batch thành mảng 50.
3. **Deduplication vẫn hoạt động**: Dựa trên Finding ID (`file_path:line:detector_type`). 
4. **Cancellation vẫn hoạt động**: Loop trong DependencyScanner phải tuân thủ `.await` + `cancel_token.load()`.
5. **Security Scan không crash**: OSV API chết không làm rụng `CoreSecretScanner`.

## E. FRONTEND
1. **Dependency finding render đúng**: Mock `FindingsChunk` có `metadata` và đẩy vào EventBus.
2. **Secret finding không bị regression**: Mock Secret Finding đi qua UI không bị vỡ giao diện.
3. **Unknown category không crash UI**: Dùng default template nếu Frontend nhận được category không code (ví dụ `Config`).
4. **Empty result**: Hiển thị state "No vulnerabilities".
5. **Large result**: 5000 dependencies (100 chunks) không bị freeze React render tree.

## F. PERFORMANCE AUDIT
- Thực thi benchmark bằng Cargo Bench hoặc Test Loop.
- Load file Mock `package-lock.json` có size 10MB (khoảng 3000 dependencies).
- Yêu cầu: Deserialization JSON hoàn tất dưới 50ms.
- OSV Batch Query (1 request/1000 items) hoàn tất dưới thời gian timeout (thường 2s).
- IPC EventBus dispatch: Dưới 1ms mỗi chunk 50 items.
- Cancellation check: Latency < 1ms từ lúc bấm Cancel đến lúc Token abort vòng lặp.
