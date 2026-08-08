# Desktop Adaptive UI & Layout Stability Audit Report

**Date**: 2026-08-08
**Scope**: Complete UI Architecture, Layout Risks, and Responsive Capabilities.
**Status**: AUDIT ONLY - No code changes applied.

## 1. Current UI Architecture

The Developer Control Center is built as a single-page React application within a Tauri container, heavily relying on Tailwind CSS for layout.

### Component Map
```text
App Shell (MainLayout.tsx, App.tsx)
├── Sidebar (Sidebar.tsx)
│   └── Modes: Expanded (250px) / Compact (72px)
├── Header (Header.tsx)
│   └── Includes: Workspace Select, Search, Profile Avatar
├── Main Content (Outlet inside MainLayout)
│   ├── Dashboard (Dashboard.tsx)
│   │   ├── Top Stats (4 cols fixed grid)
│   │   ├── Recent Projects (Table-like Grid)
│   │   └── Resource Monitor (Table-like Grid)
│   ├── Workspace (WorkspacePage.tsx, WorkspaceSidebar.tsx)
│   │   ├── Explorer (260px fixed width)
│   │   └── Detail Panel (flex-1)
│   └── Terminal (Terminal.tsx, TerminalRenderer.ts)
└── Overlays
    ├── Modals (dialog.tsx)
    └── Toasts (useToast.tsx)
```

## 2. Global Overflow & Layout Risk Map

Based on a global DOM scanning (`h-screen`, `w-full`, `overflow-*`, `fixed`, `min-w-`, etc.), the following areas were assessed:

### App Shell & Main Layout
- **Path**: `src/shared/components/layouts/MainLayout.tsx`
- **Current State**: `<div className="flex h-screen w-full bg-background text-foreground overflow-hidden">` with a `<main className="flex-1 overflow-auto">`
- **Risk Level**: **SAFE**. The root layout correctly isolates scrolling to the `<main>` tag, preventing App-level scrollbars. 

### Sidebar
- **Path**: `src/shared/components/layouts/Sidebar.tsx`
- **Current State**: Explicit transition between `w-[250px]` and `w-[72px]`.
- **Risk Level**: **WARNING**. Although a compact mode exists, it is not tied to window dimensions. On a 1280x720 window, a 250px sidebar consumes ~20% of horizontal real estate.

### Dashboard Layout
- **Path**: `src/features/dashboard/pages/Dashboard.tsx`
- **Current State**: 
  - Top stats: `grid-cols-4` hardcoded.
  - Profile Table: `grid-cols-[1fr_90px_140px_100px]`.
  - Process Table: `grid-cols-[2fr_80px_100px_100px_100px_80px_40px]`.
- **Risk Level**: **CRITICAL**. 
  - The process table mandates exactly 500px of fixed width columns plus `2fr`. At 1280px total app width, minus Sidebar (250px), minus Panel Paddings (~64px), minus 50% screen split for the right column, the table only has ~480px available, causing aggressive squeezing or hidden text.
  - The 4-column top stats card grid will shrink cards below their content thresholds on smaller screens.

### Workspace Split Layout
- **Path**: `src/features/workspace/pages/WorkspacePage.tsx`
- **Current State**: `<div className="w-[260px] flex flex-col shrink-0">` paired with `<div className="flex-1">`.
- **Risk Level**: **WARNING**. 260px is a hardcoded pixel limit. If the user resizes the app down, the editor panel gets starved of space.

### Terminal Renderer
- **Path**: `src/features/terminal/utils/TerminalRenderer.ts`
- **Current State**: `break-all whitespace-pre-wrap flex-1`
- **Risk Level**: **SAFE**. The terminal forces text to wrap natively instead of expanding horizontally. It natively avoids `overflow-x-auto` by breaking words.

### Dialogs & Modals
- **Path**: `src/shared/components/ui/dialog.tsx`
- **Current State**: Hardcoded `max-w-lg`, `max-w-4xl`.
- **Risk Level**: **WARNING**. `max-w-4xl` is ~896px. If a user resizes the window to a width of 800px, the modal will hit the viewport edges unless it has internal scrolling and `w-[90vw]`.

---

## 3. Recommended Responsive Strategy

Rather than converting this into a mobile UI, we will apply **Desktop Adaptive Scaling**, preserving the Developer Tool visual hierarchy.

### Breakpoint Strategy
- **`>= 1600px` (Large Desktop)**:
  - Sidebar: Expanded.
  - Dashboard: 4 columns for stats.
- **`1366px - 1599px` (Desktop Standard)**:
  - Sidebar: Expanded.
  - Dashboard: 4 columns, slightly reduced padding.
- **`1024px - 1365px` (Compact Desktop)**:
  - Sidebar: **Auto-Collapsed to Compact Mode (72px)**.
  - Dashboard Stats: Drops to 2 columns (`grid-cols-2`).
  - Dashboard Bottom: Stacks vertically (`grid-cols-1`) OR collapses columns in tables.
- **`< 1024px` (Minimum Viable Desktop)**:
  - We apply a `min-width: 1000px` rule to the `<body>` or root `<div id="root">`. Below 1000px, horizontal scrollbars are permitted globally because maintaining complex IDE layouts below 1000px creates unreadable UI.

### Overflow Strategy
1. **Root Layout**: Strict `overflow-hidden` at the root down to 1000px.
2. **Horizontal Scrolling**: Strictly confined to Data Tables in the Resource Monitor (via a wrapper `overflow-x-auto`) instead of wrapping column data.
3. **Text Truncation**: Enforce `truncate` on all Workspace paths, Profile names, and CLI commands.

---

## 4. Implementation Phase Plan

**Phase 1: App Shell & Sidebar Auto-adapt**
- Scope: Bind `Sidebar.tsx` expansion state to `window.innerWidth`. Define global `min-w-[1000px] min-h-[600px]`.
- Risk: Low.
- Pass Criteria: Resizing below 1366px collapses the sidebar automatically.

**Phase 2: Dashboard Grid Fluidity**
- Scope: Refactor `Dashboard.tsx` from `grid-cols-4` to responsive classes (`grid-cols-2 lg:grid-cols-4`). Implement `overflow-x-auto` on the table wrappers.
- Risk: Medium (CSS only).
- Pass Criteria: Dashboard panels gracefully wrap or scroll their contents rather than squishing.

**Phase 3: Workspace Explorer Flexibility**
- Scope: Convert fixed `w-[260px]` to flex-basis or allow it to be collapsible. 
- Risk: Low.

**Phase 4: Modals & Dialog Boundaries**
- Scope: Update `dialog.tsx` to ensure `w-[95vw] max-w-4xl` so it never overflows the window width on smaller desktop resolutions.

---

## 5. Regression Protection Plan

To ensure the Epic **does not affect Runtime Lifecycle**:
- No state management relating to ProcessManager, EventBus, or Tauri IPC will be modified.
- CSS classes will be appended natively without altering conditional render paths that depend on `ProcessState` (e.g. `ReadinessState.Waiting`).
- `Dashboard.tsx` process execution paths (`toggleService`) remain strictly untouched.
- `Terminal.tsx` scrolling logic (`TerminalRenderer`) will not be modified since it already leverages a safe wrapping strategy.

**Verdict**: We are ready to proceed with Phase 1.
