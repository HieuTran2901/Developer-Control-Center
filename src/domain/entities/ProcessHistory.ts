export interface ProcessHistory {
  pid: number;
  cpu: number[];
  memory: number[];
  timestamps: number[];
  peakCpu: number;
  peakMemory: number;
  avgCpu: number;
  avgMemory: number;
}
