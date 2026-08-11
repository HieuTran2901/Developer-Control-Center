# CI/CD UI Foundation Audit

## 1. MỤC ĐÍCH & PHẠM VI (SCOPE)
- **Mục tiêu:** Xây dựng phần UI hoàn chỉnh cho CI/CD theo thiết kế tham khảo.
- **Phạm vi (Scope):** Chỉ tạo giao diện Frontend tĩnh với Mock Data, chuẩn bị sẵn sàng để tích hợp Backend CI/CD trong phase kế tiếp.
- **Quy tắc tuyệt đối:** KHÔNG chỉnh sửa Header, KHÔNG đụng chạm đến logic Backend hiện tại, KHÔNG làm ảnh hưởng đến các Dashboard/Security features đang có.

## 2. KIẾN TRÚC HIỆN TẠI VÀ FILES SẼ ĐƯỢC CHỈNH SỬA
### 2.1. Routing & Layout (`src/App.tsx`)
- App đang dùng `react-router-dom`.
- Sẽ bổ sung route mới: `<Route path="cicd" element={<CICDOverview />} />` ngay dưới route `security`.
- Không thay đổi `MainLayout.tsx`.

### 2.2. Sidebar Navigation (`src/shared/components/layouts/Sidebar.tsx`)
- Sẽ bổ sung một object vào mảng `navItems`:
  ```ts
  { icon: 'Workflow', label: 'CI/CD', path: '/cicd' }
  ```
- Vị trí: Đặt bên dưới 'Security' và bên trên 'Settings'.
- Không thay đổi logic expand/collapse của Sidebar.

## 3. CÁC FILES/THƯ MỤC SẼ ĐƯỢC TẠO MỚI
Sẽ tạo module feature riêng tại `src/features/cicd/`:

```
src/features/cicd/
├── pages/
│   └── CICDOverview.tsx            (Page Component kết nối Layout & các phần tử)
├── components/
│   ├── CICDHeader.tsx              (Chứa Project Selector, Branch Selector, Title)
│   ├── CICDMetricCards.tsx         (5 Metric Cards: Total Pipelines, Success, Failed, Duration, Deployments)
│   ├── RecentPipelineRuns.tsx      (Table/Grid hiển thị danh sách run gần đây)
│   ├── PipelineHealth.tsx          (SVG Donut Chart tự custom gọn nhẹ hiển thị tỷ lệ)
│   ├── RecentDeployments.tsx       (Danh sách các bản Deploy)
│   └── PipelineStages.tsx          (Minh họa flow các stages của pipeline run)
└── data/
    └── mockCICDData.ts             (Dữ liệu giả lập tách biệt khỏi UI)
```

## 4. UI COMPONENTS SẼ ĐƯỢC TÁI SỬ DỤNG (REUSE)
- `PageContainer`: Container chính của page để đồng bộ padding/margin.
- `Card`, `CardHeader`, `CardTitle`, `CardContent`: Dùng cho các khối giao diện (Metrics, Runs, Health, Deployments).
- `Badge`: Hiển thị Status (Success/Failed).
- `Icon`: Hệ thống Icon an toàn, tuân thủ chặt chẽ rule không dùng global resize.
- `Button`: Cho các action cơ bản (Run Again, More).
- `Tabs`, `TabsList`, `TabsTrigger`: Cho thanh Tab Navigation (Overview, Pipelines, Runs...).
- `DropdownMenu` / `Select`: Cho Project và Branch selectors.

## 5. XỬ LÝ CHART & BẢNG (TABLE)
- **Table/List:** Sẽ sử dụng kiến trúc CSS Grid (tương tự như Resource Monitor trong Dashboard) thay vì dùng thẻ `<table>` truyền thống để dễ control layout trên các thiết bị nhỏ.
- **Chart:** Hệ thống chưa cài đặt thư viện Chart lớn (như Recharts/Chartjs). Để tiết kiệm dung lượng và tránh import thừa, phần Pipeline Health Donut Chart sẽ được vẽ trực tiếp bằng một component `<svg>` đơn giản, truyền fill percentage vào `stroke-dasharray`.

## 6. QUY TẮC AN TOÀN ICON (ICON SAFETY)
- Việc tuân thủ `size={...}` sẽ được kiểm soát chặt chẽ.
- Tất cả các icon trong CICD sẽ được set kích thước cụ thể bằng prop (vd: `size={16}`) hoặc các class inline tường minh (`w-4 h-4 shrink-0`), **tuyệt đối không** dùng các bộ chọn như `[&_svg]:size-*` để tránh lặp lại bug regression clipping trước đó.

## 7. RESPONSIVE STRATEGY
- **Màn hình lớn (1920x1080 / 1600x900):** Layout đầy đủ, PipelineHealth và RecentDeployments nằm song song. Các stage của pipeline hiển thị trên 1 hàng (horizontal).
- **Màn hình vừa (1366x768 / 1280x720):** Các Metric Cards chuyển thành Grid 3-2. Các table/grid rows giữ nguyên nhưng thay đổi padding để tối ưu không gian. Pipeline Stages hỗ trợ cuộn ngang (`overflow-x-auto`).

## 8. NHỮNG PHẦN KHÔNG NẰM TRONG SCOPE
- KHÔNG gọi backend API hay thao tác Redux/Tauri IPC.
- KHÔNG tạo file Rust (`src-tauri/*`).
- KHÔNG thay đổi Header hay bất kỳ CSS global nào.
- KHÔNG refactor lại bất kỳ tính năng nào đang chạy trên hệ thống.

---
**STATUS:** AUDIT COMPLETE. Sẵn sàng nhận lệnh APPROVE để tiến hành Implementation Phase.
