# SECURITY SCAN TEST FIXTURE AUDIT

## 1. Phân tích các chế độ Scan

Theo cấu trúc trong `src-tauri/src/security/engine.rs`, các chế độ Scan được phân luồng (isolate) như sau:

1. **Quick Security Scan**
   - Chạy các scanner: `core_secret_scanner`, `configuration_scanner`.
2. **Git Exposure Scan**
   - Chạy các scanner: `git_scanner`.
3. **Full Security Scan**
   - Chạy TẤT CẢ scanner: `core_secret_scanner`, `configuration_scanner`, `git_scanner`, `dependency_scanner`.

---

## 2. Phân tích chi tiết từng Scanner (Input & Patterns)

### A. Core Secret Scanner (`core_secret_scanner`)
- **Phạm vi file:** Tất cả các file text đi qua bộ lọc của `ignore::Walk` (tôn trọng `.gitignore`).
- **Secret Patterns:**
  - `AWS Access Key`: `(AKIA|ASIA)[0-9A-Z]{16}`
  - `GitHub Token`: `(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}`
  - `JWT Token`: Pattern `eyJ...`
  - `Private Key`: `-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----`
- **Đặc điểm phụ:** Nếu file path chứa từ `test` hoặc `fixture`, scanner sẽ tự động giảm `confidence (-40)` và hạ severity xuống `Low`. *(Do thư mục fixture nằm trong `tests/security-fixtures/`, mọi finding sẽ có severity là Low).*

### B. Configuration Scanner (`configuration_scanner`)
- **Phạm vi file:** Chỉ xử lý file có extension là `.json`, `.yml`, `.yaml`. Kích thước tối đa 5MB.
- **Rules:**
  - `debug: true`: Báo High.
  - `cors: "*"` hoặc `Access-Control-Allow-Origin: "*"`: Báo Medium.

### C. Git Security Scanner (`git_scanner`)
- **Phạm vi file:** CHỈ xử lý file có đường dẫn kết thúc bằng `.git/config` hoặc `.git\config`.
- **Yêu cầu Input:** File text thông thường có chứa chuỗi dạng `url = https://<credentials>@<host>`.
- **Đặc điểm phụ:** Không yêu cầu đây phải là một kho lưu trữ Git thực tế. Nó không gọi lệnh `git`, chỉ parse Regex.
- **Architectural Note:** Scanner này **KHÔNG** đọc Git index hay lịch sử Git. Do đó nó không có khả năng phát hiện "tracked secrets" hay file lộ trên index.

### D. Dependency Scanner (`dependency_scanner`)
- **Phạm vi file:** `package.json`, `pom.xml`.
- **Đặc điểm phụ:** Truy vấn OSV API thật (`osv.dev`) để kiểm tra vulnerability dựa vào package và version. Cần mạng.

---

## 3. Kiến trúc luồng thực thi (Data Flow)

- Dựa trên `ignore::WalkDir`, **mặc định bỏ qua các file trong `.gitignore`**. 
- Tuy nhiên, `engine.rs` chủ động bypass và load `.git/config` cho mọi scanner quét (do thư mục `.git` bị ignore theo mặc định).
- Filter scanner (mode) được áp dụng trước khi quét vòng lặp.

---

## 4. Expected Findings cho Fixture

### 4.1 Quick Scan
- **Expected:** Bắt được các lỗi từ `.env` (chứa AWS Access Key) và `application.yml` (chứa debug/CORS).
- **Not Expected:** Các lỗi Git Remote và Dependency Vulnerability.

### 4.2 Git Exposure Scan
- **Expected:** Chỉ bắt được hardcoded credentials trong `.git/config`.
- **Architectural Bug / Not Expected:** Không bắt được `.env` tracked by Git! Mặc dù đây là một lỗ hổng Git phổ biến, `git_scanner` CHỈ được code để đọc `.git/config`. `core_secret_scanner` (bắt AWS keys trong `.env`) thì bị DISABLE ở chế độ Git Exposure Scan.

### 4.3 Full Scan
- **Expected:** Bắt ĐƯỢC TOÀN BỘ lỗi cấu hình, secret key, credential git và vulnerability OSV từ `package.json`.
