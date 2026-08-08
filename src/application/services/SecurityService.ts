import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { EventBus, EventType } from '../events/EventBus';
import { SecurityScanEventPayload } from '../../domain/entities/SecurityFinding';

export class SecurityService {
  private static instance: SecurityService;
  private unlistenSecurityEvent: UnlistenFn | null = null;

  private constructor() {
    this.setupListeners();
  }

  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  private async setupListeners() {
    this.unlistenSecurityEvent = await listen<SecurityScanEventPayload>('security_event', (event) => {
      const payload = event.payload;
      
      // We route the raw payload into our EventBus system
      if (payload.type === 'Started') {
        EventBus.publish(EventType.SecurityScanStarted, payload.payload);
      } else if (payload.type === 'Progress') {
        EventBus.publish(EventType.SecurityScanProgress, payload.payload);
      } else if (payload.type === 'FindingsChunk') {
        EventBus.publish(EventType.SecurityFindingsChunkDetected, payload.payload);
      } else if (payload.type === 'Completed') {
        EventBus.publish(EventType.SecurityScanCompleted, payload.payload);
      } else if (payload.type === 'Failed') {
        EventBus.publish(EventType.SecurityScanFailed, payload.payload);
      } else if (payload.type === 'Cancelled') {
        EventBus.publish(EventType.SecurityScanCancelled, payload.payload);
      } else {
        console.warn('[SecurityService] Unknown security_event type:', (payload as any).type);
      }
    });
  }

  public async startSecurityScan(projectId: string, rootPath: string): Promise<string> {
    try {
      return await invoke<string>('start_security_scan_cmd', { projectId, rootPath });
    } catch (e) {
      console.error('[SecurityService] Failed to start security scan', e);
      throw e;
    }
  }

  public async cancelSecurityScan(scanId: string): Promise<void> {
    try {
      await invoke<void>('cancel_security_scan_cmd', { scanId });
    } catch (e) {
      console.error('[SecurityService] Failed to cancel security scan', e);
      throw e;
    }
  }

  public destroy() {
    if (this.unlistenSecurityEvent) {
      this.unlistenSecurityEvent();
      this.unlistenSecurityEvent = null;
    }
  }
}

export const securityService = SecurityService.getInstance();
