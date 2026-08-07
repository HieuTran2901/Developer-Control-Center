import { EventBus, EventType } from '@/application/events/EventBus';
import { ProcessMetrics } from '@/domain/entities/ProcessMetrics';
import { Alert } from '@/domain/entities/Alert';
import { ProcessStatusResponse } from '@/desktop/ipc/dto/ProcessStatusResponse';

export class AlertService {
  private alerts: Alert[] = [];
  private consecutiveHighCpu: Map<number, number> = new Map();
  private restartCounts: Map<string, number> = new Map();

  constructor() {
    this.setupSubscriptions();
  }

  private addAlert(alert: Omit<Alert, 'id' | 'timestamp'>) {
    const newAlert: Alert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    
    this.alerts.unshift(newAlert);
    if (this.alerts.length > 50) {
      this.alerts.pop();
    }
    
    EventBus.publish(EventType.AlertTriggered, this.alerts);
  }

  private setupSubscriptions() {
    EventBus.subscribe<ProcessMetrics[]>(EventType.ProcessMetricsUpdated, (metricsList) => {
      metricsList.forEach(m => {
        // CPU High logic
        if (m.cpu > 90) {
          const count = (this.consecutiveHighCpu.get(m.pid) || 0) + 1;
          this.consecutiveHighCpu.set(m.pid, count);
          
          if (count === 10) { // 10 seconds > 90%
            this.addAlert({
              pid: m.pid,
              type: 'cpu_high',
              message: `Process CPU sustained > 90%`
            });
          }
        } else {
          this.consecutiveHighCpu.set(m.pid, 0);
        }

        // Memory High logic (arbitrary threshold 2GB for demo)
        if (m.memory > 2 * 1024 * 1024 * 1024) {
          this.addAlert({
            pid: m.pid,
            type: 'mem_high',
            message: `Memory exceeded 2GB`
          });
        }
      });
    });

    EventBus.subscribe<ProcessStatusResponse>(EventType.ProcessFailed, (payload) => {
      this.addAlert({
        pid: payload.pid,
        type: 'crash',
        message: `Process crashed or failed to start: ${payload.profileId}`
      });
    });

    EventBus.subscribe<ProcessStatusResponse>(EventType.ProcessRestarting, (payload) => {
      const key = payload.profileId;
      const count = (this.restartCounts.get(key) || 0) + 1;
      this.restartCounts.set(key, count);
      
      if (count > 3) { // 3 restarts in short time? We don't reset count in this simple demo
        this.addAlert({
          type: 'restart_loop',
          message: `Restart loop detected for ${payload.profileId}`
        });
      }
    });
  }
}
