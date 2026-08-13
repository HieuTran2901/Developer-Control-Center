# Root Cause Analysis: Radix UI Tabs Layout Displacement

**Date**: 2026-08-13
**Component**: `TabsContent` (Radix UI / Shadcn UI)
**Impact**: CI/CD Pipeline History UI was vertically displaced by a large, unexplained gap.

## Problem Statement

In the CI/CD Overview workspace, selecting the "History & Audit" tab caused the internal content (`PipelineHistory`) to render much lower on the screen than expected, creating a large, empty vertical gap immediately beneath the tab navigation divider.

Repeated attempts to fix this by modifying margin/padding on the flex containers (e.g., removing `pt-X`, `mb-X`, `space-y-X`) failed to resolve the core displacement.

## Root Cause

The displacement was caused by a CSS specificity conflict between HTML attributes and Tailwind utility classes affecting **inactive** tabs.

1. **Radix UI Behavior**: When a `TabsContent` element is inactive, Radix UI automatically applies the HTML `hidden` attribute to remove it from the visual layout (`<div hidden>...</div>`). The `hidden` attribute relies on the browser's default stylesheet (`[hidden] { display: none; }`).
2. **Tailwind Conflict**: In order to make the tab content stretch vertically, the class `flex` (along with `flex-col flex-1`) was applied to the `TabsContent` container.
3. **Specificity Win**: In CSS, a class selector (`.flex { display: flex; }`) has higher specificity than an attribute selector (`[hidden]`). 

**Result**: Even though Radix UI correctly marked inactive tabs (like `overview` and `pipelines`) as `hidden`, Tailwind's `.flex` class forced them to be rendered as flex containers. These inactive tabs remained in the DOM, invisible but occupying flex space, which physically pushed the active "History" tab content downwards by the exact height of the inactive tabs.

## Solution

The fix requires ensuring that `display: none` has sufficient specificity to override any layout classes when the tab is inactive.

### 1. Global Safety Net (`src/shared/components/ui/tabs.tsx`)
Added `data-[state=inactive]:hidden` to the base `TabsContent` component:
```tsx
const TabsContent = React.forwardRef<...>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=inactive]:hidden",
      className
    )}
    {...props}
  />
))
```
This guarantees that Tailwind injects a `display: none` class when the state is inactive, neutralizing any flex/grid utilities passed down by consumers.

### 2. Semantic Cleanliness (`src/features/cicd/pages/CICDOverview.tsx`)
Replaced `flex` with `data-[state=active]:flex` on the consumer level to strictly limit when the flex container is instantiated:
```tsx
<TabsContent value="history" className="!mt-0 outline-none flex-1 data-[state=active]:flex flex-col min-h-0 overflow-hidden">
  <PipelineHistory />
</TabsContent>
```

## Lessons Learned for AI Agents

1. **Don't blindly guess margins**: When a layout is significantly displaced and standard padding/margin adjustments yield no result, stop tweaking spacing utilities.
2. **Inspect HTML Attributes vs. CSS**: Be highly vigilant when mixing state-based library attributes (like Radix UI's `hidden` or `data-state`) with generic display utility classes (like `flex` or `grid`). Tailwind classes will almost always override native HTML attributes.
3. **Use State Modifiers**: Always prefer Tailwind state modifiers (`data-[state=active]:flex`) when styling components whose visibility or layout flow is controlled by headless UI libraries.
