import { EventBus, EventType } from '@/application/events/EventBus';
import { ProcessHistory } from '@/domain/entities/ProcessHistory';
import { PerformanceSummary, PerformanceTrendDirection, PerformanceWarning } from '@/domain/entities/PerformanceSummary';

export class PerformanceAnalysisService {
  private summaries: Map<number, PerformanceSummary> = new Map();

  constructor() {
    this.setupSubscriptions();
  }

  private setupSubscriptions() {
    EventBus.subscribe<ProcessHistory[]>(EventType.HistoryMetricsUpdated, (histories) => {
      let updated = false;

      histories.forEach(history => {
        const summary = this.analyzeHistory(history);
        this.summaries.set(history.pid, summary);
        updated = true;
      });

      if (updated) {
        EventBus.publish(EventType.PerformanceSummaryUpdated, Array.from(this.summaries.values()));
      }
    });

    EventBus.subscribe<any>(EventType.ProcessStopped, (payload) => {
      if (payload.pid) this.summaries.delete(payload.pid);
    });
    EventBus.subscribe<any>(EventType.ProcessExited, (payload) => {
      if (payload.pid) this.summaries.delete(payload.pid);
    });
  }

  private analyzeHistory(history: ProcessHistory): PerformanceSummary {
    const n = history.cpu.length;
    if (n === 0) {
      return {
        pid: history.pid,
        healthScore: 100,
        healthStatus: 'Excellent',
        peakCpu: 0,
        peakMemory: 0,
        avgCpu: 0,
        avgMemory: 0,
        trend: { cpu: 'stable', memory: 'stable', isMemoryLeakSuspected: false },
        warnings: []
      };
    }

    // Trend Detection
    const third = Math.floor(n / 3);
    let cpuTrend: PerformanceTrendDirection = 'stable';
    let memTrend: PerformanceTrendDirection = 'stable';
    let isMemoryLeakSuspected = false;

    if (third > 10) {
      const firstThirdCpu = this.avg(history.cpu.slice(0, third));
      const lastThirdCpu = this.avg(history.cpu.slice(n - third));
      if (lastThirdCpu > firstThirdCpu * 1.2) cpuTrend = 'increasing';
      else if (lastThirdCpu < firstThirdCpu * 0.8) cpuTrend = 'decreasing';

      const firstThirdMem = this.avg(history.memory.slice(0, third));
      const lastThirdMem = this.avg(history.memory.slice(n - third));
      if (lastThirdMem > firstThirdMem * 1.1) {
        memTrend = 'increasing';
        // Simple memory leak heuristic: strictly increasing across 3 parts
        const midThirdMem = this.avg(history.memory.slice(third, 2 * third));
        if (firstThirdMem < midThirdMem && midThirdMem < lastThirdMem) {
          isMemoryLeakSuspected = true;
        }
      } else if (lastThirdMem < firstThirdMem * 0.9) {
        memTrend = 'decreasing';
      }
    }

    // Spike Detection & Warnings
    const warnings: PerformanceWarning[] = [];
        let temporaryCpuSpikes = 0;

    for (let i = 1; i < n; i++) {
      if (history.cpu[i] > history.avgCpu * 2 && history.cpu[i] > 50) {
        if (history.cpu[i] > history.cpu[i-1] * 1.5) { // sharp increase
          temporaryCpuSpikes++;
        }
      }
    }

    // Sustained high CPU?
    let sustainedHighCpu = false;
    if (n >= 10) {
      sustainedHighCpu = history.cpu.slice(n - 10).every(val => val > 80);
      if (sustainedHighCpu) {
        warnings.push({ id: `w-${history.pid}-cpu-sustained`, type: 'sustained_high_cpu', severity: 'critical', message: 'Sustained High CPU (>80% for 10s)' });
      }
    }

    if (isMemoryLeakSuspected) {
      warnings.push({ id: `w-${history.pid}-mem-leak`, type: 'memory_leak', severity: 'warning', message: 'Memory leak suspected (consistent increase)' });
    }

    if (temporaryCpuSpikes > 5) {
      warnings.push({ id: `w-${history.pid}-cpu-spike`, type: 'cpu_spike', severity: 'info', message: `Detected ${temporaryCpuSpikes} temporary CPU spikes` });
    }

    // Health Scoring
    let score = 100;
    if (sustainedHighCpu) score -= 20;
    if (isMemoryLeakSuspected) score -= 20;
    score -= Math.min(15, temporaryCpuSpikes * 3);
    if (history.avgCpu > 80) score -= 20;
    if (history.avgCpu > 95) score -= 40;
    
    score = Math.max(0, Math.min(100, score));

    let status: 'Excellent' | 'Good' | 'Warning' | 'Critical' = 'Excellent';
    if (score < 50) status = 'Critical';
    else if (score < 75) status = 'Warning';
    else if (score < 90) status = 'Good';

    return {
      pid: history.pid,
      healthScore: score,
      healthStatus: status,
      peakCpu: history.peakCpu,
      peakMemory: history.peakMemory,
      avgCpu: history.avgCpu,
      avgMemory: history.avgMemory,
      trend: { cpu: cpuTrend, memory: memTrend, isMemoryLeakSuspected },
      warnings
    };
  }

  private avg(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}

