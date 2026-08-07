export enum ProcessState {
  Idle = 'idle',
  Starting = 'starting',
  Running = 'running',
  Stopping = 'stopping',
  Stopped = 'stopped',
  Restarting = 'restarting',
  Failed = 'failed',
  Exited = 'exited',
  ZombieDetected = 'zombie_detected',
  Unknown = 'unknown'
}
