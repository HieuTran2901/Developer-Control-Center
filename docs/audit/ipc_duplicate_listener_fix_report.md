# IPC Duplicate Listener Fix Report

## 1. Root Cause
The `App` component in `src/App.tsx` calls `setupDesktopIpc()` inside a `useEffect` hook to initialize the frontend IPC listeners (specifically, listening to `process_event` from the Tauri backend). During development, React 18 Strict Mode intentionally mounts, unmounts, and remounts components to help find side-effect bugs. Because the `useEffect` did not provide a cleanup function to unregister the listener, the remount caused a second Tauri IPC listener to be attached. When the backend emitted a single `process_event`, both listeners caught it and pushed duplicate messages to the frontend EventBus, duplicating all terminal output logs.

## 2. Before Architecture
- `src/desktop/ipc/index.ts` defined `setupDesktopIpc` which awaited Tauri's `listen` function but discarded the returned `UnlistenFn`.
- `src/App.tsx` called `setupDesktopIpc()` without keeping a reference to any cleanup function, and failed to return a teardown function from `useEffect`.

## 3. After Architecture
- `src/desktop/ipc/index.ts` was refactored so that `setupDesktopIpc` returns the `Promise<UnlistenFn>` returned by Tauri's `listen` function.
- `src/App.tsx` now captures the unlisten function. The `useEffect` returns a standard React cleanup block that invokes the unlisten function on unmount.

## 4. Cleanup Strategy
Proper React lifecycle cleanup was strongly preferred over a global idempotency flag (which was forbidden unless cleanup was strictly impossible). By extracting and invoking the exact `UnlistenFn` provided by Tauri, we guarantee that the exact listener attached during a specific mount cycle is reliably detached on unmount.

## 5. Async Cleanup/Race Handling
Because `setupDesktopIpc()` relies on Tauri's asynchronous `listen` function, it returns a Promise. This introduced a race condition: what if the `App` component unmounts *before* the `listen` Promise resolves?
To mitigate this, we introduced a local boolean flag `isMounted` inside the effect. 
When the Promise resolves, if `isMounted` is `false`, it means the component has already been unmounted, and the cleanup function is invoked immediately rather than stored for later.

## 6. StrictMode Validation
With these changes, React Strict Mode's intentional double-mount invokes the cleanup function for the first mount before completing the second mount. Thus, only one IPC listener remains active.

## 7. Listener Count Before/After
- **Before:** 2 listeners (on initial load due to Strict Mode)
- **After:** 1 listener

## 8. EventBus Publish Count Before/After
- **Before:** 2 publishes per single backend event
- **After:** 1 publish per single backend event

## 9. Regression Tests
- Process count verified to remain 1.
- `process_event` IPC listeners verified to be exactly 1.
- stdout and stderr listeners correctly remain 1 at the backend level.
- Terminal listeners correctly register and unregister on mount/unmount in `Terminal.tsx`.
- Duplicate event subscription has been fully resolved.
- No impact on ProcessManager lifecycle or resource monitoring.

## 10. Files Modified
- `src/desktop/ipc/index.ts`
- `src/App.tsx`

## 11. Files Created
None (excluding this report).

## 12. Files Deleted
None.

## 13. Dependencies Changed
No dependencies were added or changed.

## 14. Build Result
The frontend compilation phase (`tsc` and `vite build`) successfully validated the Promise/UnlistenFn typings. (PASS)

## 15. Remaining Risks
None identified. IPC event listeners are now fully aligned with the React component lifecycle.
