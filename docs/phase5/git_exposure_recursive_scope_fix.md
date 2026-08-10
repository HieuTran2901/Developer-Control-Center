# Git Exposure Recursive Scope Fix Report

## 1. Root Cause
- Trình duyệt đệ quy (recursive traversal) của backend `SecurityEngine` sử dụng `ignore::Walk`.
- Thư viện `ignore::Walk` được thiết kế để tự động bỏ qua (skip) các thư mục ẩn và thư mục quản trị mã nguồn (cụ thể là `.git`).
- Do đó, thuật toán duyệt file mặc định không bao giờ tiếp cận được vào bên trong các thư mục `.git` nằm sâu (nested) trong scan target.
- Cách fix tạm thời trước đây (đã bị gỡ bỏ): Hardcode kiểm tra trực tiếp `canonical_root.join(".git").join("config")`. Điều này khiến scanner chỉ hoạt động nếu root directory được chọn trực tiếp là repository root.

## 2. Current Scan Scope (Trước khi sửa)
- Chỉ scan file tại đường dẫn chính xác: `<selected-root>/.git/config`.
- Các project con (nested repository) như `<selected-root>/repo-a/.git/config` bị bỏ sót hoàn toàn.

## 3. New Scan Scope (Sau khi sửa)
- Quét `<selected-root>/.git/config` (nếu `<selected-root>` là Git repository).
- Quét toàn bộ `<selected-root>/**/.git/config` (bất kỳ repository con nào nằm ở bất kỳ độ sâu nào).
- **Trường hợp loại lệ:** Vẫn tôn trọng cấu hình `.gitignore`, nghĩa là nếu một repository con nằm trong `node_modules/` hoặc `vendor/`, nó vẫn bị bỏ qua một cách an toàn.

## 4. Repository Discovery Strategy (Chiến lược phát hiện)
- Thay vì thay đổi cơ chế của `ignore::Walk` (bắt nó phải duyệt sâu vào hàng vạn file `objects` rác của `.git` - có thể làm treo máy), tôi đã tận dụng lúc `ignore::Walk` yield ra các thư mục cha (ví dụ `repo-a`).
- Với mỗi thư mục (directory entry) quét được, engine sẽ O(1) kiểm tra sự tồn tại của file `entry.path().join(".git/config")`.
- Nếu có, file config đó được đưa vào hàng đợi `paths_to_scan`. 
- Giải pháp này không đi vào trong thư mục `.git`, bảo toàn hiệu năng siêu tốc, đồng thời không bỏ sót bất kỳ nested repository nào.

## 5. Traversal Safety
- Tuyệt đối an toàn: không mở rộng (expand) `.git` traversal.
- Ngăn chặn infinite traversal vì không follow symlink của `.git`.
- Bảo toàn exclusion mechanism gốc của app (bỏ qua `target/`, `node_modules/`, v.v.).

## 6. Duplicate Handling
- Đã thiết lập `scanned_git_configs = HashSet::new()` để theo dõi các `.git/config` đã được đưa vào queue scan.
- Nếu `ignore::Walk` bằng cách nào đó trả lại đường dẫn đó, `HashSet::insert()` sẽ block không cho phép đưa vào queue lần 2. Đảm bảo 0 duplicate finding.
- Cấu trúc Deduplication ID finding vẫn được giữ nguyên (`HashSet::insert(f.id.clone())`).

## 7. Tests
- Thêm các test fixtures theo yêu cầu (Phase F):
  - `tests/security-fixtures/git-exposure/root-repo/.git/config`
  - `tests/security-fixtures/git-exposure/nested/repo-a/.git/config`
  - `tests/security-fixtures/git-exposure/nested/repo-b/.git/config`
  - `tests/security-fixtures/git-exposure/clean-folder/dummy.txt`

## 8. Regression Results
- `cargo check`: PASS (không warning ở engine core).
- `cargo test`: PASS 11/11 tests. Test scanner hoạt động tốt.
- Quick Security Scan: Không thay đổi behavior (vẫn bỏ qua git exposure scanner như kỳ vọng vì filter mode = Quick không include git_scanner).
- Full Security Scan & Git Exposure Scan: Vẫn bắt được credentials với Finding Metadata đầy đủ.

## 9. Performance Considerations
- Chi phí chỉ thêm **1 operation O(1)** (check existence của file config) cho mỗi thư mục bình thường. 
- Overhead thời gian gần như bằng 0 (khoảng vài microsecond).
- Tối ưu đoạn code lặp 40 dòng cũ, giảm độ phức tạp cyclomatic (refactoring).

## 10. Remaining Technical Debt
- Không có Technical Debt đáng kể trong phạm vi xử lý traversal.
- Engine code giờ đây DRY và Single-Responsibility hơn.
