# Git Exposure Recursive Scope Audit

## 1. Phân tích luồng (Flow Analysis)

Khi người dùng chọn Scan Target (ví dụ: `workspace/`), `SecurityEngine` thực thi:
1. `validate_root`: chuyển đổi sang absolute path (`canonical_root`).
2. Hardcode check `.git/config`: kiểm tra ngay lập tức `canonical_root.join(".git/config")`.
3. `ignore::Walk::new(&canonical_root)`: Duyệt đệ quy (recursive traversal) qua tất cả các file trong cây thư mục.
4. Với mỗi file (skip directories), chạy các scanner đang active (trong trường hợp này là `git_scanner`).

## 2. Giải đáp các câu hỏi Audit

**1. Git scanner nhận scan target ở dạng gì?**
Target được truyền dưới dạng một đường dẫn chuỗi (String path), sau đó chuyển thành `PathBuf` của root directory.

**2. Scanner có recursive traversal không?**
Có, backend có sử dụng `ignore::Walk` để traversal đệ quy.

**3. Nó có chỉ kiểm tra `target/.git/config` hay không?**
Trước vòng lặp traversal, code có đoạn hardcode:
```rust
let git_config = canonical_root.join(".git").join("config");
if git_config.is_file() { ... }
```
Nhờ đoạn này, target root là repo thì được phát hiện.

**4. Đặc tính của recursive traversal (`ignore::Walk`)**
- Có bỏ qua `.git` directory không? **CÓ**. Đây là default behavior của thư viện `ignore` (coi `.git` là thư mục ẩn/quan trọng cần skip đệ quy để tránh lặp vô hạn hoặc overhead lớn).
- Có bỏ qua hidden directory không? **CÓ** (các thư mục bắt đầu bằng `.`).
- Có giới hạn depth không? Không bị giới hạn chiều sâu, nhưng bị chặn bởi các quy tắc ignore trên.

**5. Nếu target là parent directory chứa repository con, `.git/config` có được discover không?**
**KHÔNG**. Do `ignore::Walk` bỏ qua thư mục `.git` của các repository con, nên file `.git/config` bên trong chúng không bao giờ được yield dưới dạng file entry.

**6. Có logic nào yêu cầu target phải là repository root không?**
Đoạn code hardcode kiểm tra trực tiếp `.git/config` ngay tại `canonical_root` chính là logic ngầm định target là repository root.

**7. Có canonicalization/path normalization nào làm mất nested repository không?**
Không, `fs::canonicalize` không làm mất. Chính bộ lọc của `ignore::Walk` là tác nhân.

**8. Có security boundary nào đang ngăn recursive scan không?**
Boundary chính là cơ chế chống duyệt đệ quy vào các thư mục `.git` (để tránh quét `objects`, `pack` rất nặng). Cơ chế này tốt, nhưng nó làm mất luôn khả năng inspect file config.

**9. Quick Scan / Full Scan có sử dụng filesystem traversal khác không?**
Không, chúng sử dụng chung luồng `ignore::Walk`.

**10. Có nguy cơ scan nhầm `.git` trong node_modules, target, v.v. không?**
Vì `ignore::Walk` tôn trọng `.gitignore`, các thư mục bị git ignore như `node_modules` sẽ an toàn bị skip. Chúng ta không nên ép `Walk` bỏ qua `.gitignore`.

## 3. Kiến trúc Đề xuất (Fix Strategy)

Không thay đổi cấu hình `.git` ignore của `ignore::Walk` vì điều đó sẽ khiến scanner phải duyệt qua hàng vạn file `objects` vô nghĩa bên trong `.git/`.

**Thay vào đó:**
1. `ignore::Walk` vẫn yield ra các **Directory Entry** (ví dụ: `workspace/repo-a`).
2. Hiện tại `engine.rs` đang bỏ qua thư mục: `if !entry.file_type().is_file() { continue; }`.
3. Chúng ta có thể tận dụng lúc `entry` là directory để kiểm tra xem `entry.path().join(".git/config")` có tồn tại không. Nếu có, đó là một nested repository, và ta đưa file config đó vào scanner.
4. Cách này O(1) kiểm tra cho mỗi thư mục, tận dụng hoàn toàn traversal hiện tại, cực kỳ an toàn, nhanh chóng và tự động cover luôn cả `canonical_root` (vì `Walk` yield root đầu tiên). Đoạn hardcode cũ có thể bị gỡ bỏ.
