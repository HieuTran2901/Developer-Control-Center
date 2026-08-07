# Desktop API (IPC)

## Tauri Commands
Commands are invoked from Frontend via `@tauri-apps/api/core` `invoke`.

### `start_process_cmd`
**Request:**
```typescript
{
  projectId: string;
  serviceId: string;
  command: string;
  cwd: string;
}
```
**Response:** `Result<(), DesktopError>`

### `stop_process_cmd`
**Request:**
```typescript
{
  projectId: string;
  serviceId: string;
}
```
**Response:** `Result<(), DesktopError>`

## Desktop Errors
```typescript
interface DesktopError {
  kind: string; // e.g. "ExecutionFailed", "NotFound"
  message: string;
}
```

## Tauri Events
Emitted from Rust to Frontend, listened via `process_event`.

**Payload Wrapper:**
```typescript
{
  type: string; // ProcessStarting, ProcessStarted, ProcessExited, ProcessFailed, ProcessOutput, ProcessErrorOutput
  payload: any; // includes 'pid' for ProcessStarted
}
```


### Log Payload (ProcessOutput / ProcessErrorOutput)
```typescript
{
  projectId: string;
  serviceId: string;
  timestamp: number;
  streamType: 'stdout' | 'stderr';
  message: string;
}
```
