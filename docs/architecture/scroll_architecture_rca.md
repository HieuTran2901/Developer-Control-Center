# Scroll Architecture Root Cause Analysis (RCA)

**Target**: Developer Control Center (DCC)
**Date**: 2026-08-08
**Status**: AUDIT COMPLETE (Gate: Pending Proceed)

## 1. Executive Summary
The Scroll Architecture of DCC is generally well-structured around an App Shell model. However, several inconsistencies exist between intended scroll boundaries (e.g., table-level internal scrolling) and actual browser flexbox resolutions (e.g., page-level scrolling). Additionally, the main content area is susceptible to accidental horizontal scrolling.

## 2. Current Scroll Tree
```text
App
│
├── AppShell (MainLayout.tsx)
│   ├── overflow-hidden
│   ├── min-w-[1000px], min-h-[600px]
│   │
│   ├── Sidebar (Sidebar.tsx)
│   │   └── overflow-y-auto, overflow-x-hidden [INTENTIONAL]
│   │
│   └── Main Content (<main> in MainLayout.tsx)
│       └── overflow-auto (Controls Page-level scroll)
│           │
│           ├── Dashboard (PageContainer)
│           │   ├── Top Stats (No scroll)
│           │   └── Tables (overflow-x-auto, overflow-y-auto) [AMBIGUOUS]
│           │
│           └── WorkspacePage (PageContainer)
│               └── h-full, overflow-hidden [INTENTIONAL]
│                   ├── WorkspaceSidebar (overflow-y-auto) [INTENTIONAL]
│                   └── Detail Panel (overflow-y-auto) [INTENTIONAL]
```

## 3. Findings

### Finding 1: Ambiguous Scroll Delegation in Dashboard (P2 Medium)
- **File**: `src/features/dashboard/pages/Dashboard.tsx`
- **Lines**: 449, 290
- **Evidence**: Data tables (Resource Monitor and Recent Projects) are wrapped in `<div className="flex-1 overflow-y-auto">`.
- **Root Cause**: The Dashboard is rendered inside `<main className="overflow-auto">`. Because the parent chain does not strictly bound the maximum height (unlike `WorkspacePage` which passes `overflow-hidden h-full`), the flex container will grow to fit its content. The `overflow-y-auto` on the table is effectively dead code in most modern browser engines because the table height resolves to its content height, causing `<main>` to scroll instead.
- **Risk**: Double scrollbars if the parent height is ever accidentally constrained, or inconsistent behavior across Safari/Chrome.

### Finding 2: Accidental Horizontal Scroll Risk in Main Content (P1 High)
- **File**: `src/shared/components/layouts/MainLayout.tsx`
- **Line**: 9
- **Evidence**: `<main className="flex-1 overflow-auto p-8 ...">`
- **Root Cause**: `overflow-auto` allows both horizontal and vertical scrolling. If a pre-formatted string (like a log) or a table escapes its bounds, `<main>` will spawn a horizontal scrollbar.
- **Risk**: Breaks the UI UX where horizontal scrolling should ONLY exist inside specific containers (like tables) or at the absolute root window (when resized below 1000px). 

### Finding 3: Perfect Isolation in WorkspacePage & Terminal (P3 Low/Pass)
- **File**: `WorkspacePage.tsx`, `Terminal.tsx`
- **Evidence**: Both explicitly use `h-full overflow-hidden` on their outermost boundaries, combined with `flex-1 overflow-y-auto` on their inner scrollable regions.
- **Result**: They behave exactly like native desktop applications.

## 4. Recommended Architecture
1. **App Shell**: 
   - Ensure `<main>` uses `overflow-y-auto overflow-x-hidden` to explicitly ban accidental horizontal page scrolls.
2. **Dashboard**: 
   - Strip `overflow-y-auto flex-1` from the internal tables. Let the Dashboard naturally expand and utilize the `<main>` page-level vertical scrollbar.
   - Maintain `overflow-x-auto` on the table wrappers for horizontal data overflow.

## 5. Non-goals & Regression Risks
- We will NOT change `WorkspacePage` or `Terminal` as they are correctly implementing bounded internal scrolling.
- We will NOT change `min-w-[1000px]`, preserving the Desktop Responsive Epic.
