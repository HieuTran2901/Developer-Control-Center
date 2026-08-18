import { Icon } from '@/shared/components/ui/Icon';
import { RankedAccount } from '@/domain/services/QuotaOrchestrationService';

interface MultiAccountSummaryProps {
  totalAccounts: number;
  onlineCount: number;
  attentionCount: number;
  staleCount: number;
  best5hAccount: RankedAccount | null;
  bestWeeklyAccount: RankedAccount | null;
  earliestResetAccount: RankedAccount | null;
}

export function MultiAccountSummary({
  totalAccounts,
  onlineCount,
  attentionCount,
  staleCount,
  best5hAccount,
  bestWeeklyAccount,
  earliestResetAccount,
}: MultiAccountSummaryProps) {
  const onlinePct = totalAccounts > 0 ? Math.round((onlineCount / totalAccounts) * 100) : 0;

  const formatCountdown = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return '—';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
      {/* 1. Total Accounts */}
      <div className="p-3 rounded-xl bg-surface border border-border/70 shadow-xs space-y-1 relative overflow-hidden">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-medium uppercase tracking-wider">Total Accounts</span>
          <Icon name="Users" className="w-3.5 h-3.5 text-primary/70" />
        </div>
        <div className="text-xl font-bold text-foreground font-mono">{totalAccounts}</div>
        <div className="text-[10px] text-muted-foreground">Monitored</div>
      </div>

      {/* 2. Online */}
      <div className="p-3 rounded-xl bg-surface border border-border/70 shadow-xs space-y-1 relative overflow-hidden">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-medium uppercase tracking-wider">Online</span>
          <div className="w-3.5 h-3.5 rounded-full bg-success/20 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-success" />
          </div>
        </div>
        <div className="text-xl font-bold text-success font-mono">{onlineCount}</div>
        <div className="text-[10px] text-muted-foreground">{onlinePct}% of total</div>
      </div>

      {/* 3. Action Required */}
      <div className="p-3 rounded-xl bg-surface border border-border/70 shadow-xs space-y-1 relative overflow-hidden">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-medium uppercase tracking-wider">Action Required</span>
          <Icon name="AlertTriangle" className="w-3.5 h-3.5 text-warning" />
        </div>
        <div className={`text-xl font-bold font-mono ${attentionCount > 0 ? 'text-warning' : 'text-foreground'}`}>
          {attentionCount}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {attentionCount > 0 ? 'Needs attention' : 'All clear'}
        </div>
      </div>

      {/* 4. Stale */}
      <div className="p-3 rounded-xl bg-surface border border-border/70 shadow-xs space-y-1 relative overflow-hidden">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-medium uppercase tracking-wider">Stale</span>
          <Icon name="Clock" className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className={`text-xl font-bold font-mono ${staleCount > 0 ? 'text-purple-400' : 'text-foreground'}`}>
          {staleCount}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {staleCount > 0 ? 'Sync delayed' : 'Fully synced'}
        </div>
      </div>

      {/* 5. Best 5H Quota */}
      <div className="p-3 rounded-xl bg-surface border border-border/70 shadow-xs space-y-1 relative overflow-hidden">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-medium uppercase tracking-wider">Best 5H Quota</span>
          <Icon name="TrendingUp" className="w-3.5 h-3.5 text-success" />
        </div>
        <div className="text-xl font-bold text-success font-mono">
          {best5hAccount && best5hAccount.fraction5h !== null
            ? `${(best5hAccount.fraction5h * 100).toFixed(1)}%`
            : '—'}
        </div>
        <div className="text-[10px] text-muted-foreground truncate" title={best5hAccount?.displayName}>
          {best5hAccount?.displayName || 'No data'}
        </div>
      </div>

      {/* 6. Best Weekly Quota */}
      <div className="p-3 rounded-xl bg-surface border border-border/70 shadow-xs space-y-1 relative overflow-hidden">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-medium uppercase tracking-wider">Best Weekly Quota</span>
          <Icon name="Activity" className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="text-xl font-bold text-primary font-mono">
          {bestWeeklyAccount && bestWeeklyAccount.fractionWeekly !== null
            ? `${(bestWeeklyAccount.fractionWeekly * 100).toFixed(1)}%`
            : '—'}
        </div>
        <div className="text-[10px] text-muted-foreground truncate" title={bestWeeklyAccount?.displayName}>
          {bestWeeklyAccount?.displayName || 'No data'}
        </div>
      </div>

      {/* 7. Next Reset (Earliest) */}
      <div className="p-3 rounded-xl bg-surface border border-border/70 shadow-xs space-y-1 relative overflow-hidden">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-medium uppercase tracking-wider truncate">Next Reset</span>
          <Icon name="RotateCcw" className="w-3.5 h-3.5 text-purple-400" />
        </div>
        <div className="text-xl font-bold text-purple-300 font-mono">
          {formatCountdown(earliestResetAccount?.earliestResetSeconds ?? null)}
        </div>
        <div className="text-[10px] text-muted-foreground">5H Window</div>
      </div>
    </div>
  );
}
