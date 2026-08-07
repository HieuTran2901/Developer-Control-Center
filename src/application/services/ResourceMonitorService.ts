import { IResourceGateway } from '@/application/interfaces/gateways/IResourceGateway';
import { EventBus, EventType } from '@/application/events/EventBus';
import { ProcessStatusResponse } from '@/desktop/ipc/dto/ProcessStatusResponse';

export class ResourceMonitorService {
  constructor(private resourceGateway: IResourceGateway) {
    this.setupSubscriptions();
  }

  private setupSubscriptions() {
    EventBus.subscribe<ProcessStatusResponse>(EventType.ProcessStarted, async (payload) => {
      if (payload.pid) {
        await this.resourceGateway.watchPid(payload.pid);
      }
    });

    EventBus.subscribe<ProcessStatusResponse>(EventType.ProcessStopped, async (payload) => {
      if (payload.pid) {
        await this.resourceGateway.unwatchPid(payload.pid);
      }
    });

    EventBus.subscribe<ProcessStatusResponse>(EventType.ProcessExited, async (payload) => {
      if (payload.pid) {
        await this.resourceGateway.unwatchPid(payload.pid);
      }
    });

    EventBus.subscribe<ProcessStatusResponse>(EventType.ProcessFailed, async (payload) => {
      if (payload.pid) {
        await this.resourceGateway.unwatchPid(payload.pid);
      }
    });
  }
}

