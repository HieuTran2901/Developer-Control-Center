import { ShieldCheck, AlertCircle, Loader2, Info } from 'lucide-react';
import { SecurityScanStatus } from '@/domain/entities/SecurityFinding';

interface SecurityStatusMetricsProps {
  status: SecurityScanStatus;
  findingsCount: number;
  scannedFiles: number;
}

export function SecurityStatusMetrics({ status, findingsCount, scannedFiles }: SecurityStatusMetricsProps) {
  
  const getStatusDisplay = () => {
    switch (status) {
      case 'IDLE': return { label: 'Ready to scan', sub: 'Click \'Run Security Scan\' to start analysis', color: 'text-success', bg: 'bg-success/10', border: 'border-success/20', Icon: ShieldCheck };
      case 'SCANNING': return { label: 'Scanning...', sub: `${scannedFiles} files scanned`, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', Icon: Loader2 };
      case 'COMPLETED': return { label: 'Scan completed', sub: 'Analysis finished successfully', color: 'text-success', bg: 'bg-success/10', border: 'border-success/20', Icon: ShieldCheck };
      case 'FAILED': return { label: 'Scan failed', sub: 'An error occurred during analysis', color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20', Icon: AlertCircle };
      case 'CANCELLED': return { label: 'Scan cancelled', sub: 'The scan was interrupted', color: 'text-muted-foreground', bg: 'bg-surface-hover', border: 'border-border', Icon: Info };
      default: return { label: status, sub: '', color: 'text-muted-foreground', bg: 'bg-surface-hover', border: 'border-border', Icon: Info };
    }
  };

  const statusInfo = getStatusDisplay();
  const StatusIcon = statusInfo.Icon;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Status Card */}
      <div className={`bg-surface border p-4 sm:p-5 rounded-xl shadow-sm flex items-center gap-4 ${status === 'IDLE' || status === 'COMPLETED' ? 'border-success/30' : status === 'SCANNING' ? 'border-primary/30' : 'border-border'}`}>
        <div className={`p-3 rounded-full flex-shrink-0 flex items-center justify-center ${statusInfo.bg}`}>
          <StatusIcon className={`w-6 h-6 ${statusInfo.color} ${status === 'SCANNING' ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</span>
          <span className="text-lg font-bold text-foreground mt-0.5 truncate">{statusInfo.label}</span>
          <span className="text-xs text-muted-foreground mt-0.5 truncate">{statusInfo.sub}</span>
        </div>
      </div>

      {/* Findings Card */}
      <div className={`bg-surface border p-4 sm:p-5 rounded-xl shadow-sm flex items-center gap-4 ${findingsCount > 0 ? 'border-warning/30' : 'border-border'}`}>
        <div className={`p-3 rounded-full flex-shrink-0 flex items-center justify-center ${findingsCount > 0 ? 'bg-warning/10' : 'bg-surface-hover'}`}>
          <AlertCircle className={`w-6 h-6 ${findingsCount > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Findings</span>
          <span className="text-lg font-bold text-foreground mt-0.5 truncate">{findingsCount}</span>
          <span className="text-xs text-muted-foreground mt-0.5 truncate">
            {findingsCount === 0 
              ? (status === 'COMPLETED' ? 'No vulnerabilities detected' : 'No vulnerabilities detected yet')
              : 'Security issues require attention'}
          </span>
        </div>
      </div>
    </div>
  );
}
