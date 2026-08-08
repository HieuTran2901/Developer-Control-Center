# Desktop Adaptive UI & Layout Stability

Provides a structured roadmap to implement a fluid, adaptive UI for Developer Control Center across various desktop resolutions without mutating any backend logic or lifecycle behaviors.

## Open Questions

None at this time. The layout constraints are well-understood from the source code audit.

## Proposed Changes

We will approach this in isolated, CSS-focused phases. All business logic, hooks, EventBus, and IPC architectures will remain strictly untouched.

### Phase 1: App Shell & Sidebar
- Enforce an absolute minimum window bound so the app doesn't break on extreme resizing.
- Auto-collapse the sidebar on smaller displays.

#### [MODIFY] `src/shared/components/layouts/MainLayout.tsx`
- Apply `min-w-[1000px] min-h-[600px]` to the root container to declare the minimum supported Desktop size.

#### [MODIFY] `src/shared/components/layouts/Sidebar.tsx`
- Introduce a `useEffect` hook listening to `window.innerWidth`. If width drops below `1366px`, auto-collapse the sidebar by setting `isExpanded` to false. 

---

### Phase 2: Dashboard Grid Fluidity

#### [MODIFY] `src/features/dashboard/pages/Dashboard.tsx`
- Convert the hardcoded top stats grid: `<div className="grid grid-cols-4 gap-4 ...">` to `<div className="grid grid-cols-2 2xl:grid-cols-4 gap-4 ...">`.
- Convert the split bottom layout: `<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">` to `<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">`.
- Wrap the Resource Monitor table rows in a `<div className="overflow-x-auto">` with a `min-w-[600px]` internal wrapper to prevent column crushing.

---

### Phase 3: Workspace Explorer

#### [MODIFY] `src/features/workspace/pages/WorkspacePage.tsx`
- Adjust the left sidebar fixed width `<div className="w-[260px] ...">` to use a clamped width or allow flex-shrinking to prevent right-panel starvation on 1000px screens.

---

### Phase 4: Modals & Dialogs

#### [MODIFY] `src/shared/components/ui/dialog.tsx`
- Modify modal container classes to use `w-[90vw] max-w-lg` / `max-w-4xl` to guarantee they scale down on smaller windows without clipping off-screen.

---

## Verification Plan

### Automated Tests
- Static analysis via `npm run build` and `npm run lint` to ensure CSS/Tailwind correctness.

### Manual Verification
- Resize the desktop window from 1920x1080 down to 1000x700.
- Verify App Shell maintains stability (no horizontal scrollbar on body).
- Verify Sidebar auto-collapses.
- Verify Dashboard cards stack into 2x2 instead of 4x1.
- Verify Tables introduce horizontal scroll instead of crushing column text.
- Verify Start/Stop Runtime Lifecycles remain perfectly functional.
