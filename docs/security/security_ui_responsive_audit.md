# Security Center UI Responsive Audit

## A. Layout Hierarchy & Scroll Architecture
**Current State**: 
- `MainLayout.tsx` already has `<main className="flex-1 overflow-y-auto">`.
- `SecurityOverview.tsx` uses `h-full flex flex-col overflow-y-auto`.
- `Active Findings` block uses `flex-1 min-h-[300px]` with inner `overflow-y-auto`.
**Issue**: This creates 3 levels of nested vertical scrollbars. It violates the constraint of using the global `<main>` scroll architecture and creates a rigid layout that breaks when findings are large.
**Fix**: Remove `h-full`, `flex-col`, and `overflow-y-auto` from `SecurityOverview`. Remove `flex-1`, `min-h-[300px]`, and `overflow-y-auto` from the Findings list container. Let the DOM flow naturally and rely on the global page scroll.

## B. Flex/Grid Behavior & Width Constraints
**Current State**: 
- Header block uses `flex items-start justify-between`. On narrow windows, a long project name or the button can overlap or break.
- Status/Findings metric cards use `grid grid-cols-2`. On very small widths, this might squeeze the numbers too much.
**Issue**: Lacks responsive wrapping for narrow desktop windows.
**Fix**: Use `flex-col sm:flex-row` for headers. Use `grid-cols-1 sm:grid-cols-2` for metrics.

## C. Scan Target Component
**Current State**: 
```tsx
<div className="flex items-center gap-4">
  <Folder />
  <div className="flex flex-col overflow-hidden">...</div>
</div>
```
With the "Change" button placed on a new line below it.
**Issue**: Does not match the requested desktop vs mobile design. Takes too much vertical space unnecessarily.
**Fix**: Refactor to `flex-col sm:flex-row` to allow side-by-side layout on desktop and stacked layout on narrow windows.

## D. Empty State
**Current State**: 
Uses `py-12` and just a basic shield icon with text.
**Issue**: Missing the "Run a security scan to analyze this project's dependencies, secrets and configuration" description and the CTA button. The `min-h-[300px]` makes it look like a giant empty hole.
**Fix**: Remove `min-h-[300px]`, add the proper copy and a "Run Scan" CTA directly in the empty state.

## E. Long Content Safety
**Current State**: 
- Titles and descriptions lack `break-words`.
- Evidence blocks and paths might cause horizontal scroll if not truncated or word-broken.
**Fix**: Add `min-w-0`, `break-words`, and `break-all` for file paths/evidence where appropriate to ensure they never push their parent container's width out of bounds.

## F. Accessibility & Visual Design
**Current State**: 
Status is just text (`Ready to scan`).
**Fix**: Add semantic status indicators (colored dots: green for IDLE/COMPLETED, yellow for SCANNING, red for ERROR) to improve scanning without reading. Use DCC's dark aesthetic properly by leveraging `bg-surface` and `text-muted-foreground`.
