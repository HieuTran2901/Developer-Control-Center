import { SecurityScanMode, SecurityScanSummary } from './SecurityFinding';

export interface SecurityHistoryRecord {
  id: string; // scanId (idempotency key)
  scanId: string;
  projectId?: string;
  targetName: string;
  targetPath: string;
  scanMode: SecurityScanMode;
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startedAt: number;
  completedAt: number;
  durationMs: number;
  scannedFiles: number;
  summary: SecurityScanSummary;
  reason?: string;
}
