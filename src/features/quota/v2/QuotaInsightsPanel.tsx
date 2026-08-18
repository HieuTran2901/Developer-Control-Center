import { Icon } from '@/shared/components/ui/Icon';
import { RankedAccount } from '@/domain/services/QuotaOrchestrationService';

interface QuotaInsightsPanelProps {
  best5hAccount: RankedAccount | null;
  bestWeeklyAccount: RankedAccount | null;
  earliestResetAccount: RankedAccount | null;
  attentionCount: number;
}

export function QuotaInsightsPanel({
  best5hAccount,
  bestWeeklyAccount,
  earliestResetAccount,
  attentionCount,
}: QuotaInsightsPanelProps) {
  const formatCountdown = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return '—';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="p-3.5 rounded-xl bg-surface border border-border/70 shadow-xs space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="Activity" className="w-3.5 h-3.5 text-primary" />
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
          Quota Insights
        </h3>
      </div>

      <div className="space-y-2.5 text-xs font-sans">
        {/* Most 5H Remaining */}
        <div className="flex items-start gap-2 p-2 rounded-lg bg-success/5 border border-success/20">
          <div className="w-2 h-2 rounded-full bg-success mt-1 shrink-0" />
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-muted-foreground">Most 5H Remaining</div>
            <div className="font-bold text-foreground truncate">
              {best5hAccount && best5hAccount.fraction5h !== null
                ? `${best5hAccount.displayName} (${(best5hAccount.fraction5h * 100).toFixed(1)}%)`
                : 'No data'}
            </div>
          </div>
        </div>

        {/* Most Weekly Remaining */}
        <div className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
          <div className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-muted-foreground">Most Weekly Remaining</div>
            <div className="font-bold text-foreground truncate">
              {bestWeeklyAccount && bestWeeklyAccount.fractionWeekly !== null
                ? `${bestWeeklyAccount.displayName} (${(bestWeeklyAccount.fractionWeekly * 100).toFixed(1)}%)`
                : 'No data'}
            </div>
          </div>
        </div>

        {/* Earliest 5H Reset */}
        <div className="flex items-start gap-2 p-2 rounded-lg bg-purple-500/5 border border-purple-500/20">
          <div className="w-2 h-2 rounded-full bg-purple-400 mt-1 shrink-0" />
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-muted-foreground">Earliest 5H Reset</div>
            <div className="font-bold text-purple-300 truncate">
              {earliestResetAccount && earliestResetAccount.earliestResetSeconds !== null
                ? `${earliestResetAccount.displayName} (${formatCountdown(earliestResetAccount.earliestResetSeconds)})`
                : 'No data'}
            </div>
          </div>
        </div>

        {/* Accounts Need Attention */}
        <div className="flex items-start gap-2 p-2 rounded-lg bg-warning/5 border border-warning/20">
          <Icon name="AlertTriangle" className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-muted-foreground">Accounts Need Attention</div>
            <div className="font-bold text-warning">
              {attentionCount} {attentionCount === 1 ? 'account' : 'accounts'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
