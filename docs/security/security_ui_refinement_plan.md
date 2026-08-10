# Security Center UI Refinement Plan

## 1. Goal
Implement the responsive UI/UX refinement for the Security Center based on the static audit, without altering the backend, architecture, or any global layout structures. 

## 2. Component Refactoring Strategy

### Phase 3.1: Security Page Layout Hierarchy
- **Action**: Remove `h-full flex flex-col overflow-y-auto` from the root `div` of `SecurityOverview`.
- **Action**: Change root `div` classes to `p-6 space-y-6 max-w-full`.
- **Why**: Let the container grow naturally and allow the global `<main>` scrollbar to handle scrolling. Eliminate nested scrollbars.

### Phase 3.2: Header & Scan Target Compact Redesign
- **Header**: Change `flex justify-between` to `flex flex-col sm:flex-row sm:items-start justify-between gap-4`. This ensures the CTA wraps safely on small screens.
- **Scan Target Block**: 
  - Change to a compact row design on desktop: `flex flex-col sm:flex-row sm:items-center justify-between gap-4`.
  - Content left side: Folder Icon + Truncated Name & Path. Use `min-w-0` to allow truncation.
  - Right side: `[ Change ]` button aligned properly.

### Phase 3.3: Responsive Status / Findings Metrics
- **Action**: Update the metric cards grid from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`.
- **Action**: Add semantic status indicators (colored dots next to status strings) for better scannability.

### Phase 3.4: Active Findings + Empty State
- **Action**: Remove `flex-1 min-h-[300px] overflow-y-auto` from the findings container.
- **Empty State UI**:
  - Center alignment with appropriate padding (`py-16`).
  - Add shield check icon.
  - Add text: "No security issues detected" & "Run a security scan to analyze this project's dependencies, secrets and configuration."
  - Add the "Run Security Scan" CTA button directly in the empty state (hidden if already scanning).

### Phase 3.5: Finding Responsive Cards
- **Action**: Ensure finding titles have `break-words`.
- **Action**: Badges (severity/category) should use `flex-shrink-0` to avoid being squished by long titles.
- **Action**: File paths in evidence blocks must use `break-all` to prevent horizontal overflow.

## 3. Validation Plan
- Resize window to ~768px and verify layout reflows gracefully.
- Resize window to large desktop and verify cards don't stretch artificially.
- Ensure no horizontal scrollbar exists on the page.
- Run `cargo check` and `npm run build` to ensure no accidental type or backend breakage.

## IMPLEMENTATION GATE: PENDING
Waiting for user authorization to proceed with code modifications in `src/features/security/pages/SecurityOverview.tsx`.
