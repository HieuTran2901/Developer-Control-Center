import { ProcessState } from './ProcessState';

export interface ProcessInfo {
  pid: number;
  status: ProcessState;
  cpuUsage: number;
  memoryUsage: number;
  startTime: number;
}
