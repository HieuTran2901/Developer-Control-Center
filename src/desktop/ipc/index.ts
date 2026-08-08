import { listen } from '@tauri-apps/api/event';
import { EventBus, EventType } from '@/application/events/EventBus';
import { runtimeRegistry } from '@/application/services';
import { ProcessState } from '@/domain/entities/ProcessState';
import { ReadinessState } from '@/domain/entities/ReadinessState';

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
    runtimeRegistry.update(id, { status: ProcessState.Running, pid: payload.pid, readiness: payload.readiness as ReadinessState });
    EventBus.publish(EventType.ProcessStarted, { ...payload, status: ProcessState.Running });
  },
  'ProcessReadinessChanged': (id, payload) => {
    runtimeRegistry.update(id, { readiness: payload.readiness as ReadinessState });
    EventBus.publish(EventType.ProcessReadinessChanged, payload);
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
    runtimeRegistry.update(id, { status: ProcessState.Stopped, stopTime: Date.now(), readiness: ReadinessState.Unknown });
    EventBus.publish(EventType.ProcessStopped, { ...payload, status: ProcessState.Stopped, readiness: ReadinessState.Unknown });
  },
  'ProcessExited': (id, payload) => {
    runtimeRegistry.update(id, { status: ProcessState.Stopped, stopTime: Date.now(), readiness: ReadinessState.Unknown });
    EventBus.publish(EventType.ProcessExited, { ...payload, status: ProcessState.Stopped, readiness: ReadinessState.Unknown });
  },
  'ProcessFailed': (id, payload) => {
    runtimeRegistry.update(id, { status: ProcessState.Failed, stopTime: Date.now(), readiness: ReadinessState.Unknown });
    EventBus.publish(EventType.ProcessFailed, { ...payload, status: ProcessState.Failed, readiness: ReadinessState.Unknown });
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

