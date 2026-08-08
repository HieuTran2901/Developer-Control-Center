# Scroll Architecture Phase 1 + Phase 2 Report

**Target**: Developer Control Center (DCC)
**Date**: 2026-08-08

## 1. Files Changed
1. `src/shared/components/layouts/MainLayout.tsx`
2. `src/features/dashboard/pages/Dashboard.tsx`

## 2. Exact Changes
- **MainLayout.tsx**: Changed `<main>` tag's CSS class from `flex-1 overflow-auto` to `flex-1 overflow-y-auto overflow-x-hidden`.
- **Dashboard.tsx**: Removed the redundant `flex-1 overflow-y-auto` from the internal table row wrapper inside the Resource Monitor, replacing it with a simple `w-full pb-2` block.

## 3. Scroll Tree BEFORE
- `Main Content (<main>)`: `overflow-auto` (Vulnerable to accidental global horizontal scroll)
  - `Dashboard`: Unbounded height (Document-flow)
    - `Resource Monitor Table`: `overflow-y-auto` (Dead code, creating ambiguous browser-dependent layout resolution).

## 4. Scroll Tree AFTER
- `Main Content (<main>)`: `overflow-y-auto overflow-x-hidden` (Strictly vertical scrolling).
  - `Dashboard`: Unbounded height (Document-flow)
    - `Resource Monitor Table`: Native block expansion, properly delegating vertical scroll to the page level (`<main>`). Horizontal scroll (`overflow-x-auto`) remains intact on the table wrapper.

## 5. Architecture Reasoning
By establishing `<main>` as the sole vertical scroll container of the document flow and stripping internal table vertical scrolls, we prevent contradictory layout behaviors where a flex container could theoretically grow forever while still holding a dead `overflow-y-auto` property. Replacing `overflow-auto` with `overflow-y-auto overflow-x-hidden` on the AppShell prevents horizontal overflows (e.g. from long code lines breaking boundaries) from dragging the entire IDE off-screen.

## 6. Build Result
- **Result**: PASS.

## 7. Regression Checklist
- [x] Dashboard vertical scrollbar lies at `<main>`.
- [x] No nested vertical scrollbar in Dashboard tables.
- [x] Table retains horizontal scrolling (`overflow-x-auto` wrapper remains).
- [x] No content clipping issues.
- [x] No horizontal scrollbar at `<main>`.
- [x] Workspace sidebar/detail panel still scroll independently (unchanged).
- [x] Terminal still scrolls independently (unchanged).
- [x] Responsive layout bounds preserved.

## 8. Known Limitations
None.

## 9. What Was NOT Changed
- Backend/Rust
- Runtime Lifecycle
- Process Manager
- EventBus / IPC
- WorkspacePage
- Terminal
- Resource Monitor Business Logic

## 10. Recommendation for Phase 3
Phase 3 should focus purely on the visual aesthetics of the scrollbars (e.g. applying a WebKit scrollbar matching `bg-[#161b22]`). Now that the DOM tree handles scroll events with architectural rigor, custom styling can be safely applied across the global `*::-webkit-scrollbar` pseudo-elements.
