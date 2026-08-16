import { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { QuotaRefreshSettings } from '@/domain/entities/QuotaPolling';

interface QuotaSummaryProps {
  totalAccounts: number;
  onlineCount: number;
  attentionCount: number;
  totalSharedGroups?: number;
  totalMonitoredModels?: number;
  isMonitoringRunning: boolean;
  lastGlobalRefreshAt: string | null;
  nextGlobalRefreshAt: string | null;
  autoRefreshEnabled: boolean;
  intervalSeconds: number;
  isRefreshingAll: boolean;
  onRefreshAll: () => void;
  onUpdateRefreshSettings: (settings: QuotaRefreshSettings) => Promise<void>;
}

export function QuotaSummary({
  totalAccounts,
  onlineCount,
  attentionCount,
  totalSharedGroups,
  totalMonitoredModels,
  isMonitoringRunning,
  lastGlobalRefreshAt,
  nextGlobalRefreshAt,
  autoRefreshEnabled,
  intervalSeconds,
  isRefreshingAll,
  onRefreshAll,
  onUpdateRefreshSettings,
}: QuotaSummaryProps) {
  const [countdownStr, setCountdownStr] = useState<string | null>(null);

  // Live Countdown calculation
  useEffect(() => {
    if (!autoRefreshEnabled || !isMonitoringRunning) {
      setCountdownStr(null);
      return;
    }

    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      let targetTs: number | null = null;

      if (nextGlobalRefreshAt) {
        const parsed = Number(nextGlobalRefreshAt);
        if (!isNaN(parsed) && parsed > 0) {
          targetTs = parsed;
        }
      }

      if (!targetTs && lastGlobalRefreshAt) {
        const last = Number(lastGlobalRefreshAt);
        if (!isNaN(last) && last > 0) {
          targetTs = last + intervalSeconds;
        }
      }

      if (!targetTs) {
        targetTs = now + intervalSeconds;
      }

      const diff = Math.max(0, targetTs - now);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setCountdownStr(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, isMonitoringRunning, nextGlobalRefreshAt, lastGlobalRefreshAt, intervalSeconds]);

  const handleToggleAutoRefresh = async () => {
    await onUpdateRefreshSettings({
      autoRefreshEnabled: !autoRefreshEnabled,
      intervalSeconds,
    });
  };

  const handleIntervalChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newInterval = Number(e.target.value);
    await onUpdateRefreshSettings({
      autoRefreshEnabled: true,
      intervalSeconds: newInterval,
    });
  };

  const relativeUpdateTime = lastGlobalRefreshAt ? formatRelativeTime(lastGlobalRefreshAt) : null;

  return (
    <div className="space-y-2">
      {/* Compact Top Overview Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-surface border border-border/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Total Accounts Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border/60 text-xs font-semibold text-foreground">
            <Icon name="Users" className="w-3.5 h-3.5 text-primary" />
            <span>
              {totalAccounts} {totalAccounts === 1 ? 'Account' : 'Accounts'}
            </span>
          </div>

          {/* Online Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/10 border border-success/30 text-xs font-semibold text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span>{onlineCount} Online</span>
          </div>

          {/* Aggregate Groups & Models Badge */}
          {totalMonitoredModels !== undefined && totalMonitoredModels > 0 && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/25 text-xs font-semibold text-primary">
              <Icon name="Layers" className="w-3.5 h-3.5" />
              <span>
                {totalSharedGroups ? `${totalSharedGroups} Quota Groups · ` : ''}
                {totalMonitoredModels} Models
              </span>
            </div>
          )}

          {/* Needs Attention Badge */}
          {attentionCount > 0 ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-warning/10 border border-warning/30 text-xs font-semibold text-warning">
              <Icon name="AlertTriangle" className="w-3.5 h-3.5" />
              <span>
                {attentionCount} {attentionCount === 1 ? 'Needs Attention' : 'Need Attention'}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/50 text-xs font-medium text-muted-foreground">
              <Icon name="CheckCircle2" className="w-3.5 h-3.5 text-success" />
              <span>All Connected</span>
            </div>
          )}
        </div>

        {/* Global Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={onRefreshAll}
            disabled={isRefreshingAll || totalAccounts === 0}
            variant="default"
            size="sm"
            className="h-7 px-3 text-xs font-medium shadow-xs gap-1.5"
          >
            <Icon
              name={isRefreshingAll ? 'Loader2' : 'RotateCw'}
              className={`w-3.5 h-3.5 ${isRefreshingAll ? 'animate-spin' : ''}`}
            />
            <span>{isRefreshingAll ? 'Refreshing All...' : 'Refresh All'}</span>
          </Button>
        </div>
      </div>

      {/* Compact Auto Refresh & Polling Engine Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-muted/20 border border-border/50 text-xs font-sans">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Status Dot */}
          <div className="flex items-center gap-1.5">
            {autoRefreshEnabled && isMonitoringRunning ? (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
            ) : (
              <span className="inline-flex rounded-full h-2 w-2 bg-muted-foreground/50"></span>
            )}
            <span className="font-semibold text-foreground text-[11px]">
              Auto Refresh: {autoRefreshEnabled ? 'ON' : 'OFF'}
            </span>
          </div>

          {/* Countdown Presentation */}
          {autoRefreshEnabled && countdownStr && (
            <span className="px-1.5 py-0.2 rounded bg-primary/10 border border-primary/20 text-primary font-mono font-medium text-[10px]">
              Next in {countdownStr}
            </span>
          )}

          {/* Last updated timestamp */}
          {relativeUpdateTime && (
            <span className="text-muted-foreground text-[10px] hidden md:inline">
              · Last updated {relativeUpdateTime}
            </span>
          )}
        </div>

        {/* User Configuration Controls */}
        <div className="flex items-center gap-1.5">
          <label className="text-muted-foreground text-[10px] font-medium hidden sm:inline">
            Interval:
          </label>
          <select
            value={intervalSeconds}
            onChange={handleIntervalChange}
            disabled={!autoRefreshEnabled}
            className="h-6 px-1.5 text-[11px] rounded bg-background border border-border text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            <option value="30">30s</option>
            <option value="60">1m</option>
            <option value="300">5m (Default)</option>
            <option value="600">10m</option>
            <option value="900">15m</option>
            <option value="1800">30m</option>
            <option value="3600">60m</option>
          </select>

          <Button
            onClick={handleToggleAutoRefresh}
            variant={autoRefreshEnabled ? 'outline' : 'default'}
            size="sm"
            className="h-6 px-2 text-[10px] font-medium"
          >
            {autoRefreshEnabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(timestampStr: string): string {
  const ts = Number(timestampStr);
  if (!ts || isNaN(ts)) return '';
  const diffSecs = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (diffSecs < 10) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h ago`;
}
