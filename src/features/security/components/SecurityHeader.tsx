import { Shield, Play, Square } from 'lucide-react';

interface SecurityHeaderProps {
  activeTargetName: string;
  status: string;
  onRunScan: () => void;
  onCancelScan: () => void;
  hasTarget: boolean;
}

export function SecurityHeader({ activeTargetName, status, onRunScan, onCancelScan, hasTarget }: SecurityHeaderProps) {
  const isScanning = status === 'SCANNING';

  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 flex-shrink-0 w-full">
      <div className="min-w-0 flex-1 flex-shrink-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2 leading-tight min-w-0">
          <Shield className="w-7 h-7 sm:w-8 sm:h-8 min-w-[28px] min-h-[28px] sm:min-w-[32px] sm:min-h-[32px] text-primary shrink-0" />
          <span className="truncate">Security Center</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base truncate leading-relaxed">
          Static security analysis for <span className="font-medium text-primary">{activeTargetName}</span>
        </p>
      </div>

      {isScanning ? (
        <button
          onClick={onCancelScan}
          className="flex items-center gap-2 px-5 py-2.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg transition-colors font-medium text-sm border border-destructive/20 shadow-sm whitespace-nowrap"
        >
          <Square className="w-4 h-4 min-w-[16px] min-h-[16px] shrink-0 fill-current" />
          Cancel Scan
        </button>
      ) : (
        <button
          onClick={onRunScan}
          disabled={!hasTarget}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm shadow-sm whitespace-nowrap"
        >
          <Play className="w-4 h-4 min-w-[16px] min-h-[16px] shrink-0 fill-current" />
          Run Security Scan
        </button>
      )}
    </div>
  );
}
