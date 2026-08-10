# Security Center UI Refinement

## What Changed
- Refined the Security Center UI to clearly display the active scan target (project name and absolute path) before running a scan.
- Introduced a dedicated "Scan Target" block with a clear visual hierarchy.
- Improved the empty states for findings ("No vulnerabilities detected") by replacing text-only placeholders with structured, visually pleasing layouts.
- Formatted status strings to be user-friendly (e.g., `IDLE` -> `Ready to scan`).

## Scan Target Selection
- **Default behavior**: The scan target automatically defaults to the active project provided by the `useWorkspace` hook (`currentProject`).
- **Changing target**: Users can select a custom target using the `Change` button. This triggers the native OS folder picker via `@tauri-apps/plugin-dialog` (`open({ directory: true })`).
- If a custom target is selected, its path and name are tracked in local component state (`customTarget`) and used as the scan payload (`activeTarget`).
- The `projectId` sent to the backend defaults to the actual Project ID if using the workspace project, or falls back to `'custom-target'` for custom folders.

## Existing Logic/Components Reused
- **Workspace State**: `useWorkspace()` is fully preserved to automatically populate the default target.
- **Tauri Architecture**: Reused `@tauri-apps/plugin-dialog` to avoid inventing a new backend file picker command.
- **EventBus / SecurityService**: Scan logic, findings chunking, and IPC contracts remain 100% unchanged.

## UI States Implemented
- **IDLE**: "Ready to scan"
- **SCANNING**: "Scanning [Target Name]..." with file progress.
- **COMPLETED**: "Scan completed" with findings count.
- **FAILED**: "Scan failed"
- **CANCELLED**: "Scan cancelled"

## Files Modified
- `src/features/security/pages/SecurityOverview.tsx`
