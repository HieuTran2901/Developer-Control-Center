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

  return (
    <div className="space-y-3">
      {/* Top Overview Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-surface border border-border/70 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Total Accounts Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/70 text-xs font-semibold text-foreground">
            <Icon name="Users" className="w-3.5 h-3.5 text-primary" />
            <span>
              {totalAccounts} {totalAccounts === 1 ? 'Account' : 'Accounts'}
            </span>
          </div>

          {/* Online Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 border border-success/30 text-xs font-semibold text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span>{onlineCount} Online</span>
          </div>

          {/* Quota Groups Badge */}
          {totalSharedGroups !== undefined && totalSharedGroups > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-xs font-semibold text-primary">
              <Icon name="Layers" className="w-3.5 h-3.5" />
              <span>{totalSharedGroups} Quota Groups</span>
            </div>
          )}

          {/* Models Badge */}
          {totalMonitoredModels !== undefined && totalMonitoredModels > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-xs font-semibold text-primary">
              <Icon name="Cpu" className="w-3.5 h-3.5" />
              <span>{totalMonitoredModels} Models</span>
            </div>
          )}

          {/* Needs Attention Badge */}
          {attentionCount > 0 ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warning/10 border border-warning/30 text-xs font-semibold text-warning">
              <Icon name="AlertTriangle" className="w-3.5 h-3.5" />
              <span>
                {attentionCount} {attentionCount === 1 ? 'Need Attention' : 'Need Attention'}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/40 border border-border/50 text-xs font-medium text-muted-foreground">
              <Icon name="CheckCircle2" className="w-3.5 h-3.5 text-success" />
              <span>All Connected</span>
            </div>
          )}
        </div>

        {/* Global Refresh All Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={onRefreshAll}
            disabled={isRefreshingAll || totalAccounts === 0}
            variant="default"
            size="sm"
            className="h-8 px-3.5 text-xs font-medium shadow-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Icon
              name={isRefreshingAll ? 'Loader2' : 'RotateCw'}
              className={`w-3.5 h-3.5 ${isRefreshingAll ? 'animate-spin' : ''}`}
            />
            <span>{isRefreshingAll ? 'Refreshing All...' : 'Refresh All'}</span>
          </Button>
        </div>
      </div>

      {/* Auto Refresh & Polling Engine Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl bg-muted/20 border border-border/60 text-xs font-sans">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status Dot */}
          <div className="flex items-center gap-2">
            {autoRefreshEnabled && isMonitoringRunning ? (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
              </span>
            ) : (
              <span className="inline-flex rounded-full h-2.5 w-2.5 bg-muted-foreground/50"></span>
            )}
            <span className="font-semibold text-foreground text-xs">
              Auto Refresh: {autoRefreshEnabled ? 'ON' : 'OFF'}
            </span>
          </div>

          {/* Countdown Presentation */}
          {autoRefreshEnabled && countdownStr && (
            <span className="text-muted-foreground text-xs font-sans">
              Next refresh in <span className="font-mono text-foreground font-medium">{countdownStr}</span>
            </span>
          )}
        </div>

        {/* User Configuration Controls */}
        <div className="flex items-center gap-2">
          <label className="text-muted-foreground text-xs font-medium hidden sm:inline">
            Interval:
          </label>
          <select
            value={intervalSeconds}
            onChange={handleIntervalChange}
            disabled={!autoRefreshEnabled}
            className="h-7 px-2 text-xs rounded-md bg-background border border-border text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            <option value="30">30 seconds</option>
            <option value="60">1 minute</option>
            <option value="300">5 minutes (Recommended)</option>
            <option value="600">10 minutes</option>
            <option value="900">15 minutes</option>
            <option value="1800">30 minutes</option>
            <option value="3600">60 minutes</option>
          </select>

          <Button
            onClick={handleToggleAutoRefresh}
            variant={autoRefreshEnabled ? 'outline' : 'default'}
            size="sm"
            className="h-7 px-3 text-xs font-medium"
          >
            {autoRefreshEnabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </div>
    </div>
  );
}
