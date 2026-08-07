import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { IResourceGateway } from '@/application/interfaces/gateways/IResourceGateway';
import { EventBus, EventType } from '@/application/events/EventBus';
import { ProcessMetrics } from '@/domain/entities/ProcessMetrics';

export class TauriResourceGateway implements IResourceGateway {
  private isListening = false;

  constructor() {
    this.setupListener();
  }

  private async setupListener() {
    if (this.isListening) return;
    this.isListening = true;
    
    await listen<ProcessMetrics[]>('process_metrics', (event) => {
      EventBus.publish(EventType.ProcessMetricsUpdated, event.payload);
    });
  }

  async watchPid(pid: number): Promise<void> {
    await invoke('watch_pid_cmd', { pid });
  }

  async unwatchPid(pid: number): Promise<void> {
    await invoke('unwatch_pid_cmd', { pid });
  }
}
