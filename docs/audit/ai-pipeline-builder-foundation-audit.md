# AI Pipeline Builder Foundation - Audit Report

## 1. Existing Architecture & Infrastructure
- **Current CI/CD UI:** Nằm tại `src/features/cicd/`. Đã bao gồm các component hiển thị overview cơ bản (`CICDOverview.tsx`, `PipelineHealth.tsx`, `PipelineStages.tsx`, `RecentPipelineRuns.tsx`).
- **AI Infrastructure:** Thông qua việc kiểm tra toàn bộ repository, hiện **chưa có bất kỳ kiến trúc AI/LLM, Prompt Service hay API Gateway nào** được tích hợp. Chưa có command AI nào được khai báo ở backend Rust.
- **EventBus:** Có sẵn tại `src/application/events/EventBus.ts`, hỗ trợ tốt cho việc publish/subscribe các event bất đồng bộ nếu cần giao tiếp.
- **Shared Components:** Các shared UI (Button, Card, Dialog, Icon, Select, Tabs) đã tồn tại và sẵn sàng được tái sử dụng để giữ nguyên visual guidelines.
- **Mức độ phụ thuộc UI/Backend:** Các thành phần CI/CD hiện tại đang sử dụng mock data tĩnh, không gắn chặt với logic backend, nên hoàn toàn thuận lợi để mở rộng thêm builder UI.

## 2. Reusable Components
- **Layout & Container:** `PageContainer`, `Tabs`, `Card`
- **Tương tác:** `Button`, `DropdownMenu`, `Dialog` (hoặc custom modal/panel).
- **Icons:** Sử dụng trực tiếp từ bộ `lucide-react` thông qua wrapper `Icon.tsx`. Cần tuyệt đối tuân thủ explicit sizing (`size={...}` hoặc `w-4 h-4`).
- **Typography/Status:** Sử dụng CSS utility classes chung của toàn dự án (text-muted-foreground, text-success, v.v.).

## 3. Proposed Architecture (Kiến trúc đề xuất)
Do dự án chưa có AI infrastructure, kiến trúc thiết kế sẽ đi theo hướng **Abstraction-first**, đảm bảo chia tách rõ ràng giữa Domain, Service và UI.

### 3.1. Domain Model
Sẽ được định nghĩa rõ ràng tại `src/features/cicd/domain/PipelineModel.ts` hoàn toàn không phụ thuộc vào nền tảng (GitHub/Jenkins/Docker):
- `PipelineDefinition` (Chứa thông tin tổng quan, Trigger, các Stage).
- `PipelineStage` (Từng giai đoạn tuần tự/song song).
- `PipelineStep` (Hành động cụ thể bên trong Stage).
- Các interfaces định nghĩa cho `ValidationResult` và `AIExplanation`.

### 3.2. Services (Abstraction Layer)
- `IAIPipelineBuilder`: Interface quy định input (user intent, tech stack) và output (PipelineDefinition, Explanation, Suggestions).
- `MockAIPipelineBuilder`: Implement `IAIPipelineBuilder`, trả về các pipeline giả lập deterministic (Spring Boot, React, Fullstack) để UI có thể hoạt động hoàn thiện trước khi gọi LLM thực tế.
- `PipelineValidator`: Thực hiện các kiểm tra logic nội bộ (circular dependencies, empty commands, invalid env) trả về cấu trúc lỗi hoặc cảnh báo.

### 3.3. UI Components (Presentation Layer)
Các UI components sẽ hoàn toàn stateless hoặc chỉ nắm giữ state của riêng view. Mọi sự thay đổi pipeline thông qua AI sẽ gọi xuống Service.
- **Entry point:** Bổ sung nút [ ✨ Build with AI ] vào `CICDOverview.tsx`.
- **Builder UI:** Chứa prompt input, suggestion list, preview generated pipeline.
- **Visual Editor:** Trực quan hóa pipeline sau khi được tạo để user chỉnh sửa (Add/Remove Stage).

## 4. File Changes (Dự kiến)
**Thư mục làm việc chính:** `src/features/cicd/`

**Tạo mới:**
- `domain/PipelineModel.ts`
- `services/MockAIPipelineBuilder.ts`
- `services/PipelineValidator.ts`
- `components/AIPipelineBuilder/AIPipelineBuilderModal.tsx` (hoặc Panel)
- `components/AIPipelineBuilder/PipelinePromptInput.tsx`
- `components/AIPipelineBuilder/PipelineExplanation.tsx`
- `components/pipeline/PipelineVisualEditor.tsx`
- `components/pipeline/PipelineStageNode.tsx`
- `data/mockAIPipelineResponses.ts` (chứa mock trả về của AI)

**Sửa đổi:**
- `src/features/cicd/pages/CICDOverview.tsx` (thêm entry point cho AI Builder).

## 5. Những nguyên tắc KHÔNG được phép thay đổi
- TUYỆT ĐỐI KHÔNG sửa Header, Sidebar, Dashboard, Security, MainLayout, Terminal.
- TUYỆT ĐỐI KHÔNG can thiệp backend Rust (`src-tauri/`) hoặc tạo Tauri Command mới ở phase này.
- KHÔNG thêm thư viện chart, execution engine hoặc call API bên thứ ba.
- KHÔNG phá vỡ quy tắc kích thước Icon (sẽ luôn sử dụng kích thước trực tiếp, không dùng global overriding CSS).

## 6. Implementation Order (Thứ tự thực hiện bắt buộc)
1. **PHASE 1B & 1C:** Định nghĩa Domain Model (Pipeline, Stage, Step) & Validation Rules.
2. **PHASE 1D:** Triển khai `MockAIPipelineBuilder` và mock data tĩnh.
3. **PHASE 1E:** Xây dựng phần UI cho việc nhập liệu câu hỏi (Natural Language Input) và xử lý luồng AI Builder.
4. **PHASE 1F:** Xây dựng Visual Pipeline Editor để render và edit cấu trúc vừa sinh ra.
5. **PHASE 1G & 1H:** Tích hợp Validation, Explanation, Suggestions và thực hiện Responsive Audit.
6. **PHASE 1I:** Final verification và Build test.

## 7. Dependency & Risks
- **Dependency:** Chỉ sử dụng các UI components hiện có và `lucide-react`. Không phụ thuộc thêm package mới.
- **Risk:** Nếu không quản lý tốt state giữa "Generated Pipeline" và "Edited Pipeline", sẽ gây khó khăn khi user ấn "Regenerate". Cần phân định rõ luồng data cập nhật một chiều từ AI Service -> Visual Editor.

---
**STATUS:** AUDIT COMPLETE. Đã sẵn sàng bước vào thiết kế Architecture & Domain Model. Cần có sự phê duyệt (APPROVE) trước khi triển khai tiếp.
