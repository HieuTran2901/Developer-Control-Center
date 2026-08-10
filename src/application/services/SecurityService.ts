import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { EventBus, EventType } from '../events/EventBus';
import { 
  SecurityFinding, 
  SecurityScanStatus, 
  SecurityScanSummary, 
  SecurityScanMode, 
  SecurityScanEventPayload 
} from '../../domain/entities/SecurityFinding';

export interface SecurityTargetState {
  name: string;
  path: string;
  id?: string;
}

export interface SecurityStateCache {
  activeTarget: SecurityTargetState | null;
  status: SecurityScanStatus;
  scanId: string | null;
  scanMode: SecurityScanMode;
  progress: { scannedFiles: number; currentScanner: string };
  findings: SecurityFinding[];
  summary: SecurityScanSummary | null;
}

export class SecurityService {
  private static instance: SecurityService;
  private unlistenSecurityEvent: UnlistenFn | null = null;

  private stateCache: SecurityStateCache = {
    activeTarget: null,
    status: 'IDLE',
    scanId: null,
    scanMode: 'FULL',
    progress: { scannedFiles: 0, currentScanner: '' },
    findings: [],
    summary: null,
  };

  private constructor() {
    this.setupListeners();
  }

  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  public getState(): SecurityStateCache {
    return { ...this.stateCache };
  }

  public setSelectedTarget(target: SecurityTargetState | null) {
    this.stateCache.activeTarget = target;
  }

  public setScanMode(mode: SecurityScanMode) {
    this.stateCache.scanMode = mode;
  }

  private async setupListeners() {
    this.unlistenSecurityEvent = await listen<SecurityScanEventPayload>('security_event', (event) => {
      const payload = event.payload;
      
      // We route the raw payload into our EventBus system
      if (payload.type === 'Started') {
        this.stateCache.status = 'SCANNING';
        this.stateCache.scanId = payload.payload.scanId;
        this.stateCache.findings = [];
        this.stateCache.summary = null;
        this.stateCache.progress = { scannedFiles: 0, currentScanner: 'Initializing...' };
        EventBus.publish(EventType.SecurityScanStarted, payload.payload);
      } else if (payload.type === 'Progress') {
        this.stateCache.progress = {
          scannedFiles: payload.payload.scannedFiles,
          currentScanner: payload.payload.currentScanner,
        };
        EventBus.publish(EventType.SecurityScanProgress, payload.payload);
      } else if (payload.type === 'FindingsChunk') {
        this.stateCache.findings = [...this.stateCache.findings, ...payload.payload.findings];
        EventBus.publish(EventType.SecurityFindingsChunkDetected, payload.payload);
      } else if (payload.type === 'Completed') {
        this.stateCache.status = 'COMPLETED';
        this.stateCache.summary = payload.payload.summary;
        EventBus.publish(EventType.SecurityScanCompleted, payload.payload);
      } else if (payload.type === 'Failed') {
        this.stateCache.status = 'FAILED';
        EventBus.publish(EventType.SecurityScanFailed, payload.payload);
      } else if (payload.type === 'Cancelled') {
        this.stateCache.status = 'CANCELLED';
        EventBus.publish(EventType.SecurityScanCancelled, payload.payload);
      } else {
        console.warn('[SecurityService] Unknown security_event type:', (payload as any).type);
      }
    });
  }

  public async startSecurityScan(projectId: string, rootPath: string, mode?: string): Promise<string> {
    try {
      return await invoke<string>('start_security_scan_cmd', { projectId, rootPath, mode });
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
