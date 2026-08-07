export interface ProcessMetrics {
  pid: number;
  cpu: number;
  memory: number; // in bytes
  threads: number;
  uptime: number; // in seconds
  startTime: number;
}
