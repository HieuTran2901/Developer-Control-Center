export type SecuritySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type SecurityCategory = 
  | 'DEPENDENCY'
  | 'SECRET'
  | 'CONFIGURATION'
  | 'ENVIRONMENT'
  | 'GIT'
  | 'PERMISSION'
  | 'FILE_EXPOSURE';

export type SecurityScanStatus = 'IDLE' | 'SCANNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type SecurityScanMode = 'QUICK' | 'GIT_EXPOSURE' | 'FULL';
export interface DependencyMetadata {
  ecosystem: string;
  packageName: string;
  version: string;
  vulnerabilityId?: string;
  aliases?: string[];
  details?: string;
  references?: string[];
  fixedVersion?: string;
}

export type FindingMetadata = 
  | { type: 'Dependency'; data: DependencyMetadata };

export interface SecurityFinding {
  id: string;
  severity: SecuritySeverity;
  category: SecurityCategory;
  title: string;
  description: string;
  filePath: string;
  line?: number;
  evidence?: string;
  remediation?: string;
  scannerId: string;
  confidence: number;
  metadata?: FindingMetadata;
}

export interface SecurityScanSummary {
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  scanDurationMs: number;
}

export type SecurityScanEventPayload = 
  | { type: 'Started'; payload: { projectId: string; scanId: string } }
  | { type: 'Progress'; payload: { scanId: string; scannedFiles: number; currentScanner: string } }
  | { type: 'FindingsChunk'; payload: { scanId: string; findings: SecurityFinding[] } }
  | { type: 'Completed'; payload: { scanId: string; summary: SecurityScanSummary } }
  | { type: 'Failed'; payload: { scanId: string; reason: string } }
  | { type: 'Cancelled'; payload: { scanId: string } };
