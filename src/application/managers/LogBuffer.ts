import { EventBus, EventType } from '../events/EventBus';

export interface LogMessage {
  projectId: string;
  profileId: string;
  timestamp: number;
  streamType: 'stdout' | 'stderr';
  message: string;
}

export class LogBufferManager {
  private buffers: Map<string, LogMessage[]> = new Map();
  private maxLines: number;

  constructor(maxLines: number = 5000) {
    this.maxLines = maxLines;
    EventBus.subscribe<LogMessage>(EventType.ProcessOutput, (payload) => this.handleLog(payload, 'stdout'));
    EventBus.subscribe<LogMessage>(EventType.ProcessErrorOutput, (payload) => this.handleLog(payload, 'stderr'));
  }

  private handleLog(payload: LogMessage, type: 'stdout' | 'stderr') {
    // Ensure streamType is set
    const log = { ...payload, streamType: type };
    const id = `${payload.projectId}-${payload.profileId}`;
    if (!this.buffers.has(id)) {
      this.buffers.set(id, []);
    }
    const buffer = this.buffers.get(id)!;
    buffer.push(log);
    
    // Maintain size limit
    if (buffer.length > this.maxLines) {
      buffer.shift();
    }
  }

  getRecent(projectId: string, profileId: string, limit: number = 100): LogMessage[] {
    const id = `${projectId}-${profileId}`;
    const buffer = this.buffers.get(id);
    if (!buffer) return [];
    return buffer.slice(-limit);
  }

  clear(projectId: string, profileId: string) {
    const id = `${projectId}-${profileId}`;
    this.buffers.set(id, []);
  }
}

