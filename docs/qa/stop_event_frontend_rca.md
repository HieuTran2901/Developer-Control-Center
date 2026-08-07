# Supplementary Root Cause Analysis: Frontend Event Dropping

**Ngày báo cáo:** 2026-08-07
**Vai trò:** Principal Event-Driven Architect & Senior React State Engineer

Sau khi truy tìm luồng Event từ OS qua Backend đến tận các React Hooks, tôi đã xác định được chính xác vị trí và nguyên nhân gây ra hiện tượng "Terminal không đóng, Frontend vẫn Running dù Process đã chết". 

**Thủ phạm KHÔNG PHẢI là Race Condition ở Frontend, cũng không phải do Registry Sync ngầm. Thủ phạm là một Logic Leak (lỗ hổng logic) cực kỳ cơ bản trong Adapter tầng IPC.**

---

## 1. Audit Pipeline Trạng Thái (State Pipeline Audit)

Dưới đây là câu trả lời chi tiết cho các câu hỏi Audit:

1. **Có lưu state không?**
   - **Có.** State được lưu tại `runtimeRegistry` (dạng class instance) và React State bên trong hook `useWorkspace.ts` (thông qua `useState` update mảng `projects`).
2. **Có mutate state không?**
   - **Có.** File `src/desktop/ipc/index.ts` cập nhật trực tiếp `runtimeRegistry.update()` và sau đó React cập nhật thông qua `EventBus.subscribe`.
3. **Có overwrite state không?**
   - **Không.** Không có logic nào chủ động ghi đè lên Event mới nhất.
4. **Có polling nào ghi đè Event không?**
   - **Không.** Hoàn toàn không có hàm `setInterval` hay Polling nào (Đã dọn dẹp triệt để từ Phase 3).
5. **Có `useEffect` nào sync ngược Registry về React không?**
   - **Không.** `useWorkspace.ts` (dòng 163-166) chỉ `subscribe` thuần túy vào các sự kiện của `EventBus` (Dumb Client).
6. **Có reducer/IPC Listener nào bỏ qua `ProcessStopped` không?**
   - **CÓ! ĐÂY CHÍNH LÀ NGUYÊN NHÂN CỐT LÕI (ROOT CAUSE).**
7. **Có `ProcessOutput` nào vô tình update status = `Running` không?**
   - **Không.** Các event Output chỉ được bắn vào `EventBus` để Terminal append log, hoàn toàn không chạm vào `status`.
8. **Có nhiều Source of Truth cùng tồn tại không?**
   - **Không.** `EventBus` là Source of Truth duy nhất để kích hoạt React render. `runtimeRegistry` chỉ dùng làm Data Store cho các component phi-React (nếu có).

---

## 2. Bằng chứng Lỗ Hổng (The Smoking Gun)

Tại file **`src/desktop/ipc/index.ts`** (Dòng 17 - 41), có một lệnh `switch (type)` làm nhiệm vụ phân phối Event từ Tauri Backend (Rust) vào `EventBus` của Frontend:

```typescript
    switch (type) {
      case 'ProcessStarting':
        // ...
      case 'ProcessStarted':
        // ...
      case 'ProcessExited':
        // ...
      case 'ProcessFailed':
        // ...
      case 'ProcessOutput':
        // ...
      case 'ProcessErrorOutput':
        // ...
    }
```

**Phân tích:** 
Lệnh `switch` này HOÀN TOÀN THIẾU `case 'ProcessStopped':`! 

Khi Backend Rust xử lý Stop Request, giết process bằng `taskkill`, sau đó phát event `json!({ "type": "ProcessStopped" ... })` qua IPC. Frontend nhận được event này thành công, đi vào hàm `listen('process_event')`, chạy lệnh `switch(type)`. Vì không có case nào khớp với `'ProcessStopped'`, **lệnh switch bỏ qua event này (Drop on the floor)**.

Do `EventBus.publish(EventType.ProcessStopped)` không bao giờ được gọi, hook `useWorkspace` không nhận được tín hiệu. Vì thế React không re-render, trạng thái vẫn giữ nguyên là `Running` và cửa sổ Terminal không chịu đóng lại.

---

## 3. Dependency Graph & Tóm tắt

```mermaid
graph TD
    A[User Clicks Stop] --> B[Rust ProcessManager]
    B --> C[taskkill / OS Kill]
    C --> D[tokio child.wait() resolves]
    D --> E[Rust emit ProcessStopped]
    E --> F[Tauri IPC Bridge]
    F --> G[src/desktop/ipc/index.ts]
    
    G -- "switch(type) NO MATCH!" --> H((EVENT DROPPED))
    
    I[EventBus] -.->|Empty| J[useWorkspace.ts]
    J -.->|No Update| K[React UI: Running]
    
    style H fill:#f00,stroke:#333,stroke-width:4px,color:#fff
```

**Kết luận cuối cùng:**
Toàn bộ kiến trúc Job Object và Event-Driven của Rust đã hoạt động hoàn hảo 100%. Lỗi 100% nằm ở sự tắc trách của Adapter IPC Frontend khi "quên" định nghĩa case để forward event `ProcessStopped`.

Tôi đã lập xong báo cáo bổ sung và KHÔNG tiến hành sửa bất kỳ dòng code nào theo yêu cầu. Trang thái hiện tại đang chờ lệnh tiếp theo của bạn để thực hiện sửa chữa hoặc lên Plan.
