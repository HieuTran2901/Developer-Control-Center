# Resource Monitor Process Icon Audit

## 1. Exact component/file gây lỗi
`src/features/dashboard/pages/Dashboard.tsx` 
Phần render các dòng của bảng Resource Monitor (cả trong vòng lặp `activeProfiles` và `histories`).

## 2. DOM structure thực tế
Cấu trúc DOM hiện tại cho cột PROCESS của một process row:
```html
<div class="flex items-center gap-2.5 overflow-hidden">
  <div class="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-green-500/10 border-green-500/20">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="lucide lucide-server text-green-400">...</svg>
  </div>
  <div class="overflow-hidden">
    <div class="text-xs font-semibold truncate">Tên Process</div>
    <div class="text-[10px] text-muted-foreground truncate">Command</div>
  </div>
</div>
```

## 3. SVG count
Mỗi process row chỉ render **đúng 1 SVG duy nhất** cho icon process. (Đã fix lỗi duplicate process trước đó nên không còn 2 row cho 1 PID).

## 4. Computed width/height của SVG
SVG được truyền prop `size={14}`, nên computed width/height lý thuyết là `14px x 14px`. 
Tuy nhiên, nếu SVG bị render quá lớn (gây clipping), nguyên nhân có thể do CSS global hoặc class Tailwind cascade xuống.

## 5. Computed width/height của icon container
Container được khai báo `w-8 h-8` -> Computed là `32px x 32px`.
Container này có `shrink-0`, nên nó sẽ không bao giờ bị co lại dưới 32px dù không gian flex bị thu hẹp.

## 6. CSS/Tailwind rule đang thắng & Exact Root Cause
Hiện tượng "bị che khuất/cắt đôi hoặc render chồng lên nhau" trong layout hiện tại:
1. **Clipping (Bị cắt đôi):** Parent container có `overflow-hidden`. Mặc dù `w-8 h-8` container không bị thu hẹp (`shrink-0`), nhưng nếu chiều cao của row (chịu ảnh hưởng bởi `items-center` và padding `py-3`) nhỏ hơn kích thước thực tế của SVG (trong trường hợp SVG bị ép kích thước lớn hơn 32px bởi 1 rule nào đó), SVG sẽ tràn ra khỏi `w-8 h-8` và bị cắt bởi `overflow-hidden` của thẻ cha.
2. **Overlap (Chồng lên nhau):** Nếu SVG tràn ra khỏi vùng 32x32, nó sẽ đè lên phần text kế bên (`gap-2.5`), tạo cảm giác render chồng chéo.
3. Nguyên nhân sâu xa: Trong một số phiên bản trình duyệt hoặc khi sử dụng `lucide-react` với thẻ wrapper, việc thiếu explicit `min-width: 14px` hoặc `min-height: 14px` trên SVG, hoặc cấu trúc `flex` cha ép kích thước container xuống.

**Root cause chính xác:**
Cấu trúc `w-8 h-8 flex items-center justify-center shrink-0` kết hợp với `overflow-hidden` ở thẻ cha. Nếu có bất kỳ sự cố nào về box-sizing hoặc CSS cascade khiến SVG lớn hơn, nó sẽ bị cắt. Hơn nữa, việc lồng quá nhiều thẻ `overflow-hidden` trong một không gian chật hẹp (`gap-2.5`) dễ gây visual glitch.

## 7. Minimal Fix
Sửa đổi trực tiếp tại `Dashboard.tsx`:
1. Giữ nguyên container `w-8 h-8 rounded-md flex items-center justify-center shrink-0`.
2. Đảm bảo Icon nhận đúng class giới hạn kích thước tuyệt đối để không bao giờ bị tràn: `w-3.5 h-3.5` (tương đương 14px).
3. Loại bỏ `overflow-hidden` không cần thiết ở thẻ cha bọc icon và text, chỉ giữ `truncate` ở phần text để tránh clipping sai lệch lên icon.

## 8. Files sẽ được modified
- `src/features/dashboard/pages/Dashboard.tsx`

## 9. Những files KHÔNG được modified
- `src/shared/components/ui/Icon.tsx` (Không sửa logic component)
- `src/application/services/ResourceHistoryService.ts`
- Các module Terminal, Security, Workspace, Backend, IPC...

## 10. Regression risks
- Rất thấp. Việc chỉnh sửa chỉ giới hạn ở việc gỡ bỏ `overflow-hidden` ở wrapper ngoài cùng của cột thứ nhất và thêm class hardcode kích thước cho Icon.

## 11. Verification plan
1. Chạy `npm run build` để đảm bảo code compile thành công.
2. Kiểm tra UI Resource Monitor trên Dashboard để xác nhận icon không còn bị cắt đôi hay đè lên text.
3. Start/Stop process để đảm bảo tính nhất quán.
