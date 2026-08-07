import { listen } from '@tauri-apps/api/event';
import { EventBus, EventType } from '@/application/events/EventBus';
import { runtimeRegistry } from '@/application/services';
import { ProcessState } from '@/domain/entities/ProcessState';

interface ProcessEventPayload {
  type: string;
  payload: any;
}

type ProcessEventHandler = (id: string, payload: any) => void;

const processEventHandlers: Record<string, ProcessEventHandler> = {
  'ProcessStarting': (id, payload) => {
    runtimeRegistry.update(id, { status: ProcessState.Starting });
    EventBus.publish(EventType.ProcessStarting, payload);
  },
  'ProcessStarted': (id, payload) => {
    runtimeRegistry.update(id, { status: ProcessState.Running, pid: payload.pid });
    EventBus.publish(EventType.ProcessStarted, { ...payload, status: ProcessState.Running });
  },
  'ProcessRestarting': (id, payload) => {
    runtimeRegistry.update(id, { status: ProcessState.Restarting });
    EventBus.publish(EventType.ProcessRestarting, payload);
  },
  'ProcessStopping': (id, payload) => {
    runtimeRegistry.update(id, { status: ProcessState.Stopping });
    EventBus.publish(EventType.ProcessStopping, payload);
  },
  'ProcessStopped': (id, payload) => {
    runtimeRegistry.update(id, { status: ProcessState.Stopped, stopTime: Date.now() });
    EventBus.publish(EventType.ProcessStopped, payload);
  },
  'ProcessExited': (id, payload) => {
    runtimeRegistry.update(id, { status: ProcessState.Stopped, stopTime: Date.now() });
    EventBus.publish(EventType.ProcessExited, payload);
  },
  'ProcessFailed': (id, payload) => {
    runtimeRegistry.update(id, { status: ProcessState.Failed, stopTime: Date.now() });
    EventBus.publish(EventType.ProcessFailed, payload);
  },
  'ProcessOutput': (_id, payload) => {
    EventBus.publish(EventType.ProcessOutput, payload);
  },
  'ProcessErrorOutput': (_id, payload) => {
    EventBus.publish(EventType.ProcessErrorOutput, payload);
  }
};

export async function setupDesktopIpc() {
  await listen<ProcessEventPayload>('process_event', (event) => {
    const { type, payload } = event.payload;
    const { projectId, profileId } = payload;
    const id = `${projectId}-${profileId}`;

    const handler = processEventHandlers[type];
    if (handler) {
      handler(id, payload);
    } else {
      console.warn(`[IPC Adapter] Unknown Process Event dropped: ${type}`, payload);
    }
  });
}

