# Capability Test & Status

## Current Status
System is capable of communicating fully between React and Rust, and Rust is capable of spawning and killing OS processes using `tokio::process`.

## Working Features
- Dashboard Layout
- Project listing (mock data)
- IPC Error handling
- Rust Tokio Spawning & Killing (`start_process_cmd`, `stop_process_cmd`)
- Rust to React Event broadcasting (ProcessStarting, ProcessStarted, ProcessExited)

## Broken Features
- None currently known.

## Mock Features
- Workspace parsing (Partially migrated to Real Node App project test)
 (Projects data is still mocked in `useProjects.ts`).
- CPU/RAM Monitoring

## Known Limitations
- Cargo PATH issue on some local powershell sessions prevents `npm run tauri dev` from starting properly without manual PATH configuration.
- Log streaming (stdout/stderr) is not yet implemented.

## Performance Notes
- IPC calls are lightweight.
- UI uses 200ms transitions and 8px grid.

