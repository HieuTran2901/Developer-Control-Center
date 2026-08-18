import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { quotaPollingService } from '@/application/services';
import {
  AccountMonitorConfig,
  AccountQuotaSnapshot,
  PollingEngineStatus,
  QuotaRefreshSettings,
} from '@/domain/entities/QuotaPolling';
import {
  QuotaOrchestrationService,
  AccountAlert,
} from '@/domain/services/QuotaOrchestrationService';
import { MultiAccountSummary } from './MultiAccountSummary';
import { RecommendedAccountPanel } from './RecommendedAccountPanel';
import { AccountStatusFilters, FilterStatus, SortOption } from './AccountStatusFilters';
import { AccountQuotaTable } from './AccountQuotaTable';
import { SmartAlertsPanel } from './SmartAlertsPanel';
import { QuickActionsPanel } from './QuickActionsPanel';
import { QuotaInsightsPanel } from './QuotaInsightsPanel';
import { AddAccountModal } from '@/features/settings/components/AddAccountModal';

interface MultiAccountQuotaDashboardProps {
  onSwitchToV1?: () => void;
}

export function MultiAccountQuotaDashboard({ onSwitchToV1 }: MultiAccountQuotaDashboardProps) {
  const [snapshots, setSnapshots] = useState<AccountQuotaSnapshot[]>([]);
  const [pollingStatus, setPollingStatus] = useState<PollingEngineStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [refreshingAccountId, setRefreshingAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const removedAccountIdsRef = useRef<Set<string>>(new Set());

  // Filters & Sorting state
  const [currentFilter, setCurrentFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentSort, setCurrentSort] = useState<SortOption>('recommended');

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [allSnapshots, status] = await Promise.all([
        quotaPollingService.getAllStates(),
        quotaPollingService.getPollingStatus(),
      ]);
      setSnapshots(allSnapshots);
      setPollingStatus(status);

      if (allSnapshots.length === 0) {
        const initialSnapshots = await quotaPollingService.refreshAll();
        setSnapshots(initialSnapshots);
        const updatedStatus = await quotaPollingService.getPollingStatus();
        setPollingStatus(updatedStatus);
      }
    } catch (e: any) {
      console.error('Failed to load quota data:', e);
      setError(e?.message || 'Failed to load accounts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const unsubUpdated = quotaPollingService.onAccountUpdated((updatedSnapshot) => {
      console.log(`[UI] UI ACCOUNT EVENT: account_id=${updatedSnapshot.accountId}, incoming_status=${updatedSnapshot.status}, error_msg=${updatedSnapshot.errorMessage || 'none'}`);
      if (removedAccountIdsRef.current.has(updatedSnapshot.accountId)) {
        return;
      }
      setSnapshots((prev) => {
        const index = prev.findIndex((s) => s.accountId === updatedSnapshot.accountId);
        if (index >= 0) {
          const next = [...prev];
          next[index] = updatedSnapshot;
          console.log(`[UI] UI STATE UPDATE: account_id=${updatedSnapshot.accountId}, updated_index=${index}, total_count=${next.length}, final_status=${updatedSnapshot.status}`);
          return next;
        } else {
          const next = [...prev, updatedSnapshot];
          console.log(`[UI] UI STATE UPDATE: account_id=${updatedSnapshot.accountId}, inserted_new=true, total_count=${next.length}, final_status=${updatedSnapshot.status}`);
          return next;
        }
      });
    });

    const unsubStatus = quotaPollingService.onEngineStatusChanged(async () => {
      try {
        const status = await quotaPollingService.getPollingStatus();
        setPollingStatus(status);
      } catch (err) {
        console.error('Failed to update engine status:', err);
      }
    });

    return () => {
      unsubUpdated.then((unsub) => unsub());
      unsubStatus.then((unsub) => unsub());
    };
  }, [loadData]);

  // Actions
  const handleRefreshAll = async () => {
    try {
      setIsRefreshingAll(true);
      const refreshed = await quotaPollingService.refreshAll();
      setSnapshots(refreshed);
      const status = await quotaPollingService.getPollingStatus();
      setPollingStatus(status);
    } catch (e: any) {
      setError(e?.message || 'Failed to refresh all accounts');
    } finally {
      setIsRefreshingAll(false);
    }
  };

  const handleRefreshAccount = async (accountId: string) => {
    try {
      setRefreshingAccountId(accountId);
      const updated = await quotaPollingService.refreshAccount(accountId);
      setSnapshots((prev) => prev.map((s) => (s.accountId === accountId ? updated : s)));
    } catch (e: any) {
      setError(e?.message || `Failed to refresh account ${accountId}`);
    } finally {
      setRefreshingAccountId(null);
    }
  };

  const handleReconnectAccount = async (accountId: string) => {
    try {
      setRefreshingAccountId(accountId);
      const res = await quotaPollingService.connectGoogleAccount(accountId, true);
      if (res.success) {
        await handleRefreshAccount(accountId);
      } else {
        setError(res.message || 'Google OAuth reconnection failed');
      }
    } catch (e: any) {
      setError(e?.message || `Failed to reconnect account ${accountId}`);
    } finally {
      setRefreshingAccountId(null);
    }
  };

  const handleDisconnectAccount = async (accountId: string) => {
    try {
      setRefreshingAccountId(accountId);
      await quotaPollingService.disconnectGoogleAccount(accountId);
      await handleRefreshAccount(accountId);
    } catch (e: any) {
      setError(e?.message || `Failed to disconnect account ${accountId}`);
    } finally {
      setRefreshingAccountId(null);
    }
  };

  const handleToggleEnabled = async (accountId: string, enabled: boolean) => {
    try {
      await quotaPollingService.setAccountEnabled(accountId, enabled);
      setSnapshots((prev) =>
        prev.map((s) => (s.accountId === accountId ? { ...s, status: enabled ? 'Unknown' : 'Disabled' } : s))
      );
      if (enabled) {
        handleRefreshAccount(accountId);
      }
    } catch (e: any) {
      setError(e?.message || `Failed to update account enabled state`);
    }
  };

  const handleRenameAccount = async (accountId: string, displayName: string | null) => {
    try {
      await quotaPollingService.renameAccount(accountId, displayName);
      setSnapshots((prev) =>
        prev.map((s) => (s.accountId === accountId ? { ...s, displayName } : s))
      );
    } catch (e: any) {
      setError(e?.message || `Failed to rename account`);
    }
  };

  const handleRemoveAccount = async (accountId: string) => {
    if (!window.confirm('Are you sure you want to remove this account from AI Quota monitoring?')) {
      return;
    }
    try {
      removedAccountIdsRef.current.add(accountId);
      await quotaPollingService.removeAccount(accountId);
      setSnapshots((prev) => prev.filter((s) => s.accountId !== accountId));
    } catch (e: any) {
      removedAccountIdsRef.current.delete(accountId);
      setError(e?.message || `Failed to remove account`);
    }
  };

  const handleAddAccount = async (config: AccountMonitorConfig) => {
    try {
      removedAccountIdsRef.current.delete(config.accountId);
      await quotaPollingService.registerAccount(config);
      setIsAddModalOpen(false);
      const updatedStates = await quotaPollingService.getAllStates();
      setSnapshots(updatedStates);
      handleRefreshAccount(config.accountId);
    } catch (e: any) {
      setError(e?.message || 'Failed to add account');
    }
  };

  const handleAccountAdded = async (newAccountId?: string) => {
    try {
      if (newAccountId) {
        removedAccountIdsRef.current.delete(newAccountId);
      }
      const [updatedStates, status] = await Promise.all([
        quotaPollingService.getAllStates(),
        quotaPollingService.getPollingStatus(),
      ]);
      setSnapshots(updatedStates);
      setPollingStatus(status);
      if (newAccountId) {
        handleRefreshAccount(newAccountId);
      }
    } catch (e: any) {
      console.error('Failed to reload accounts after adding:', e);
    }
  };

  const handleUpdateRefreshSettings = async (settings: QuotaRefreshSettings) => {
    try {
      await quotaPollingService.updateRefreshSettings(settings);
      const status = await quotaPollingService.getPollingStatus();
      setPollingStatus(status);
    } catch (e: any) {
      setError(e?.message || 'Failed to update auto refresh settings');
    }
  };

  // Orchestration & Ranking derivations
  const rankedAccounts = useMemo(() => {
    return QuotaOrchestrationService.rankAccounts(snapshots);
  }, [snapshots]);

  const recommendedAccount = useMemo(() => {
    return rankedAccounts.find((r) => r.isEligible && r.score > 0) || null;
  }, [rankedAccounts]);

  const allAlerts = useMemo(() => {
    const list: { alert: AccountAlert; accountName: string }[] = [];
    for (const s of snapshots) {
      const alerts = QuotaOrchestrationService.getAccountAlerts(s);
      for (const a of alerts) {
        list.push({ alert: a, accountName: s.displayName || s.email });
      }
    }
    return list;
  }, [snapshots]);

  // Derived Summary Counts & Insights
  const totalAccounts = snapshots.length;
  const onlineCount = snapshots.filter((s) => s.status === 'Online').length;
  const attentionCount = snapshots.filter(
    (s) =>
      s.status === 'AuthRequired' ||
      s.status === 'ReauthorizationRequired' ||
      s.status === 'NetworkError' ||
      s.status === 'ProviderError' ||
      s.status === 'RateLimited' ||
      s.errorMessage?.includes('Account mismatch')
  ).length;
  const staleCount = snapshots.filter((s) => s.dataQuality === 'Stale').length;

  const best5hAccount = useMemo(() => {
    const eligible = rankedAccounts.filter((r) => r.isEligible && r.fraction5h !== null);
    if (eligible.length === 0) return null;
    return eligible.reduce((prev, curr) =>
      (curr.fraction5h ?? 0) > (prev.fraction5h ?? 0) ? curr : prev
    );
  }, [rankedAccounts]);

  const bestWeeklyAccount = useMemo(() => {
    const eligible = rankedAccounts.filter((r) => r.isEligible && r.fractionWeekly !== null);
    if (eligible.length === 0) return null;
    return eligible.reduce((prev, curr) =>
      (curr.fractionWeekly ?? 0) > (prev.fractionWeekly ?? 0) ? curr : prev
    );
  }, [rankedAccounts]);

  const earliestResetAccount = useMemo(() => {
    const withReset = rankedAccounts.filter(
      (r) => r.isEligible && r.earliestResetSeconds !== null && r.earliestResetSeconds > 0
    );
    if (withReset.length === 0) return null;
    return withReset.reduce((prev, curr) =>
      (curr.earliestResetSeconds ?? Infinity) < (prev.earliestResetSeconds ?? Infinity) ? curr : prev
    );
  }, [rankedAccounts]);

  // Filter & Search & Sort Logic
  const filterCounts = useMemo(() => {
    return {
      all: snapshots.length,
      healthy: rankedAccounts.filter((r) => r.health.overallHealth === 'Healthy').length,
      pending: snapshots.filter((s) => s.status === 'Online' && s.quota === null).length,
      warning: rankedAccounts.filter((r) => r.health.health5h === 'Warning' || r.health.healthWeekly === 'Warning').length,
      critical: rankedAccounts.filter((r) => r.health.overallHealth === 'Critical').length,
      auth_required: snapshots.filter((s) => s.status === 'AuthRequired' || s.status === 'ReauthorizationRequired').length,
      stale: snapshots.filter((s) => s.dataQuality === 'Stale').length,
    };
  }, [snapshots, rankedAccounts]);

  const filteredAndSortedSnapshots = useMemo(() => {
    let result = [...snapshots];

    // Filter
    if (currentFilter !== 'all') {
      result = result.filter((s) => {
        const rank = rankedAccounts.find((r) => r.accountId === s.accountId);
        if (currentFilter === 'healthy') return rank?.health.overallHealth === 'Healthy';
        if (currentFilter === 'pending') return s.status === 'Online' && s.quota === null;
        if (currentFilter === 'warning') return rank?.health.health5h === 'Warning' || rank?.health.healthWeekly === 'Warning';
        if (currentFilter === 'critical') return rank?.health.overallHealth === 'Critical';
        if (currentFilter === 'auth_required') return s.status === 'AuthRequired' || s.status === 'ReauthorizationRequired';
        if (currentFilter === 'stale') return s.dataQuality === 'Stale';
        return true;
      });
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((s) =>
        (s.displayName || '').toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.accountId.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      const rankA = rankedAccounts.find((r) => r.accountId === a.accountId);
      const rankB = rankedAccounts.find((r) => r.accountId === b.accountId);

      if (currentSort === 'recommended') {
        return (rankA?.rank ?? 999) - (rankB?.rank ?? 999);
      }
      if (currentSort === 'quota_5h') {
        return (rankB?.fraction5h ?? -1) - (rankA?.fraction5h ?? -1);
      }
      if (currentSort === 'quota_weekly') {
        return (rankB?.fractionWeekly ?? -1) - (rankA?.fractionWeekly ?? -1);
      }
      if (currentSort === 'reset') {
        return (rankA?.earliestResetSeconds ?? Infinity) - (rankB?.earliestResetSeconds ?? Infinity);
      }
      if (currentSort === 'updated') {
        return Number(b.lastSuccessfulSyncAt || 0) - Number(a.lastSuccessfulSyncAt || 0);
      }
      if (currentSort === 'name') {
        return (a.displayName || a.email).localeCompare(b.displayName || b.email);
      }
      return 0;
    });

    return result;
  }, [snapshots, rankedAccounts, currentFilter, searchQuery, currentSort]);

  // Live Auto-Refresh Countdown calculation
  const [countdownStr, setCountdownStr] = useState<string | null>(null);
  useEffect(() => {
    if (!pollingStatus?.autoRefreshEnabled || !pollingStatus?.isRunning) {
      setCountdownStr(null);
      return;
    }
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      let targetTs = pollingStatus.nextGlobalRefreshAt ? Number(pollingStatus.nextGlobalRefreshAt) : null;
      if (!targetTs && pollingStatus.lastGlobalRefreshAt) {
        targetTs = Number(pollingStatus.lastGlobalRefreshAt) + pollingStatus.intervalSeconds;
      }
      if (!targetTs) targetTs = now + pollingStatus.intervalSeconds;
      const diff = Math.max(0, targetTs - now);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setCountdownStr(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [pollingStatus]);

  return (
    <div className="space-y-4 font-sans text-foreground">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl bg-surface border border-border/70 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-bold text-foreground tracking-tight">AI Quota</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/30 uppercase tracking-wider">
              V2 Orchestration
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Intelligent Multi-Account Quota Orchestration & Live Monitoring
          </p>
        </div>

        {/* Right Header Status & Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Auto Refresh Status Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
            <span className="flex h-2 w-2 relative">
              {pollingStatus?.autoRefreshEnabled && pollingStatus?.isRunning && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${pollingStatus?.autoRefreshEnabled ? 'bg-success' : 'bg-muted-foreground'}`}></span>
            </span>
            <span className="font-semibold text-[11px]">
              Auto Refresh: {pollingStatus?.autoRefreshEnabled ? 'ON' : 'OFF'}
            </span>
            {countdownStr && (
              <span className="text-[11px] text-muted-foreground font-mono pl-1 border-l border-border/60">
                Next in {countdownStr}
              </span>
            )}
          </div>

          {/* Refresh Interval Selector */}
          <div className="flex items-center gap-1.5 text-xs bg-muted/40 border border-border/60 rounded-lg px-2.5 py-1">
            <span className="text-muted-foreground text-[11px] whitespace-nowrap">Refresh Interval</span>
            <select
              value={pollingStatus?.intervalSeconds ?? 300}
              onChange={(e) =>
                handleUpdateRefreshSettings({
                  autoRefreshEnabled: pollingStatus?.autoRefreshEnabled ?? true,
                  intervalSeconds: Number(e.target.value),
                })
              }
              className="bg-transparent text-foreground text-xs font-semibold focus:outline-none cursor-pointer pr-1"
            >
              <option value="60" className="bg-surface text-foreground">1 minute</option>
              <option value="180" className="bg-surface text-foreground">3 minutes</option>
              <option value="300" className="bg-surface text-foreground">5 minutes</option>
              <option value="600" className="bg-surface text-foreground">10 minutes</option>
              <option value="1800" className="bg-surface text-foreground">30 minutes</option>
            </select>
          </div>

          {/* Refresh All Action */}
          <Button
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshingAll || totalAccounts === 0}
            className="h-8 px-3.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5"
          >
            <Icon
              name={isRefreshingAll ? 'Loader2' : 'RotateCw'}
              className={`w-3.5 h-3.5 ${isRefreshingAll ? 'animate-spin' : ''}`}
            />
            <span>{isRefreshingAll ? 'Refreshing...' : 'Refresh All'}</span>
          </Button>

          {/* Switch to Classic V1 Toggle Button */}
          {onSwitchToV1 && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSwitchToV1}
              className="h-8 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground border-border/70 gap-1"
              title="Switch to Classic V1 Card Grid layout"
            >
              <Icon name="LayoutGrid" className="w-3.5 h-3.5" />
              <span>Classic V1</span>
            </Button>
          )}
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive text-xs space-y-2 font-sans">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-2">
              <Icon name="AlertTriangle" className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-tight">{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-destructive/80 hover:text-destructive text-xs font-semibold px-2 py-0.5 shrink-0"
            >
              Dismiss
            </button>
          </div>
          {error.includes('myaccount.google.com') && (
            <div className="pt-2 border-t border-destructive/20 text-[11px] text-foreground font-sans space-y-1">
              <p className="font-semibold text-destructive">How to resolve:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
                <li>Open <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer" className="underline text-primary font-medium">Google Account Third-Party Connections</a>.</li>
                <li>Find <strong>Developer Control Center</strong> and click <strong>Delete all connections</strong>.</li>
                <li>Click <strong>Reconnect</strong> on the account to grant fresh offline consent.</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Summary Metrics Row */}
      <MultiAccountSummary
        totalAccounts={totalAccounts}
        onlineCount={onlineCount}
        attentionCount={attentionCount}
        staleCount={staleCount}
        best5hAccount={best5hAccount}
        bestWeeklyAccount={bestWeeklyAccount}
        earliestResetAccount={earliestResetAccount}
      />

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left/Center Column: Main Table & Recommended Card (9 cols) */}
        <div className="lg:col-span-9 space-y-3.5">
          {/* Recommended Account Hero Panel */}
          {recommendedAccount && (
            <RecommendedAccountPanel
              recommendedAccount={recommendedAccount}
              snapshots={snapshots}
              onRefreshAccount={handleRefreshAccount}
              isRefreshing={refreshingAccountId === recommendedAccount.accountId}
            />
          )}

          {/* Filter, Search & Sort Bar */}
          <AccountStatusFilters
            currentFilter={currentFilter}
            onFilterChange={setCurrentFilter}
            filterCounts={filterCounts}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            currentSort={currentSort}
            onSortChange={setCurrentSort}
          />

          {/* Account Quota Table */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-2.5 rounded-xl border border-border/70 bg-surface/50">
              <Icon name="Loader2" className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground font-sans">Loading account quotas...</p>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-16 px-4 border border-dashed rounded-xl bg-surface/50 space-y-3">
              <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                <Icon name="Users" className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-foreground">No accounts registered</h3>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  Add a Google account or Antigravity account to monitor live quota.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setIsAddModalOpen(true)}
                className="h-7 text-xs px-3 bg-primary text-primary-foreground gap-1.5 font-medium"
              >
                <Icon name="Plus" className="w-3.5 h-3.5" />
                <span>Add Your First Account</span>
              </Button>
            </div>
          ) : filteredAndSortedSnapshots.length === 0 ? (
            <div className="text-center py-12 px-4 border border-border/60 rounded-xl bg-surface/40 space-y-2">
              <p className="text-xs text-muted-foreground font-semibold">No accounts match the selected filter or search.</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCurrentFilter('all');
                  setSearchQuery('');
                }}
                className="h-6 text-xs text-primary hover:underline"
              >
                Reset filters
              </Button>
            </div>
          ) : (
            <AccountQuotaTable
              snapshots={filteredAndSortedSnapshots}
              rankedAccounts={rankedAccounts}
              onRefreshAccount={handleRefreshAccount}
              onReconnectAccount={handleReconnectAccount}
              onDisconnectAccount={handleDisconnectAccount}
              onToggleEnabled={handleToggleEnabled}
              onRenameAccount={handleRenameAccount}
              onRemoveAccount={handleRemoveAccount}
              refreshingAccountId={refreshingAccountId}
            />
          )}
        </div>

        {/* Right Column: Smart Alerts, Quick Actions & Insights (3 cols) */}
        <div className="lg:col-span-3 space-y-3.5">
          {/* Smart Alerts Panel */}
          <SmartAlertsPanel
            alerts={allAlerts}
            onReconnectAccount={handleReconnectAccount}
          />

          {/* Quick Actions Panel */}
          <QuickActionsPanel
            onAddAccount={() => setIsAddModalOpen(true)}
            onRefreshAll={handleRefreshAll}
            onReconnectAccounts={() => {
              const needsAuth = snapshots.find(
                (s) => s.status === 'AuthRequired' || s.status === 'ReauthorizationRequired'
              );
              if (needsAuth) {
                handleReconnectAccount(needsAuth.accountId);
              }
            }}
            actionRequiredCount={attentionCount}
            isRefreshingAll={isRefreshingAll}
          />

          {/* Quota Insights Panel */}
          <QuotaInsightsPanel
            best5hAccount={best5hAccount}
            bestWeeklyAccount={bestWeeklyAccount}
            earliestResetAccount={earliestResetAccount}
            attentionCount={attentionCount}
          />
        </div>
      </div>

      {/* Footer Banner */}
      <div className="pt-2 text-center text-[11px] text-muted-foreground/80 font-sans select-none border-t border-border/40">
        All times shown are in your local timezone · Data is never fabricated · Each account is isolated and secure
      </div>

      {/* Add Account Modal */}
      {isAddModalOpen && (
        <AddAccountModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAddAccount={handleAddAccount}
          onAccountAdded={handleAccountAdded}
        />
      )}
    </div>
  );
}
