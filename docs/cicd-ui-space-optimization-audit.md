# CI/CD UI Space Optimization Audit

## 1. Viewport & Context
- **Target Resolution:** Màn hình desktop phổ biến (VD: 1366x768, 1280x720).
- **Sidebar Width:** 250px (khi expanded).
- **Header Height:** ~64px.
- **Main Content Width:** Với màn hình 1366px, vùng nội dung khả dụng chỉ khoảng ~1116px (trừ padding hai bên).

## 2. Root Cause Analysis

### 2.1. `RecentPipelineRuns.tsx` - Text Truncation quá sớm & Bị hẹp
- **Vấn đề:** Tên Pipeline và nhánh bị cắt ngắn thành `...` dù màn hình chưa quá hẹp.
- **Root Cause:** Khai báo grid tĩnh: `grid-cols-[2fr_100px_120px_140px_100px_100px_80px]`. Tổng width cố định là 640px. Cộng với padding/gap, cột `2fr` (Pipeline name) còn lại không gian rất nhỏ (đôi khi chỉ vài chục px), ép nội dung phải truncate.
- **Minimal Fix:** Sử dụng `minmax(0, 1fr)` thay thế cho width cố định.
  - Ví dụ: `grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_60px]`.
- **Files Expected:** `src/features/cicd/components/RecentPipelineRuns.tsx`

### 2.2. Vertical Space (Khoảng trắng dư thừa & Cards quá cao)
- **Vấn đề:** Layout đẩy các phần tử bên dưới (như Pipeline Stages) ra khỏi viewport mà không có lý do chính đáng.
- **Root Cause 1 (`CICDOverview.tsx`):** Container chính chứa `pt-6 px-8 pb-8` và TabsList có `mb-6`. Thuộc tính `min-h-[400px]` ở grid row ép thẻ phải cao tối thiểu 400px.
- **Root Cause 2 (`PipelineHealth.tsx`):** Donut chart được fix cứng `w-36 h-36` (144px x 144px), margin/padding lớn (`p-6`, `gap-8`), các legend item có `gap-3` khiến toàn bộ khối này rất cao, đẩy `RecentDeployments` chìm sâu xuống dưới.
- **Root Cause 3 (Row padding):** `py-3` ở các dòng trong bảng `RecentPipelineRuns` và `RecentDeployments` chiếm nhiều diện tích dọc.
- **Minimal Fix:**
  - Giảm padding ở container: `pt-4 px-6 pb-4`.
  - Bỏ `min-h-[400px]`, thay bằng `min-h-0`.
  - Giảm kích thước Donut chart xuống `w-24 h-24` (96px). Giảm padding thẻ `PipelineHealth` xuống `p-4`, legend `gap-1.5`.
  - Giảm padding hàng của bảng xuống `py-2`.
- **Files Expected:**
  - `src/features/cicd/pages/CICDOverview.tsx`
  - `src/features/cicd/components/PipelineHealth.tsx`
  - `src/features/cicd/components/RecentPipelineRuns.tsx`
  - `src/features/cicd/components/RecentDeployments.tsx`

### 2.3. Horizontal Overflow ở `PipelineStages.tsx`
- **Vấn đề:** Các stages dễ dính horizontal overflow và bị đẩy ra khỏi màn hình do width quá lớn.
- **Root Cause:** Stage card bị hardcode cứng `w-40` (160px). 7 stage cards = 1120px + gap/connector width = ~1200px. Nếu Viewport là 1366px trừ Sidebar 250px thì chỉ còn 1116px -> Gây overflow tức thì.
- **Minimal Fix:**
  - Giảm width xuống `w-32` (128px) hoặc dùng `min-w-[120px] flex-1`.
  - Giảm padding của Stage Card xuống `p-2.5`.
  - Giữ nguyên cơ chế `overflow-x-auto` để tránh vỡ layout nếu width thấp hơn 1280px.
- **Files Expected:** `src/features/cicd/components/PipelineStages.tsx`

### 2.4. Grid Overflow & Alignment ở `RecentDeployments.tsx`
- **Vấn đề:** Bố cục cột tĩnh và không scale.
- **Root Cause:** `grid-cols-[1.5fr_100px_1fr_120px_40px]`.
- **Minimal Fix:** Đổi thành `grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_40px]`.
- **Files Expected:** `src/features/cicd/components/RecentDeployments.tsx`

## 3. Tổng kết Kế Hoạch (Implementation Strategy)
- Không đụng đến các Global Components, Global CSS hay Tailwind config.
- Tất cả Icon sẽ được giữ kích thước cụ thể trực tiếp trên element (VD: `size={14}`, `w-3.5 h-3.5`), loại trừ rủi ro icon override.
- Giảm thiểu padding/margin (`p-6` -> `p-4`, `py-3` -> `py-2`) để ưu tiên hiển thị nội dung trên các viewport bị giới hạn chiều cao (720px/768px).
- Sửa lại toàn bộ grid column width để dựa trên tỉ lệ (minmax / fr) thay vì pixel tĩnh (px).
