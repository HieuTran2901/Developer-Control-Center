import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { AccountQuotaSnapshot } from '@/domain/entities/QuotaPolling';
import { RankedAccount, QuotaOrchestrationService } from '@/domain/services/QuotaOrchestrationService';

interface RecommendedAccountPanelProps {
  recommendedAccount: RankedAccount | null;
  snapshots: AccountQuotaSnapshot[];
  onUseAccount?: (accountId: string) => void;
  onRefreshAccount?: (accountId: string) => void;
  isRefreshing?: boolean;
}

export function RecommendedAccountPanel({
  recommendedAccount,
  snapshots,
  onUseAccount,
  onRefreshAccount,
  isRefreshing = false,
}: RecommendedAccountPanelProps) {
  if (!recommendedAccount) {
    return null;
  }

  const matchingSnapshot = snapshots.find((s) => s.accountId === recommendedAccount.accountId);
  const models = matchingSnapshot?.quota?.models || [];
  const modelCount5h = models.length;
  const modelCountWeekly = models.filter((m) => m.weeklyRemainingFraction !== null && m.weeklyRemainingFraction !== undefined).length;

  const pct5h = recommendedAccount.fraction5h !== null ? Math.round(recommendedAccount.fraction5h * 100) : null;
  const pctWeekly = recommendedAccount.fractionWeekly !== null ? Math.round(recommendedAccount.fractionWeekly * 100) : null;

  const reset5hCountdown = QuotaOrchestrationService.getResetCountdown(
    models[0]?.resetAt
  ).formattedCountdown;
  const resetWeeklyCountdown = QuotaOrchestrationService.getResetCountdown(
    models[0]?.weeklyResetAt
  ).formattedCountdown;

  const getInitials = (name: string) => {
    if (!name) return 'A';
    const match = name.match(/account\s*(\d+)/i);
    if (match) return `A${match[1]}`;
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="p-4 rounded-xl bg-gradient-to-r from-surface via-surface to-primary/5 border border-primary/30 shadow-sm relative overflow-hidden space-y-3">
      {/* Top Banner Tag */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-primary tracking-wider uppercase flex items-center gap-1.5">
            <Icon name="Sparkles" className="w-3.5 h-3.5 text-primary" />
            Recommended Account
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/15 text-success border border-success/30 uppercase tracking-wider">
            Best Choice
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground font-mono">
          Confidence: <span className="text-foreground font-semibold">92%</span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Left: Account Identity */}
        <div className="md:col-span-4 flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-success/20 border-2 border-success/40 flex items-center justify-center text-success font-bold text-base shrink-0 font-mono shadow-xs">
            {getInitials(recommendedAccount.displayName)}
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm text-foreground truncate" title={recommendedAccount.displayName}>
                {recommendedAccount.displayName}
              </h3>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-success/15 text-success flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Connected
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate font-mono" title={recommendedAccount.email}>
              {recommendedAccount.email}
            </p>
            <p className="text-[11px] text-muted-foreground/90 line-clamp-2 leading-relaxed">
              Best available quota based on current usage and reset windows
            </p>
          </div>
        </div>

        {/* Middle: 5H & Weekly Quota Bars */}
        <div className="md:col-span-5 grid grid-cols-2 gap-3 p-3 rounded-xl bg-background/50 border border-border/60">
          {/* 5H Quota */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground text-[11px]">5H Quota</span>
              <span className="font-bold text-success font-mono">{pct5h !== null ? `${pct5h}%` : '—'}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full bg-success transition-all duration-300 rounded-full"
                style={{ width: `${pct5h ?? 0}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center justify-between">
              <span>{modelCount5h} models</span>
              <span>Resets in {reset5hCountdown}</span>
            </div>
          </div>

          {/* Weekly Quota */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground text-[11px]">Weekly Quota</span>
              <span className="font-bold text-primary font-mono">{pctWeekly !== null ? `${pctWeekly}%` : '—'}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${pctWeekly ?? 0}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center justify-between">
              <span>{modelCountWeekly > 0 ? `${modelCountWeekly} models` : 'Weekly pool'}</span>
              <span>Resets in {resetWeeklyCountdown}</span>
            </div>
          </div>
        </div>

        {/* Right: Why Recommended Checklist & Action */}
        <div className="md:col-span-3 flex flex-col justify-between h-full space-y-2.5">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">Why recommended?</span>
            <ul className="text-[11px] text-foreground space-y-0.5 font-sans">
              <li className="flex items-center gap-1.5 text-success">
                <Icon name="Check" className="w-3 h-3 shrink-0" />
                <span>Highest 5H quota</span>
              </li>
              <li className="flex items-center gap-1.5 text-success">
                <Icon name="Check" className="w-3 h-3 shrink-0" />
                <span>Weekly quota is healthy</span>
              </li>
              <li className="flex items-center gap-1.5 text-success">
                <Icon name="Check" className="w-3 h-3 shrink-0" />
                <span>Reset in {reset5hCountdown}</span>
              </li>
            </ul>
          </div>

          <Button
            size="sm"
            onClick={() => onUseAccount ? onUseAccount(recommendedAccount.accountId) : onRefreshAccount && onRefreshAccount(recommendedAccount.accountId)}
            disabled={isRefreshing}
            className="w-full h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5"
          >
            <Icon name={isRefreshing ? 'Loader2' : 'CheckCircle2'} className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Use This Account</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
