# PRE-FLIGHT ARCHITECTURE AUDIT - REAL FILE SCAN VALIDATION

## 1. Real filesystem entry point nằm ở đâu?
Entry point xử lý real filesystem nằm tại `src-tauri/src/security/engine.rs` ở hàm `SecurityEngine::start_scan()`. Hàm này tiến hành:
- Canonicalize root path.
- Gọi hàm `Self::get_files_in_bounds()` để traverse thư mục đệ quy (bỏ qua `node_modules`, `target`, `.git`, v.v. và chống path traversal/symlink escape).
- Tạo danh sách các `PathBuf` đại diện cho real file paths.

## 2. Scanner nào được register?
Hệ thống hiện tại register 2 scanners trong hàm `SecurityEngine::new()`:
1. `CoreSecretScanner`
2. `DependencyScanner` (inject cùng `OsvProvider` thực hiện network request).

## 3. SecurityEngine truyền Path như thế nào?
Trong một async task, Engine lặp qua danh sách files:
```rust
for (i, path) in files.iter().enumerate() { ... }
```
Với mỗi file, Engine lặp qua tất cả registered scanners và truyền reference `&path` (cùng clone của `cancel_token`) qua hàm `scanner.scan(path, cancel_token.clone()).await`.

## 4. SecretScanner nhận file nào?
`CoreSecretScanner` nhận TẤT CẢ các file do `get_files_in_bounds()` trả về.
- Nó kiểm tra 1024 bytes đầu tiên, nếu có chứa byte `0` (null byte), nó được phân loại là binary và bị skip.
- Nếu là file text hợp lệ, nó đọc file theo từng dòng (line by line) và áp dụng regex để tìm Secret (AWS, GitHub, JWT, Private Keys).

## 5. DependencyScanner nhận file nào?
`DependencyScanner` nhận TẤT CẢ các file, nhưng nó tự short-circuit/skip bằng cách kiểm tra file name:
- Nó chỉ xử lý nếu file name là: `package.json`, `package-lock.json` hoặc `pom.xml`.
- Nếu gặp `package-lock.json` độc lập, nó skip ngay lập tức (vì lockfile được xử lý gộp chung khi gặp `package.json`).

## 6. Findings được aggregate như thế nào?
Findings được gom theo từng file. Khi một scanner quét xong 1 file và trả về vector `findings`, Engine tiến hành:
- Lọc trùng (deduplicate) trong nội bộ scope đó bằng `HashSet`.
- Áp dụng `Redactor` lên evidence của finding.
- Tính toán tổng số lượng findings theo mức độ nghiêm trọng (Critical, High, v.v.).
- Đẩy finding vào buffer cục bộ `chunk`.

## 7. FindingsChunk được gửi qua IPC ở đâu?
Khi `chunk.len() >= 50`, `SecurityEngine` dùng `app_handle.emit("security_event", SecurityScanEvent::FindingsChunk { ... })` để đẩy chunk qua cho Frontend. Khi vòng lặp kết thúc, phần chunk còn lại cũng được flush.

## 8. Frontend nhận chunk ở đâu?
Frontend lắng nghe event `security_event` qua Tauri IPC (thông qua `EventBus` hoặc hook trong React, cụ thể là tại `SecurityOverview` frontend code).

## 9. Cancellation token đi qua pipeline như thế nào?
`cancel_token` (kiểu `Arc<AtomicBool>`) được Engine khởi tạo và lưu trong `active_scans` map. Nó được truyền theo reference/clone vào:
- `get_files_in_bounds`: Hủy nếu lệnh dừng đến khi đang quét thư mục.
- Vòng lặp duyệt file của Engine.
- Vòng lặp gọi scanners của Engine.
- Vào tận bên trong `SecretScanner` (kiểm tra sau mỗi line đọc) và `DependencyScanner` (kiểm tra trước khi batch OSV).

## 10. Network call tới OSV nằm ở đâu?
Trong `src-tauri/src/security/dependency_scanner/osv.rs`, hàm `get_vulnerabilities`. Tại đây OSV Provider thực hiện HTTP POST request lên endpoint `https://api.osv.dev/v1/querybatch`.

## 11. Có chỗ nào có nguy cơ gửi source content lên OSV không?
Không. Đầu vào của OSV Query là `VulnerabilityQuery` struct, chỉ bao gồm 3 trường:
- `ecosystem`
- `name` (tên thư viện)
- `version` (phiên bản)
Scanner parser trích xuất các thông tin này từ package.json/lock/pom.xml. Không có source file, environment variables hay code content nào lọt vào query.

## 12. Binary file được xử lý như thế nào?
`get_files_in_bounds` đẩy tất cả các file (kể cả binary) vào danh sách nếu nó đi qua bộ lọc tên.
Tại `CoreSecretScanner`: đọc 1024 bytes đầu và tìm null byte (0u8), nếu thấy sẽ skip lập tức.
Tại `DependencyScanner`: bỏ qua ngay lập tức vì tên file không phải `package.json` hoặc `pom.xml`.
Như vậy hệ thống an toàn trước binary files.

## 13. Deduplication xảy ra ở đâu?
- **Scanner-level (Engine)**: Engine lặp qua các finding trả về cho *cùng 1 file* và loại bỏ finding có trùng `id` bằng `HashSet`. 
- **OSV cache-level**: OSV Provider dùng `cache` map nội bộ (Cache bằng ecosystem/name/version) để tránh query OSV nhiều lần cho một thư viện lặp lại trên nhiều file.

## 14. Redaction xảy ra ở đâu?
Trong vòng lặp xử lý finding của `SecurityEngine` (`engine.rs:184`):
```rust
for mut finding in findings {
    if let Some(ev) = finding.evidence.as_ref() {
        let redacted = redactor.redact(&ev.0);
        finding.evidence = Some(redacted);
    }
    // ...
}
```
Mỗi evidence đều được pass qua `Redactor` (implement `DefaultRedactor`) trước khi serialize và gửi IPC xuống frontend. Raw secret không đi qua IPC đối với trường evidence.
