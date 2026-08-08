# Scroll Architecture Implementation Plan

**Target**: Developer Control Center (DCC)
**Date**: 2026-08-08

## Phase 1: Application Shell
**Scope**: Prevent accidental horizontal scroll at the root content level.
- **Files**: `src/shared/components/layouts/MainLayout.tsx`
- **Current Behavior**: `<main>` uses `overflow-auto`.
- **Target Behavior**: `<main>` uses `overflow-y-auto overflow-x-hidden`.
- **Changes**: Modify `className` on line 9 of `MainLayout.tsx`.
- **Risk**: Low.
- **Regression Risk**: None.
- **Validation**: Ensure that widening internal elements doesn't spawn an ugly horizontal scrollbar on the whole window.

## Phase 2: Main Content Scroll Container (Dashboard)
**Scope**: Remove redundant `overflow-y-auto` from Dashboard tables to clarify the scroll tree.
- **Files**: `src/features/dashboard/pages/Dashboard.tsx`
- **Current Behavior**: The tables are wrapped in `<div className="flex-1 overflow-y-auto">`.
- **Target Behavior**: The tables expand naturally to push the page scrollbar.
- **Changes**: Strip `overflow-y-auto` and `flex-1` from the immediate row wrappers of both tables.
- **Risk**: Low.
- **Regression Risk**: None.
- **Validation**: Ensure Dashboard scrolls perfectly as a single page document.

## Phase 3: Scrollbar Styling (Optional/Future)
**Scope**: Implement custom webkit scrollbar styles to fit the Dark Mode IDE aesthetic.
- **Files**: `index.css`
- **Current Behavior**: Default browser scrollbars.
- **Target Behavior**: Thin, subtle, unobtrusive scrollbars matching `bg-[#161b22]`.
- **Changes**: Add `::-webkit-scrollbar` styling rules.
- **Risk**: Low.
- **Regression Risk**: None.

---
**Gate Status**: Pending Proceed.
