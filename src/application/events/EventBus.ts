export enum EventType {
  ProcessStarting = 'PROCESS_STARTING',
  ProcessStarted = 'PROCESS_STARTED',
  ProcessStopping = 'PROCESS_STOPPING',
  ProcessStopped = 'PROCESS_STOPPED',
  ProcessFailed = 'PROCESS_FAILED',
  ProcessMetricsUpdated = 'PROCESS_METRICS_UPDATED',
  ProcessExited = 'PROCESS_EXITED',
  ProcessRestarting = 'PROCESS_RESTARTING',
  ProcessRestarted = 'PROCESS_RESTARTED',
  ProcessReadinessChanged = 'PROCESS_READINESS_CHANGED',
  ZombieDetected = 'ZOMBIE_DETECTED',
  RegistryCleaned = 'REGISTRY_CLEANED',
  ProcessOutput = 'PROCESS_OUTPUT',
  ProcessErrorOutput = 'PROCESS_ERROR_OUTPUT',
  LogReceived = 'LogReceived',
  WorkspaceChanged = 'WorkspaceChanged',
  SettingsChanged = 'SettingsChanged',
  PortOpened = 'PortOpened',
  PortClosed = 'PortClosed',
  ResourceUpdated = 'ResourceUpdated',
  HistoryMetricsUpdated = 'HISTORY_METRICS_UPDATED',
  AlertTriggered = 'ALERT_TRIGGERED',
  PerformanceSummaryUpdated = 'PERFORMANCE_SUMMARY_UPDATED'
}

export type EventHandler<T = any> = (payload: T) => void;

class EventBusImpl {
  private handlers: Map<EventType, EventHandler[]> = new Map();

  subscribe<T>(event: EventType, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    const list = this.handlers.get(event)!;
    list.push(handler);
    console.log(`[DEBUG 8 EventBus] Subscribed to ${event}. Total subscribers: ${list.length}`);

    // Return unsubscribe function
    return () => {
      const currentHandlers = this.handlers.get(event);
      if (currentHandlers) {
        this.handlers.set(
          event,
          currentHandlers.filter((h) => h !== handler)
        );
        console.log(`[DEBUG 8 EventBus] Unsubscribed from ${event}. Remaining: ${this.handlers.get(event)?.length || 0}`);
      }
    };
  }

  publish<T>(event: EventType, payload: T): void {
    const eventHandlers = this.handlers.get(event);
    const count = eventHandlers ? eventHandlers.length : 0;
    console.log(`[DEBUG 8 EventBus] Publish ${event} to ${count} subscribers. Payload:`, payload);
    if (eventHandlers) {
      eventHandlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`[DEBUG 8 EventBus] Error in event handler for ` + event, error);
        }
      });
    }
  }
}

export const EventBus = new EventBusImpl();




