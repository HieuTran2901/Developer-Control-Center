export type PerformanceTrendDirection = 'increasing' | 'decreasing' | 'stable';

export interface PerformanceTrend {
  cpu: PerformanceTrendDirection;
  memory: PerformanceTrendDirection;
  isMemoryLeakSuspected: boolean;
}

export type WarningSeverity = 'info' | 'warning' | 'critical';
export type WarningType = 'cpu_spike' | 'memory_spike' | 'sustained_high_cpu' | 'memory_leak' | 'frequent_restarts';

export interface PerformanceWarning {
  id: string;
  type: WarningType;
  severity: WarningSeverity;
  message: string;
}

export interface PerformanceSummary {
  pid: number;
  healthScore: number;
  healthStatus: 'Excellent' | 'Good' | 'Warning' | 'Critical';
  peakCpu: number;
  peakMemory: number;
  avgCpu: number;
  avgMemory: number;
  trend: PerformanceTrend;
  warnings: PerformanceWarning[];
}
