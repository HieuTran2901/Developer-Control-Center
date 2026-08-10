import { EventBus, EventType } from '@/application/events/EventBus';
import { ProcessMetrics } from '@/domain/entities/ProcessMetrics';
import { ProcessHistory } from '@/domain/entities/ProcessHistory';

const MAX_SAMPLES = 300;

export class ResourceHistoryService {
  private histories: Map<number, ProcessHistory> = new Map();

  constructor() {
    this.setupSubscriptions();
  }

  private setupSubscriptions() {
    EventBus.subscribe<ProcessMetrics[]>(EventType.ProcessMetricsUpdated, (metricsList) => {
      let updated = false;
      const now = Date.now();

      metricsList.forEach(m => {
        let history = this.histories.get(m.pid);
        if (!history) {
          history = {
            pid: m.pid,
            cpu: [],
            memory: [],
            timestamps: [],
            peakCpu: 0,
            peakMemory: 0,
            avgCpu: 0,
            avgMemory: 0
          };
          this.histories.set(m.pid, history);
        }

        // Circular buffer behavior (keep last MAX_SAMPLES)
        history.cpu.push(m.cpu);
        history.memory.push(m.memory);
        history.timestamps.push(now);

        if (history.cpu.length > MAX_SAMPLES) {
          history.cpu.shift();
          history.memory.shift();
          history.timestamps.shift();
        }

        // Compute metrics
        history.peakCpu = Math.max(history.peakCpu, m.cpu);
        history.peakMemory = Math.max(history.peakMemory, m.memory);
        
        let sumCpu = 0;
        let sumMem = 0;
        for (let i = 0; i < history.cpu.length; i++) {
          sumCpu += history.cpu[i];
          sumMem += history.memory[i];
        }
        history.avgCpu = sumCpu / history.cpu.length;
        history.avgMemory = sumMem / history.memory.length;

        updated = true;
      });

      if (updated) {
        // Emit history list
        EventBus.publish(EventType.HistoryMetricsUpdated, Array.from(this.histories.values()));
      }
    });

    // Cleanup when process stops
    EventBus.subscribe<any>(EventType.ProcessStopped, (payload) => {
      if (payload.pid) {
        this.histories.delete(payload.pid);
        EventBus.publish(EventType.HistoryMetricsUpdated, Array.from(this.histories.values()));
      }
    });
    EventBus.subscribe<any>(EventType.ProcessExited, (payload) => {
      if (payload.pid) {
        this.histories.delete(payload.pid);
        EventBus.publish(EventType.HistoryMetricsUpdated, Array.from(this.histories.values()));
      }
    });
  }
}
