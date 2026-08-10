import { SecurityHistoryRecord } from '@/domain/entities/SecurityHistoryRecord';
import { Clock, Shield, Lock, Search, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface SecurityHistoryListProps {
  historyRecords: SecurityHistoryRecord[];
}

export function SecurityHistoryList({ historyRecords }: SecurityHistoryListProps) {
  if (historyRecords.length === 0) {
    return (
      <div className="bg-surface border border-border p-12 rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
        <Clock className="w-12 h-12 text-muted-foreground/40 mb-3" />
        <h4 className="text-base font-semibold text-foreground">No scan history recorded yet</h4>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Run your first security scan to analyze project files for credentials, dependencies, and misconfigurations.
        </p>
      </div>
    );
  }

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'QUICK':
        return { label: 'Quick Security Scan', icon: Shield };
      case 'GIT_EXPOSURE':
        return { label: 'Git Exposure Scan', icon: Lock };
      case 'FULL':
      default:
        return { label: 'Full Security Scan', icon: Search };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/20">
            <CheckCircle className="w-3.5 h-3.5" />
            Completed
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-danger/10 text-danger border border-danger/20">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      case 'CANCELLED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-warning/10 text-warning border border-warning/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Cancelled
          </span>
        );
    }
  };

  const formatDuration = (ms: number) => {
    if (!ms || ms < 1000) return `${ms || 0}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remSec = seconds % 60;
    return `${minutes}m ${remSec}s`;
  };

  return (
    <div className="space-y-4">
      {historyRecords.map((record) => {
        const modeInfo = getModeLabel(record.scanMode);
        const Icon = modeInfo.icon;
        const formattedDate = new Date(record.completedAt || record.startedAt).toLocaleString();

        return (
          <div
            key={record.id || record.scanId}
            className="bg-surface border border-border p-5 rounded-xl shadow-sm hover:border-border/80 transition-colors flex flex-col gap-4"
          >
            {/* Top row: Target & Mode */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-foreground truncate">{modeInfo.label}</h4>
                  <p className="text-xs text-muted-foreground truncate">{record.targetName} • {record.targetPath}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {getStatusBadge(record.status)}
              </div>
            </div>

            {/* Middle row: Execution details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground uppercase font-medium text-[10px] tracking-wider">Timestamp</span>
                <span className="font-mono text-foreground">{formattedDate}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground uppercase font-medium text-[10px] tracking-wider">Duration</span>
                <span className="font-mono text-foreground">{formatDuration(record.durationMs)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground uppercase font-medium text-[10px] tracking-wider">Files Scanned</span>
                <span className="font-mono text-foreground">{record.scannedFiles.toLocaleString()} files</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground uppercase font-medium text-[10px] tracking-wider">Total Findings</span>
                <span className="font-mono font-bold text-foreground">{record.summary?.totalFindings ?? 0}</span>
              </div>
            </div>

            {/* Bottom row: Finding severity metrics */}
            {record.summary && record.summary.totalFindings > 0 && (
              <div className="flex items-center gap-2 pt-2 overflow-x-auto scrollbar-none">
                {record.summary.critical > 0 && (
                  <span className="px-2.5 py-1 rounded bg-danger/10 text-danger border border-danger/20 text-xs font-semibold">
                    Critical: {record.summary.critical}
                  </span>
                )}
                {record.summary.high > 0 && (
                  <span className="px-2.5 py-1 rounded bg-warning/10 text-warning border border-warning/20 text-xs font-semibold">
                    High: {record.summary.high}
                  </span>
                )}
                {record.summary.medium > 0 && (
                  <span className="px-2.5 py-1 rounded bg-accent/10 text-accent border border-accent/20 text-xs font-semibold">
                    Medium: {record.summary.medium}
                  </span>
                )}
                {record.summary.low > 0 && (
                  <span className="px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20 text-xs font-semibold">
                    Low: {record.summary.low}
                  </span>
                )}
              </div>
            )}

            {/* Error reason if Failed */}
            {record.reason && (
              <div className="text-xs text-danger bg-danger/5 p-3 rounded-lg border border-danger/20 font-mono">
                Error: {record.reason}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
