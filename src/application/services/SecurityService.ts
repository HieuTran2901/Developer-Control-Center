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

import { SecurityHistoryRecord } from '../../domain/entities/SecurityHistoryRecord';
import { securityHistoryRepository } from './index';

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
  startedAt?: number;
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
    startedAt: undefined,
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
        const now = Date.now();
        this.stateCache.status = 'SCANNING';
        this.stateCache.scanId = payload.payload.scanId;
        this.stateCache.startedAt = now;
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
        const now = Date.now();
        this.stateCache.status = 'COMPLETED';
        this.stateCache.summary = payload.payload.summary;

        const scanId = payload.payload.scanId;
        const record: SecurityHistoryRecord = {
          id: scanId,
          scanId,
          projectId: this.stateCache.activeTarget?.id,
          targetName: this.stateCache.activeTarget?.name || 'Unknown Project',
          targetPath: this.stateCache.activeTarget?.path || '',
          scanMode: this.stateCache.scanMode,
          status: 'COMPLETED',
          startedAt: this.stateCache.startedAt || (now - payload.payload.summary.scanDurationMs),
          completedAt: now,
          durationMs: payload.payload.summary.scanDurationMs,
          scannedFiles: this.stateCache.progress.scannedFiles,
          summary: payload.payload.summary,
        };
        securityHistoryRepository.addRecord(record).then(() => {
          EventBus.publish(EventType.SecurityHistoryUpdated, record);
        });

        EventBus.publish(EventType.SecurityScanCompleted, payload.payload);
      } else if (payload.type === 'Failed') {
        const now = Date.now();
        this.stateCache.status = 'FAILED';
        
        const scanId = payload.payload.scanId;
        const duration = this.stateCache.startedAt ? now - this.stateCache.startedAt : 0;
        const record: SecurityHistoryRecord = {
          id: scanId,
          scanId,
          projectId: this.stateCache.activeTarget?.id,
          targetName: this.stateCache.activeTarget?.name || 'Unknown Project',
          targetPath: this.stateCache.activeTarget?.path || '',
          scanMode: this.stateCache.scanMode,
          status: 'FAILED',
          startedAt: this.stateCache.startedAt || now,
          completedAt: now,
          durationMs: duration,
          scannedFiles: this.stateCache.progress.scannedFiles,
          summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0, scanDurationMs: duration },
          reason: payload.payload.reason,
        };
        securityHistoryRepository.addRecord(record).then(() => {
          EventBus.publish(EventType.SecurityHistoryUpdated, record);
        });

        EventBus.publish(EventType.SecurityScanFailed, payload.payload);
      } else if (payload.type === 'Cancelled') {
        const now = Date.now();
        this.stateCache.status = 'CANCELLED';

        const scanId = payload.payload.scanId;
        const duration = this.stateCache.startedAt ? now - this.stateCache.startedAt : 0;
        const record: SecurityHistoryRecord = {
          id: scanId,
          scanId,
          projectId: this.stateCache.activeTarget?.id,
          targetName: this.stateCache.activeTarget?.name || 'Unknown Project',
          targetPath: this.stateCache.activeTarget?.path || '',
          scanMode: this.stateCache.scanMode,
          status: 'CANCELLED',
          startedAt: this.stateCache.startedAt || now,
          completedAt: now,
          durationMs: duration,
          scannedFiles: this.stateCache.progress.scannedFiles,
          summary: { totalFindings: this.stateCache.findings.length, critical: 0, high: 0, medium: 0, low: 0, info: 0, scanDurationMs: duration },
        };
        securityHistoryRepository.addRecord(record).then(() => {
          EventBus.publish(EventType.SecurityHistoryUpdated, record);
        });

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

  public async getProjectContext(projectId: string, rootPath: string): Promise<import('../../domain/entities/SecurityProjectContext').SecurityProjectContext> {
    try {
      return await invoke<import('../../domain/entities/SecurityProjectContext').SecurityProjectContext>('get_security_project_context_cmd', { projectId, rootPath });
    } catch (e) {
      console.error('[SecurityService] Failed to get security project context', e);
      throw e;
    }
  }

  public async getScanPlan(projectId: string, rootPath: string, mode?: string): Promise<import('../../domain/entities/SecurityScanPlan').SecurityScanPlan> {
    try {
      return await invoke<import('../../domain/entities/SecurityScanPlan').SecurityScanPlan>('get_security_scan_plan_cmd', { projectId, rootPath, mode });
    } catch (e) {
      console.error('[SecurityService] Failed to get security scan plan', e);
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
