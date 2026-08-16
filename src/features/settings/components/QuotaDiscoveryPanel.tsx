import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import {
  quotaDiscoveryService,
  quotaPollingService,
  quotaProviderService,
} from '@/application/services';
import {
  LocalUsageDiscoveryReport,
  QuotaDiscoveryReport,
  UsageCorrelationReport,
  UsageProtocolDiscoveryReport,
  UsageTraceReport,
} from '@/domain/entities/QuotaDiscovery';
import { AccountIdentity, QuotaStatus } from '@/domain/entities/QuotaProvider';
import {
  AccountQuotaSnapshot,
  PollingEngineStatus,
} from '@/domain/entities/QuotaPolling';

export function QuotaDiscoveryPanel() {
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [accounts, setAccounts] = useState<AccountIdentity[]>([]);
  const [isRefreshingQuota, setIsRefreshingQuota] = useState(false);

  // AG-7 Polling Engine State
  const [pollingStatus, setPollingStatus] = useState<PollingEngineStatus | null>(null);
  const [accountSnapshots, setAccountSnapshots] = useState<AccountQuotaSnapshot[]>([]);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [refreshingAccountId, setRefreshingAccountId] = useState<string | null>(null);

  const [report, setReport] = useState<QuotaDiscoveryReport | null>(null);
  const [correlationReport, setCorrelationReport] = useState<UsageCorrelationReport | null>(null);
  const [traceReport, setTraceReport] = useState<UsageTraceReport | null>(null);
  const [localReport, setLocalReport] = useState<LocalUsageDiscoveryReport | null>(null);
  const [protocolReport, setProtocolReport] = useState<UsageProtocolDiscoveryReport | null>(null);

  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isCorrelating, setIsCorrelating] = useState(false);
  const [isTracing, setIsTracing] = useState(false);
  const [isDiscoveringLocal, setIsDiscoveringLocal] = useState(false);
  const [isDiscoveringProtocol, setIsDiscoveringProtocol] = useState(false);
  const [traceCountdown, setTraceCountdown] = useState(8);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load accounts initially
    quotaProviderService
      .listAccounts()
      .then((accs) => setAccounts(accs))
      .catch((e) => console.error('Failed to list accounts:', e));

    // Load initial quota status
    handleFetchQuota(false);

    // Load initial AG-7 polling engine state
    loadPollingEngineData();

    // Listen to real-time quota account updates
    let unlisten: (() => void) | undefined;
    quotaPollingService
      .onAccountUpdated((updatedSnap) => {
        setAccountSnapshots((prev) => {
          const index = prev.findIndex((s) => s.accountId === updatedSnap.accountId);
          if (index >= 0) {
            const next = [...prev];
            next[index] = updatedSnap;
            return next;
          } else {
            return [...prev, updatedSnap];
          }
        });
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((e) => console.error('Failed to attach quota event listener:', e));

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    let timer: any;
    if (isTracing && traceCountdown > 0) {
      timer = setInterval(() => {
        setTraceCountdown((prev) => (prev > 1 ? prev - 1 : 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTracing, traceCountdown]);

  const loadPollingEngineData = async () => {
    try {
      const [status, states] = await Promise.all([
        quotaPollingService.getPollingStatus(),
        quotaPollingService.getAllStates(),
      ]);
      setPollingStatus(status);
      setAccountSnapshots(states);
    } catch (e) {
      console.error('Failed to load polling engine data:', e);
    }
  };

  const handleToggleMonitoring = async () => {
    try {
      if (pollingStatus?.isRunning) {
        await quotaPollingService.stopMonitoring();
      } else {
        await quotaPollingService.startMonitoring();
      }
      await loadPollingEngineData();
    } catch (e: any) {
      setError(e?.message || String(e) || 'Failed to toggle monitoring');
    }
  };

  const handleRefreshAccount = async (accountId: string) => {
    setRefreshingAccountId(accountId);
    setError(null);
    try {
      const snap = await quotaPollingService.refreshAccount(accountId);
      setAccountSnapshots((prev) => {
        const index = prev.findIndex((s) => s.accountId === accountId);
        if (index >= 0) {
          const next = [...prev];
          next[index] = snap;
          return next;
        } else {
          return [...prev, snap];
        }
      });
      await loadPollingEngineData();
    } catch (e: any) {
      setError(e?.message || String(e) || `Failed to refresh account ${accountId}`);
    } finally {
      setRefreshingAccountId(null);
    }
  };

  const handleRefreshAllAccounts = async () => {
    setIsRefreshingAll(true);
    setError(null);
    try {
      const snaps = await quotaPollingService.refreshAll();
      setAccountSnapshots(snaps);
      await loadPollingEngineData();
    } catch (e: any) {
      setError(e?.message || String(e) || 'Failed to refresh all accounts');
    } finally {
      setIsRefreshingAll(false);
    }
  };

  const handleFetchQuota = async (forceRefresh: boolean = true) => {
    setIsRefreshingQuota(true);
    setError(null);
    try {
      const data = await quotaProviderService.getAccountQuota(undefined, forceRefresh);
      setQuotaStatus(data);
    } catch (e: any) {
      console.error('Failed to fetch quota:', e);
      setError(e?.message || String(e) || 'Failed to fetch account quota');
    } finally {
      setIsRefreshingQuota(false);
    }
  };

  const handleRunDiscovery = async () => {
    setIsDiscovering(true);
    setError(null);
    try {
      const data = await quotaDiscoveryService.runDiscovery();
      setReport(data);
    } catch (e: any) {
      console.error('Quota discovery failed:', e);
      setError(e?.message || String(e) || 'Failed to execute discovery diagnostic');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleCorrelateUsage = async () => {
    setIsCorrelating(true);
    setError(null);
    try {
      const data = await quotaDiscoveryService.correlateUsageEndpoints();
      setCorrelationReport(data);
    } catch (e: any) {
      console.error('Usage correlation failed:', e);
      setError(e?.message || String(e) || 'Failed to execute usage endpoint correlation');
    } finally {
      setIsCorrelating(false);
    }
  };

  const handleStartTrace = async () => {
    setIsTracing(true);
    setTraceCountdown(8);
    setError(null);
    try {
      const data = await quotaDiscoveryService.startUsageTrace(8);
      setTraceReport(data);
    } catch (e: any) {
      console.error('Usage trace failed:', e);
      setError(e?.message || String(e) || 'Failed to execute interactive usage trace');
    } finally {
      setIsTracing(false);
    }
  };

  const handleDiscoverLocalSources = async () => {
    setIsDiscoveringLocal(true);
    setError(null);
    try {
      const data = await quotaDiscoveryService.discoverLocalUsageSources();
      setLocalReport(data);
    } catch (e: any) {
      console.error('Local usage discovery failed:', e);
      setError(e?.message || String(e) || 'Failed to inspect local usage sources');
    } finally {
      setIsDiscoveringLocal(false);
    }
  };

  const handleDiscoverProtocol = async () => {
    setIsDiscoveringProtocol(true);
    setError(null);
    try {
      const data = await quotaDiscoveryService.discoverUsageProtocol(8);
      setProtocolReport(data);
    } catch (e: any) {
      console.error('Protocol discovery failed:', e);
      setError(e?.message || String(e) || 'Failed to discover usage protocol');
    } finally {
      setIsDiscoveringProtocol(false);
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'Confirmed':
        return 'bg-success/10 text-success border-success/30';
      case 'High':
        return 'bg-primary/10 text-primary border-primary/30';
      case 'Medium':
        return 'bg-warning/10 text-warning border-warning/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
          <Icon name="AlertTriangle" className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* AG-7 Multi-Account Quota Polling Engine */}
      <Card className="border-primary/60 bg-surface shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2 text-foreground">
                <Icon name="RefreshCw" className="w-5 h-5 text-primary" />
                Multi-Account Quota Polling Engine (AG-7)
              </CardTitle>
              <CardDescription>
                Near-real-time quota monitoring engine polling independent accounts in the background with bounded concurrency and stale fallback preservation.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleToggleMonitoring}
                variant={pollingStatus?.isRunning ? 'outline' : 'default'}
                size="sm"
              >
                {pollingStatus?.isRunning ? (
                  <>
                    <Icon name="Square" className="mr-1.5 h-3.5 w-3.5 text-destructive" />
                    Stop Engine
                  </>
                ) : (
                  <>
                    <Icon name="Play" className="mr-1.5 h-3.5 w-3.5 text-success" />
                    Start Engine
                  </>
                )}
              </Button>
              <Button
                onClick={handleRefreshAllAccounts}
                disabled={isRefreshingAll}
                variant="outline"
                size="sm"
              >
                {isRefreshingAll ? (
                  <>
                    <Icon name="Loader2" className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Refreshing All...
                  </>
                ) : (
                  <>
                    <Icon name="RotateCw" className="mr-1.5 h-3.5 w-3.5" />
                    Refresh All
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Polling Engine Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 p-3 rounded-lg bg-muted/30 border font-sans text-xs">
            <div>
              <span className="text-muted-foreground uppercase text-[10px] font-semibold">Engine Status:</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    pollingStatus?.isRunning ? 'bg-success animate-pulse' : 'bg-muted-foreground'
                  }`}
                />
                <span className="font-bold text-foreground">
                  {pollingStatus?.isRunning ? 'RUNNING' : 'STOPPED'}
                </span>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground uppercase text-[10px] font-semibold">Interval:</span>
              <div className="font-bold text-foreground mt-0.5">
                {pollingStatus?.defaultIntervalSeconds ?? 120}s
              </div>
            </div>
            <div>
              <span className="text-muted-foreground uppercase text-[10px] font-semibold">Total Accounts:</span>
              <div className="font-bold text-foreground mt-0.5">{pollingStatus?.totalAccountsCount ?? 0}</div>
            </div>
            <div>
              <span className="text-muted-foreground uppercase text-[10px] font-semibold">Online:</span>
              <div className="font-bold text-success mt-0.5">{pollingStatus?.onlineCount ?? 0}</div>
            </div>
            <div>
              <span className="text-muted-foreground uppercase text-[10px] font-semibold">Auth Required:</span>
              <div className="font-bold text-warning mt-0.5">{pollingStatus?.authRequiredCount ?? 0}</div>
            </div>
            <div>
              <span className="text-muted-foreground uppercase text-[10px] font-semibold">Errors:</span>
              <div className="font-bold text-destructive mt-0.5">{pollingStatus?.errorCount ?? 0}</div>
            </div>
          </div>

          {/* Monitored Accounts List */}
          <div className="space-y-2">
            <h4 className="font-semibold text-xs text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Icon name="Users" className="w-3.5 h-3.5 text-primary" />
                Monitored Accounts ({accountSnapshots.length})
              </span>
              {pollingStatus?.lastGlobalRefreshAt && (
                <span className="text-[10px] font-normal text-muted-foreground font-mono">
                  Last Sync: {new Date(Number(pollingStatus.lastGlobalRefreshAt) * 1000).toLocaleTimeString()}
                </span>
              )}
            </h4>

            {accountSnapshots.length === 0 ? (
              <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground text-xs font-sans">
                No accounts currently active. Polling engine will discover configured accounts automatically.
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-muted/50 border-b font-medium text-muted-foreground">
                    <tr>
                      <th className="p-2.5">Account / Email</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Remaining Capacity</th>
                      <th className="p-2.5">Last Sync</th>
                      <th className="p-2.5">Next Refresh</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-[11px]">
                    {accountSnapshots.map((snap) => (
                      <tr key={snap.accountId} className="hover:bg-muted/20">
                        <td className="p-2.5">
                          <div className="font-semibold text-foreground truncate max-w-[200px]" title={snap.email}>
                            {snap.displayName || snap.email}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">{snap.accountId}</div>
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              snap.status === 'Online'
                                ? 'bg-success/10 text-success border-success/30'
                                : snap.status === 'AuthRequired'
                                ? 'bg-warning/10 text-warning border-warning/30'
                                : snap.status === 'NetworkError'
                                ? 'bg-destructive/10 text-destructive border-destructive/30'
                                : 'bg-muted text-muted-foreground border-border'
                            }`}
                          >
                            {snap.status}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono">
                          {snap.quota?.models && snap.quota.models.length > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-muted rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-primary h-full rounded-full"
                                  style={{
                                    width: `${snap.quota.models[0]?.remainingPercentage ?? 0}%`,
                                  }}
                                />
                              </div>
                              <span className="font-bold text-foreground">
                                {snap.quota.models[0]?.remainingPercentage !== null
                                  ? `${snap.quota.models[0]?.remainingPercentage}%`
                                  : 'N/A'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">No quota data</span>
                          )}
                        </td>
                        <td className="p-2.5 text-muted-foreground font-mono">
                          {snap.lastSuccessfulSyncAt
                            ? new Date(Number(snap.lastSuccessfulSyncAt) * 1000).toLocaleTimeString()
                            : '-'}
                        </td>
                        <td className="p-2.5 text-muted-foreground font-mono">
                          {snap.nextRefreshAt
                            ? new Date(Number(snap.nextRefreshAt) * 1000).toLocaleTimeString()
                            : 'On Interval'}
                        </td>
                        <td className="p-2.5 text-right">
                          <Button
                            onClick={() => handleRefreshAccount(snap.accountId)}
                            disabled={refreshingAccountId === snap.accountId}
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                          >
                            {refreshingAccountId === snap.accountId ? (
                              <Icon name="Loader2" className="h-3.5 w-3.5 animate-spin text-primary" />
                            ) : (
                              <Icon name="RefreshCw" className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="border-t bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
          <span>Security Invariant: Concurrency limited to 2 requests. Stale data preserved on network error. No token serialization.</span>
          <span className="font-semibold text-primary">Continuous Monitoring Engine</span>
        </CardFooter>
      </Card>

      {/* AG-6 Secure Quota Provider Foundation */}
      <Card className="border-border bg-surface shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2 text-foreground">
                <Icon name="Shield" className="w-5 h-5 text-primary" />
                Secure Quota Provider Foundation (AG-6)
              </CardTitle>
              <CardDescription>
                Direct Cloud Code API quota monitoring with OS Keyring OAuth refresh ({accounts.length} account{accounts.length === 1 ? '' : 's'} registered).
              </CardDescription>
            </div>
            <Button
              onClick={() => handleFetchQuota(true)}
              disabled={isRefreshingQuota}
              variant="outline"
              size="sm"
            >
              {isRefreshingQuota ? (
                <>
                  <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <Icon name="RefreshCw" className="mr-2 h-4 w-4" />
                  Refresh Quota
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {quotaStatus && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-lg bg-muted/30 border font-sans text-xs">
                <div>
                  <span className="text-muted-foreground uppercase text-[10px] font-semibold">Account:</span>
                  <div className="font-bold text-foreground mt-0.5 truncate" title={quotaStatus.email}>
                    {quotaStatus.email}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    ID: {quotaStatus.accountId}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase text-[10px] font-semibold">Provider:</span>
                  <div className="font-bold text-foreground mt-0.5">{quotaStatus.provider}</div>
                  <div className="text-[10px] text-primary mt-0.5">{quotaStatus.tier ?? 'Standard Tier'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase text-[10px] font-semibold">Status:</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        quotaStatus.status === 'Available'
                          ? 'bg-success'
                          : quotaStatus.status === 'AuthRequired'
                          ? 'bg-warning'
                          : 'bg-muted-foreground'
                      }`}
                    />
                    <span className="font-bold text-foreground">{quotaStatus.status}</span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase text-[10px] font-semibold">Last Updated:</span>
                  <div className="font-mono text-foreground mt-0.5 text-[11px]">
                    {new Date(Number(quotaStatus.fetchedAt) * 1000).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {quotaStatus.safeDiagnosticMessage && (
                <div className="p-3 rounded-lg bg-muted/20 border text-xs text-muted-foreground flex items-center gap-2">
                  <Icon name="Info" className="w-4 h-4 text-primary shrink-0" />
                  <span>{quotaStatus.safeDiagnosticMessage}</span>
                </div>
              )}

              {/* Models Quota Table */}
              {quotaStatus.models.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Icon name="Cpu" className="w-3.5 h-3.5 text-primary" />
                    Model Allowances & Remaining Capacity ({quotaStatus.models.length})
                  </h4>

                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-left text-xs font-sans">
                      <thead className="bg-muted/50 border-b font-medium text-muted-foreground">
                        <tr>
                          <th className="p-2.5">Model</th>
                          <th className="p-2.5">Remaining Capacity</th>
                          <th className="p-2.5">Reset Time</th>
                          <th className="p-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-[11px]">
                        {quotaStatus.models.map((m, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="p-2.5">
                              <div className="font-semibold text-foreground">{m.displayName}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">{m.modelId}</div>
                            </td>
                            <td className="p-2.5 font-mono">
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-muted rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-primary h-full rounded-full"
                                    style={{ width: `${m.remainingPercentage ?? 0}%` }}
                                  />
                                </div>
                                <span className="font-bold text-foreground">
                                  {m.remainingPercentage !== null ? `${m.remainingPercentage}%` : 'N/A'}
                                </span>
                              </div>
                            </td>
                            <td className="p-2.5 text-muted-foreground font-mono">
                              {m.resetAt ?? 'Rolling Window'}
                            </td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-success/10 text-success border border-success/30">
                                {m.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AG-6 Usage Protocol Discovery Card */}
      <Card className="border-border bg-surface shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2 text-foreground">
                <Icon name="Network" className="w-5 h-5 text-primary" />
                Usage Protocol Discovery (AG-6)
              </CardTitle>
              <CardDescription>
                Determine the local protocol (HTTP, HTTPS, gRPC, Protobuf RPC) and execution owner for Antigravity slash commands.
              </CardDescription>
            </div>
            <Button onClick={handleDiscoverProtocol} disabled={isDiscoveringProtocol} variant="outline" size="sm">
              {isDiscoveringProtocol ? (
                <>
                  <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
                  Observing...
                </>
              ) : (
                <>
                  <Icon name="Play" className="mr-2 h-4 w-4" />
                  Start Trace (8s)
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {protocolReport && protocolReport.candidate && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-lg bg-muted/30 border font-sans text-xs">
              <div>
                <span className="text-muted-foreground uppercase text-[10px] font-semibold">Process & Owner</span>
                <div className="font-bold text-foreground mt-0.5">
                  {protocolReport.candidate.processName}{' '}
                  <span className="font-mono text-[11px] text-muted-foreground">({protocolReport.candidate.pid})</span>
                </div>
                <div className="text-[10px] text-primary font-mono mt-0.5">Owner: {protocolReport.candidate.executionOwner}</div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[10px] font-semibold">Port & Protocol</span>
                <div className="font-bold text-foreground mt-0.5 font-mono">
                  {protocolReport.candidate.port} ({protocolReport.candidate.protocol})
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate" title={protocolReport.candidate.contentType ?? '-'}>
                  {protocolReport.candidate.contentType ?? '-'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[10px] font-semibold">Payload & Quota</span>
                <div className="font-bold text-foreground mt-0.5">
                  {protocolReport.candidate.payloadFormat}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Quota: {protocolReport.candidate.quotaAvailability}</div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[10px] font-semibold">Correlation</span>
                <div className="font-bold text-foreground mt-0.5 font-mono">{protocolReport.candidate.correlationState}</div>
                <div className="mt-0.5">
                  <span
                    className={`px-2 py-0.2 rounded text-[10px] font-semibold border ${getConfidenceBadge(
                      protocolReport.candidate.confidence
                    )}`}
                  >
                    {protocolReport.candidate.confidence}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AG-5 Local Usage State Discovery Card */}
      <Card className="border-border bg-surface shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Icon name="FolderSearch" className="w-5 h-5 text-primary" />
                Local Usage State Discovery (AG-5)
              </CardTitle>
              <CardDescription>
                Inspect local Antigravity state, configuration, and non-sensitive diagnostic logs for plaintext quota metrics.
              </CardDescription>
            </div>
            <Button onClick={handleDiscoverLocalSources} disabled={isDiscoveringLocal} variant="outline" size="sm">
              {isDiscoveringLocal ? (
                <>
                  <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
                  Inspecting...
                </>
              ) : (
                <>
                  <Icon name="Search" className="mr-2 h-4 w-4" />
                  Inspect Sources
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!localReport && !isDiscoveringLocal && (
            <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground text-xs font-sans">
              Click "Inspect Sources" to discover allowlisted Antigravity configuration files and diagnostic state.
            </div>
          )}

          {localReport && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/30 border font-sans text-xs">
              <div>
                <span className="text-muted-foreground uppercase text-[10px] font-semibold">Status:</span>
                <div className="font-bold text-foreground mt-0.5 font-mono">{localReport.status}</div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[10px] font-semibold">Directories Inspected:</span>
                <div className="font-bold text-foreground mt-0.5">{localReport.directoriesInspected}</div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[10px] font-semibold">Files Scanned:</span>
                <div className="font-bold text-foreground mt-0.5">{localReport.filesInspected}</div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[10px] font-semibold">Scan Duration:</span>
                <div className="font-bold text-foreground mt-0.5">{localReport.scanDurationMs} ms</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AG-4 Safe Quota Metadata Card */}
      {traceReport?.safeQuotaMetadata && (
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon name="Activity" className="w-5 h-5 text-primary" />
                Usage / Quota Metadata (AG-4)
              </CardTitle>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${
                  traceReport.safeQuotaMetadata.status === 'Confirmed' || traceReport.safeQuotaMetadata.status === 'Observed'
                    ? 'bg-success/10 text-success border-success/30'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                {traceReport.safeQuotaMetadata.status === 'Confirmed'
                  ? '✓ Confirmed'
                  : traceReport.safeQuotaMetadata.status === 'Observed'
                  ? 'Observed'
                  : 'Candidate'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {traceReport.safeQuotaMetadata.quota ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30 border font-sans">
                <div>
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground">Quota Consumed</div>
                  <div className="text-xl font-bold text-foreground mt-0.5">
                    {traceReport.safeQuotaMetadata.quota.percentage !== null
                      ? `${traceReport.safeQuotaMetadata.quota.percentage}%`
                      : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground">Used / Limit</div>
                  <div className="text-sm font-semibold text-foreground mt-1 font-mono">
                    {traceReport.safeQuotaMetadata.quota.used !== null && traceReport.safeQuotaMetadata.quota.limit !== null
                      ? `${traceReport.safeQuotaMetadata.quota.used} / ${traceReport.safeQuotaMetadata.quota.limit}`
                      : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground">Remaining Capacity</div>
                  <div className="text-xl font-bold text-primary mt-0.5">
                    {traceReport.safeQuotaMetadata.quota.remaining !== null
                      ? `${traceReport.safeQuotaMetadata.quota.remaining}`
                      : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground">Quota Reset</div>
                  <div className="text-sm font-semibold text-muted-foreground mt-1">
                    {traceReport.safeQuotaMetadata.quota.resetAt || 'Next Billing Window'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-muted/20 border text-xs text-muted-foreground">
                No safe quota metrics exposed in plaintext.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AG-2.5 Interactive Usage Trace Diagnostic */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Icon name="Activity" className="w-5 h-5 text-primary" />
                Interactive Usage Trace (AG-2.5)
              </CardTitle>
              <CardDescription>
                Live temporal trace verifying whether manual execution of <code>/usage</code> in Antigravity triggers observable local RPC activity.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleStartTrace} disabled={isTracing} variant="outline" size="sm">
                {isTracing ? (
                  <>
                    <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
                    Tracing ({traceCountdown}s)...
                  </>
                ) : (
                  <>
                    <Icon name="Play" className="mr-2 h-4 w-4" />
                    Start Trace (8s)
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* AG-2 Usage Endpoint Correlation Diagnostic */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Icon name="Network" className="w-5 h-5 text-primary" />
                Usage Endpoint Correlation (AG-2)
              </CardTitle>
              <CardDescription>
                Static analysis of local Antigravity Language Server RPC instances and candidate endpoints.
              </CardDescription>
            </div>
            <Button onClick={handleCorrelateUsage} disabled={isCorrelating} variant="outline" size="sm">
              {isCorrelating ? (
                <>
                  <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
                  Correlating...
                </>
              ) : (
                <>
                  <Icon name="Search" className="mr-2 h-4 w-4" />
                  Correlate Endpoints
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {correlationReport && (
          <CardContent className="space-y-4">
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-muted/50 border-b font-medium text-muted-foreground">
                  <tr>
                    <th className="p-2.5">Process / PID</th>
                    <th className="p-2.5">Port</th>
                    <th className="p-2.5">Protocol</th>
                    <th className="p-2.5">Classification</th>
                    <th className="p-2.5">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono text-[11px]">
                  {correlationReport.candidates.map((cand, idx) => (
                    <tr key={idx} className="hover:bg-muted/20">
                      <td className="p-2.5 font-sans font-semibold text-foreground">
                        {cand.processName} <span className="text-muted-foreground font-mono">({cand.processPid})</span>
                      </td>
                      <td className="p-2.5 font-bold text-primary">{cand.port}</td>
                      <td className="p-2.5 uppercase">{cand.protocol}</td>
                      <td className="p-2.5 font-sans">{cand.classification}</td>
                      <td className="p-2.5 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getConfidenceBadge(cand.confidence)}`}>
                          {cand.confidence}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>

      {/* AG-1 Process & Endpoint Discovery View */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Cpu" className="w-5 h-5 text-primary" />
                Raw Process & Port Discovery (AG-1)
              </CardTitle>
              <CardDescription>
                Low-level diagnostic scanning local processes and TCP listening sockets.
              </CardDescription>
            </div>
            <Button onClick={handleRunDiscovery} disabled={isDiscovering} variant="outline" size="sm">
              {isDiscovering ? (
                <>
                  <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Icon name="RefreshCw" className="mr-2 h-4 w-4" />
                  Scan Ports
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {report && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/30 border font-sans text-xs">
              <div>
                <span className="text-muted-foreground uppercase text-[10px] font-semibold">Processes Found:</span>
                <div className="font-bold text-foreground mt-0.5">{report.processes.length}</div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[10px] font-semibold">Listening Ports:</span>
                <div className="font-bold text-foreground mt-0.5">{report.listeningPorts.length}</div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[10px] font-semibold">Candidate Endpoints:</span>
                <div className="font-bold text-foreground mt-0.5">{report.endpoints.length}</div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[10px] font-semibold">Hub Status:</span>
                <div className="font-bold text-primary mt-0.5">
                  {report.endpoints.some((e) => e.isAntigravityHub) ? 'Active' : 'None'}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
