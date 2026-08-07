# Root Cause Analysis: Add Project Dialog Failure

## Actual Root Cause

The Add Project button was wired to React, but the click handler did not open any React dialog state. `WorkspaceSidebar` called `onCreateProject`, and `WorkspacePage` immediately awaited `@tauri-apps/plugin-dialog.open()` before changing application state.

That made project creation depend entirely on a native OS picker side effect. If the native picker did not appear, appeared behind the app, returned `null`, or was cancelled, React had no `open` state to render and no project state to save.

## Why Clicking Appeared To Do Nothing

The UI had no controlled Add Project dialog lifecycle:

- No `isCreateProjectDialogOpen` state existed.
- No `setOpen(true)` ran on click.
- No add-project `Dialog` was mounted.
- No `ProjectEditor` or creation form could render before folder selection.
- No workspace mutation could happen until the native picker returned a string path.

So the button could receive a click and still leave the visible app unchanged.

## Why No Exception Reached The Console

The common no-op paths were not exceptions:

- Cancelling or failing to choose a folder returns `null`.
- The handler explicitly treats a non-string or missing path as cancellation and returns.
- Runtime exceptions inside the handler were caught locally with `console.error`, so they did not bubble to a global error boundary.

The silent path was therefore a valid early return, not a thrown error.

## Exact Execution Path Before Fix

```text
Button
  -> React synthetic click
  -> WorkspaceSidebar.handlePlusClick()
  -> WorkspacePage.handleCreateProject()
  -> await native Tauri folder picker
  -> null / no selected path
  -> early return
  -> no workspace mutation
  -> no EventBus WorkspaceChanged event
  -> no WorkspaceProvider update
  -> no Sidebar or Dashboard render change
```

Execution stopped at the native folder-picker result boundary, before any React dialog state or repository write.

## Fix

`WorkspacePage` now owns a controlled Add Project dialog:

- The sidebar button calls `setIsCreateProjectDialogOpen(true)` synchronously.
- A Radix `Dialog` is mounted from React state.
- Project name and root path are controlled state.
- Folder browsing uses `TauriDesktopGateway.selectFolder()` instead of importing the Tauri plugin directly in the presentation page.
- Save creates a `Project`, writes through `WorkspaceRepository.addProject()`, then lets `WorkspaceChanged` update `WorkspaceProvider`.

## Data Flow Before

```text
WorkspaceSidebar
  -> WorkspacePage
  -> @tauri-apps/plugin-dialog.open()
  -> WorkspaceRepository.addProject()
  -> EventBus.WorkspaceChanged
  -> WorkspaceProvider
  -> Sidebar / Dashboard
```

The presentation page depended directly on infrastructure and had no visible React state before the native picker returned.

## Data Flow After

```text
WorkspaceSidebar
  -> WorkspacePage.setIsCreateProjectDialogOpen(true)
  -> Radix Dialog render
  -> optional TauriDesktopGateway.selectFolder()
  -> WorkspaceRepository.addProject()
  -> EventBus.WorkspaceChanged
  -> WorkspaceProvider
  -> Sidebar / Dashboard
```

The visible dialog lifecycle is now React-owned, while desktop capabilities remain behind the gateway.

## Regression Risk

Risk is low:

- No WorkspaceRepository contract changed.
- No EventBus event names changed.
- No RuntimeProfile, Session, Dashboard, or Tauri IPC process flow changed.
- The change is limited to Add Project presentation orchestration.
- Manual path entry adds resilience without bypassing the repository or faking data.

## Files Modified

- `src/features/workspace/pages/WorkspacePage.tsx`
- `docs/reports/add-project-root-cause.md`

## Clean Architecture Compliance

The fix preserves the existing Clean Architecture boundaries:

- Presentation owns dialog state and form state.
- Desktop folder selection goes through `TauriDesktopGateway`.
- Workspace persistence remains inside `WorkspaceRepository`.
- UI updates still flow through `EventBus.WorkspaceChanged` and `WorkspaceProvider`.
