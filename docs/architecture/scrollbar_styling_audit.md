# Scrollbar Visual Styling Audit

**Target**: Developer Control Center (DCC)
**Date**: 2026-08-08

## 1. Scroll Containers Identified

| Container | Component | Direction | Current Class | Type |
| :--- | :--- | :--- | :--- | :--- |
| **Main Content** | `MainLayout.tsx` | Vertical | `overflow-y-auto` | Global Page Scroll |
| **Data Tables** | `Dashboard.tsx` | Horizontal | `overflow-x-auto` | Internal Data Scroll |
| **Left Sidebar** | `WorkspacePage.tsx` | Vertical | `overflow-y-auto` | Internal Panel Scroll |
| **Detail Panel** | `WorkspacePage.tsx` | Vertical | `overflow-y-auto` | Internal Panel Scroll |
| **Terminal Logs** | `Terminal.tsx` | Vertical | `overflow-y-auto` | Log Output Scroll |
| **Dialog/Modals** | `dialog.tsx` | Vertical | `overflow-y-auto` | Modal Overflow Scroll |
| **Dropdown/Select** | Radix UI | Vert/Horiz | custom | Popup Scroll |

## 2. Current Styling
- **CSS Rule**: None.
- **Appearance**: Default browser scrollbars. This breaks the dark IDE immersion (especially on Windows where native scrollbars are thick and light/gray by default).

## 3. Styling Strategy: Global vs Scoped
- **Decision**: **GLOBAL SELECTOR** (`*::-webkit-scrollbar`, `scrollbar-width`, `scrollbar-color`).
- **Reasoning**: DCC is a fully-enclosed Desktop Application Shell (`h-screen overflow-hidden`). In this paradigm, consistent visual scrollbars across all panels (Sidebar, Main, Terminal, Tables) is highly desirable to maintain the "IDE/Developer Tool" aesthetic (similar to VS Code or JetBrains).
- **Usability**: By ensuring a minimum width/height of 8px, horizontal table scrolls and terminal logs remain easily draggable. 

## 4. Proposed CSS Implementation (globals.css)

We will leverage the existing theme colors for a harmonious look:
- **Track**: Transparent or matched to the dark background (`transparent` allows the underlying panel color like `#0d1117` or `#161b22` to show through).
- **Thumb**: Muted gray (`hsl(var(--muted-foreground) / 0.3)`), matching the subtle UI tones.
- **Thumb Hover**: Higher opacity for feedback (`hsl(var(--muted-foreground) / 0.6)`).
- **Radius**: `4px` to match the `rounded-md` aesthetic of the app.

## 5. Browser Compatibility Considerations
- **Webkit (Chrome/Edge/Tauri-WebView2)**: Supported perfectly via `::-webkit-scrollbar-*`.
- **Firefox**: Supported via `scrollbar-width: thin` and `scrollbar-color`.

*(Audit Complete. Proceeding to Implementation)*
