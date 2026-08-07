# Architecture

Developer Control Center is built using Clean Architecture principles, ensuring a separation of concerns and maintainability.

## Component Diagram
UI (React Components) -> Hooks (`useProjects`) -> EventBus / Repositories
UI Actions -> `TauriRuntimeService` -> DesktopGateway (IPC) -> Rust `RuntimeService` -> Tokio Process

## Runtime Flow
1. User clicks **Start** on UI.
2. `toggleService` in `Dashboard.tsx` invokes `runtimeService.start()`.
3. `TauriRuntimeService` sets local `ProcessState.Starting` in `RuntimeRegistry` and publishes to `EventBus`.
4. IPC command `start_process_cmd` is sent to Tauri.
5. Rust `RuntimeService` receives command, registers in its `registry`, spawns `tokio::process::Command`.
6. Rust fetches `PID`, registers the child in `Mutex<HashMap>`, and emits `ProcessStarted` event with `pid`.
7. React IPC listener catches `ProcessStarted`, updates `RuntimeRegistry` with `pid` and `ProcessState.Running`, publishes to `EventBus`.
8. UI Reactively updates to show Running status and PID.

## Dependency Layer Interaction
- **Domain:** `ProcessModel`, `ProcessState` (No external dependencies).
- **Application:** `IRuntimeService`, `EventBus`, `RuntimeRegistry` (Depends on Domain).
- **Infrastructure:** `TauriRuntimeService`, IPC Listeners (Depends on Application Interfaces).
- **Presentation:** React Components (Depends on Application and Domain).

## Modules
- **Mock Module:** `MockRuntimeService` allows UI development without triggering Rust logic.
- **Real Runtime Module:** `TauriRuntimeService` interacts directly with OS using Rust Tokio. Toggle via `src/config/runtimeConfig.ts`.

## Event Flow
Rust (`app_handle.emit`) -> TS (`listen('process_event')`) -> `EventBus.publish` -> React Hooks (`EventBus.subscribe`) -> State Change -> Re-render.


