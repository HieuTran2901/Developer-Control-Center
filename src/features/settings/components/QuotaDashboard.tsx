import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { quotaPollingService, quotaProviderService } from '@/application/services';
import {
  AccountMonitorConfig,
  AccountQuotaSnapshot,
  PollingEngineStatus,
  QuotaRefreshSettings,
} from '@/domain/entities/QuotaPolling';
import { QuotaVerificationDiagnostic } from '@/domain/entities/QuotaProvider';
import { QuotaSummary } from './QuotaSummary';
import { QuotaAccountCard, groupModelsIntoQuotaPools } from './QuotaAccountCard';
import { AddAccountModal } from './AddAccountModal';


export function QuotaDashboard() {
  const [snapshots, setSnapshots] = useState<AccountQuotaSnapshot[]>([]);
  const [pollingStatus, setPollingStatus] = useState<PollingEngineStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [refreshingAccountId, setRefreshingAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<QuotaVerificationDiagnostic | null>(null);

  // Load initial data
  const loadDashboardData = useCallback(async () => {
    try {
      setError(null);
      const [states, status] = await Promise.all([
        quotaPollingService.getAllStates(),
        quotaPollingService.getPollingStatus(),
      ]);

      setSnapshots(states);
      setPollingStatus(status);

      // If snapshots empty, query registry list and refresh
      if (states.length === 0) {
        const initialSnapshots = await quotaPollingService.refreshAll();
        setSnapshots(initialSnapshots);
        const updatedStatus = await quotaPollingService.getPollingStatus();
        setPollingStatus(updatedStatus);
      }
    } catch (e: any) {
      console.error('Failed to load quota dashboard data:', e);
      setError(e?.message || String(e) || 'Failed to retrieve account quota snapshots.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set up real-time Tauri event listener
  useEffect(() => {
    loadDashboardData();

    const unsubscribeAccountUpdated = quotaPollingService.onAccountUpdated((updatedSnap) => {
      setSnapshots((prev) => {
        const index = prev.findIndex((s) => s.accountId === updatedSnap.accountId);
        if (index >= 0) {
          const next = [...prev];
          next[index] = updatedSnap;
          return next;
        } else {
          return [...prev, updatedSnap];
        }
      });
    });

    const unsubscribeEngineStatus = quotaPollingService.onEngineStatusChanged(async () => {
      try {
        const status = await quotaPollingService.getPollingStatus();
        setPollingStatus(status);
      } catch (err) {
        console.error('Failed to update engine status:', err);
      }
    });

    return () => {
      unsubscribeAccountUpdated.then((unsub) => unsub());
      unsubscribeEngineStatus.then((unsub) => unsub());
    };
  }, [loadDashboardData]);

  // Actions
  const handleUpdateRefreshSettings = async (newSettings: QuotaRefreshSettings) => {
    try {
      await quotaPollingService.updateRefreshSettings(newSettings);
      const updatedStatus = await quotaPollingService.getPollingStatus();
      setPollingStatus(updatedStatus);
    } catch (e: any) {
      console.error('Failed to update refresh settings:', e);
      setError(e?.message || String(e) || 'Failed to update auto refresh settings.');
    }
  };

  const handleRefreshAll = async () => {
    setIsRefreshingAll(true);
    setError(null);
    try {
      const refreshed = await quotaPollingService.refreshAll();
      setSnapshots(refreshed);
      const status = await quotaPollingService.getPollingStatus();
      setPollingStatus(status);
    } catch (e: any) {
      console.error('Failed to refresh all accounts:', e);
      setError(e?.message || String(e) || 'Failed to refresh quota for all accounts.');
    } finally {
      setIsRefreshingAll(false);
    }
  };

  const handleRefreshAccount = async (accountId: string) => {
    setRefreshingAccountId(accountId);
    setError(null);
    try {
      const updated = await quotaPollingService.refreshAccount(accountId);
      setSnapshots((prev) => {
        const index = prev.findIndex((s) => s.accountId === updated.accountId);
        if (index >= 0) {
          const next = [...prev];
          next[index] = updated;
          return next;
        } else {
          return [...prev, updated];
        }
      });
    } catch (e: any) {
      console.error(`Failed to refresh account ${accountId}:`, e);
      setError(e?.message || String(e) || `Failed to refresh quota for ${accountId}.`);
    } finally {
      setRefreshingAccountId(null);
    }
  };

  const handleToggleMonitoring = async () => {
    if (!pollingStatus) return;
    try {
      if (pollingStatus.isRunning) {
        await quotaPollingService.stopMonitoring();
      } else {
        await quotaPollingService.startMonitoring();
      }
      const updated = await quotaPollingService.getPollingStatus();
      setPollingStatus(updated);
    } catch (e: any) {
      console.error('Failed to toggle monitoring:', e);
      setError(e?.message || String(e) || 'Failed to toggle quota monitoring.');
    }
  };

  const handleAddAccount = async (config: AccountMonitorConfig) => {
    try {
      await quotaPollingService.registerAccount(config);
      setIsAddModalOpen(false);
      // Immediately reload all account states from backend
      const updatedStates = await quotaPollingService.getAllStates();
      setSnapshots(updatedStates);
      const status = await quotaPollingService.getPollingStatus();
      setPollingStatus(status);
      // Trigger refresh on the newly registered account
      handleRefreshAccount(config.accountId);
    } catch (e: any) {
      console.error('Failed to register account:', e);
      setError(e?.message || String(e) || 'Failed to add account.');
    }
  };

  const handleToggleEnabled = async (accountId: string, enabled: boolean) => {
    try {
      await quotaPollingService.setAccountEnabled(accountId, enabled);
      setSnapshots((prev) =>
        prev.map((s) =>
          s.accountId === accountId
            ? { ...s, status: enabled ? 'Unknown' : 'Disabled' }
            : s
        )
      );
      if (enabled) {
        handleRefreshAccount(accountId);
      }
      const status = await quotaPollingService.getPollingStatus();
      setPollingStatus(status);
    } catch (e: any) {
      console.error(`Failed to toggle account ${accountId}:`, e);
      setError(e?.message || String(e));
    }
  };

  const handleRenameAccount = async (accountId: string, newDisplayName: string | null) => {
    try {
      await quotaPollingService.renameAccount(accountId, newDisplayName);
      setSnapshots((prev) =>
        prev.map((s) =>
          s.accountId === accountId ? { ...s, displayName: newDisplayName } : s
        )
      );
    } catch (e: any) {
      console.error(`Failed to rename account ${accountId}:`, e);
      setError(e?.message || String(e));
    }
  };

  const handleToggleAutoConnect = async (accountId: string, autoConnect: boolean) => {
    try {
      await quotaPollingService.setAccountAutoConnect(accountId, autoConnect);
      setSnapshots((prev) =>
        prev.map((s) => (s.accountId === accountId ? { ...s, autoConnect } : s))
      );
    } catch (e: any) {
      console.error(`Failed to update auto-connect for account ${accountId}:`, e);
      setError(e?.message || String(e));
    }
  };

  const handleRemoveAccount = async (accountId: string) => {

    try {
      await quotaPollingService.removeAccount(accountId);
      setSnapshots((prev) => prev.filter((s) => s.accountId !== accountId));
      const status = await quotaPollingService.getPollingStatus();
      setPollingStatus(status);
    } catch (e: any) {
      console.error(`Failed to remove account ${accountId}:`, e);
      setError(e?.message || String(e));
    }
  };

  const handleVerifyProviderPath = async (accountId?: string) => {
    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const targetId = accountId || snapshots[0]?.accountId || 'primary';
      const result = await quotaProviderService.verifyQuotaPath(targetId);
      setVerificationResult(result);
    } catch (e: any) {
      console.error('Failed to verify quota path:', e);
    } finally {
      setIsVerifying(false);
    }
  };

  // Metrics calculation
  const totalAccounts = snapshots.length;
  const onlineCount = snapshots.filter((s) => s.status === 'Online').length;
  const attentionCount = snapshots.filter(
    (s) =>
      s.status === 'AuthRequired' ||
      s.status === 'NetworkError' ||
      s.status === 'ProviderError' ||
      s.status === 'RateLimited'
  ).length;

  let totalMonitoredModels = 0;
  let totalSharedGroups = 0;
  for (const s of snapshots) {
    if (s.quota?.models) {
      totalMonitoredModels += s.quota.models.length;
      totalSharedGroups += groupModelsIntoQuotaPools(s.quota.models).length;
    }
  }

  return (
    <div className="space-y-4">
      {/* Global Error Banner */}
      {error && (
        <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="AlertTriangle" className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-destructive/80 hover:text-destructive text-xs font-semibold px-2 py-0.5"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Header Bar */}
      <QuotaSummary
        totalAccounts={totalAccounts}
        onlineCount={onlineCount}
        attentionCount={attentionCount}
        totalSharedGroups={totalSharedGroups}
        totalMonitoredModels={totalMonitoredModels}
        isMonitoringRunning={pollingStatus?.isRunning ?? false}
        lastGlobalRefreshAt={pollingStatus?.lastGlobalRefreshAt ?? null}
        nextGlobalRefreshAt={pollingStatus?.nextGlobalRefreshAt ?? null}
        autoRefreshEnabled={pollingStatus?.autoRefreshEnabled ?? true}
        intervalSeconds={pollingStatus?.intervalSeconds ?? 300}
        isRefreshingAll={isRefreshingAll}
        onRefreshAll={handleRefreshAll}
        onUpdateRefreshSettings={handleUpdateRefreshSettings}
      />

      {/* Your Accounts Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-foreground tracking-wider uppercase text-muted-foreground">
            Monitored Accounts ({snapshots.length})
          </h2>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs font-medium gap-1"
          >
            <Icon name="Plus" className="w-3 h-3 text-primary" />
            <span>Add Account</span>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-2">
            <Icon name="Loader2" className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground font-sans">Loading account quotas...</p>
          </div>
        ) : snapshots.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12 px-4 border border-dashed rounded-xl bg-surface/50 space-y-3">
            <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
              <Icon name="Users" className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-foreground">No accounts registered</h3>
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                Add an Antigravity account to start tracking quota and reset times in one place.
              </p>
            </div>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              variant="default"
              size="sm"
              className="text-xs font-medium gap-1 h-7"
            >
              <Icon name="Plus" className="w-3 h-3" />
              <span>Add Account</span>
            </Button>
          </div>
        ) : (
          /* Responsive Account Cards Grid with items-start */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            {snapshots.map((snap) => (
              <QuotaAccountCard
                key={snap.accountId}
                snapshot={snap}
                onRefresh={handleRefreshAccount}
                onToggleEnabled={handleToggleEnabled}
                onToggleAutoConnect={handleToggleAutoConnect}
                onRename={handleRenameAccount}
                onRemove={handleRemoveAccount}
                isRefreshing={refreshingAccountId === snap.accountId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddAccount={handleAddAccount}
      />


      {/* Advanced Diagnostics (Collapsible, Collapsed by Default) */}
      <div className="pt-2 border-t border-border">
        <button
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <Icon
            name="ChevronRight"
            className={`w-3.5 h-3.5 transition-transform duration-200 ${showAdvanced ? 'rotate-90' : ''}`}
          />
          <span>Advanced Diagnostics</span>
        </button>

        {showAdvanced && (
          <div className="mt-3 p-4 rounded-xl bg-muted/20 border border-border text-xs text-muted-foreground space-y-4 font-sans animate-in fade-in duration-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex items-center justify-between col-span-1">
                <div>
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">Engine State</span>
                  <div className="font-semibold text-foreground mt-0.5">
                    {pollingStatus?.isRunning ? 'Running' : 'Stopped'}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleMonitoring}
                  className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                >
                  {pollingStatus?.isRunning ? 'Stop' : 'Start'}
                </Button>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Auto Refresh Interval</span>
                <div className="font-semibold text-foreground mt-0.5">
                  {pollingStatus?.intervalSeconds ?? 300} seconds
                </div>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Active Accounts</span>
                <div className="font-semibold text-foreground mt-0.5">
                  {pollingStatus?.activeAccountsCount ?? 0} / {pollingStatus?.totalAccountsCount ?? 0}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Last Global Sync</span>
                <div className="font-mono text-[11px] text-foreground mt-0.5">
                  {pollingStatus?.lastGlobalRefreshAt
                    ? new Date(Number(pollingStatus.lastGlobalRefreshAt) * 1000).toLocaleTimeString()
                    : 'None'}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border/50 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-foreground font-medium">Real Quota Path Verification</p>
                <p className="text-[10px] text-muted-foreground">
                  Executes the authenticated provider verification path and inspects data provenance.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleVerifyProviderPath()}
                disabled={isVerifying}
                className="h-7 text-xs px-2.5 gap-1.5"
              >
                {isVerifying && <Icon name="Loader2" className="w-3 h-3 animate-spin" />}
                <span>Verify Provider Path</span>
              </Button>
            </div>

            {verificationResult && (
              <div className="p-3 rounded-lg bg-surface border border-border space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account:</span>
                  <span className="text-foreground">{verificationResult.accountId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Authentication:</span>
                  <span className={verificationResult.authenticationState === 'Connected' ? 'text-emerald-500' : 'text-amber-500'}>
                    {verificationResult.authenticationState}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Request Status:</span>
                  <span className="text-foreground">{verificationResult.requestStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data Source:</span>
                  <span className="text-foreground">{verificationResult.dataSource}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data Quality:</span>
                  <span className="text-foreground">{verificationResult.dataQuality}</span>
                </div>
                {verificationResult.latencyMs != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Latency:</span>
                    <span className="text-foreground">{verificationResult.latencyMs} ms</span>
                  </div>
                )}
                {verificationResult.sanitizedError && (
                  <div className="text-muted-foreground pt-1 border-t border-border/50 text-[10px] font-sans">
                    {verificationResult.sanitizedError}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
