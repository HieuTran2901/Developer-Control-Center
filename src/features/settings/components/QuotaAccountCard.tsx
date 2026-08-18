import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { AccountPollingState, AccountQuotaSnapshot } from '@/domain/entities/QuotaPolling';
import { ModelQuota } from '@/domain/entities/QuotaProvider';
import { quotaPollingService } from '@/application/services';
import { QuotaOrchestrationService } from '@/domain/services/QuotaOrchestrationService';

export type ConnectStage =
  | 'idle'
  | 'detecting'
  | 'connecting'
  | 'reading'
  | 'connected'
  | 'failed';

interface QuotaAccountCardProps {
  snapshot: AccountQuotaSnapshot;
  onRefresh: (accountId: string) => Promise<void>;
  onToggleEnabled: (accountId: string, enabled: boolean) => Promise<void>;
  onToggleAutoConnect?: (accountId: string, autoConnect: boolean) => Promise<void>;
  onRename: (accountId: string, displayName: string | null) => Promise<void>;
  onRemove: (accountId: string) => Promise<void>;
  isRefreshing: boolean;
}

export function QuotaAccountCard({
  snapshot,
  onRefresh,
  onToggleEnabled,
  onToggleAutoConnect,
  onRename,
  onRemove,
  isRefreshing,
}: QuotaAccountCardProps) {
  const [relativeSyncTime, setRelativeSyncTime] = useState<string>('');
  const [, setTick] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(snapshot.displayName || '');
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  const [connectStage, setConnectStage] = useState<ConnectStage>('idle');
  const [connectStatusMessage, setConnectStatusMessage] = useState<string | null>(null);
  const [connectErrorMessage, setConnectErrorMessage] = useState<string | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleGroup = (groupId: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update relative timestamps and countdown ticker every second
  useEffect(() => {
    function updateTimestamps() {
      if (snapshot.lastSuccessfulSyncAt) {
        setRelativeSyncTime(formatRelativeTime(snapshot.lastSuccessfulSyncAt));
      } else {
        setRelativeSyncTime('');
      }
      setTick((t) => (t + 1) % 100000);
    }

    updateTimestamps();
    const interval = setInterval(updateTimestamps, 1000);
    return () => clearInterval(interval);
  }, [snapshot.lastSuccessfulSyncAt, snapshot.quota]);

  const isDefaultAccount = snapshot.accountId === 'default';
  const isDisabled = snapshot.status === 'Disabled';
  const isStale =
    (snapshot.status === 'NetworkError' || snapshot.status === 'ProviderError') &&
    snapshot.quota !== null;

  const isGooglePrimary =
    snapshot.quota?.provider === 'Google Cloud Code' ||
    snapshot.provider === 'google_cloud_code' ||
    snapshot.errorMessage?.toLowerCase().includes('cloud code') ||
    snapshot.quota?.safeDiagnosticMessage?.toLowerCase().includes('cloud code') ||
    snapshot.errorMessage?.toLowerCase().includes('google');
  const isAntigravityFallback =
    snapshot.quota?.provider === 'Antigravity Local Runtime' ||
    snapshot.quota?.safeDiagnosticMessage?.includes('Fallback');

  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    await onRename(snapshot.accountId, newDisplayName.trim() || null);
    setIsRenaming(false);
  };

  const handleConnectGoogleOAuth = async () => {
    setConnectStage('connecting');
    setConnectStatusMessage('Opening browser for Google OAuth authorization...');
    setConnectErrorMessage(null);

    try {
      const res = await quotaPollingService.connectGoogleAccount(snapshot.accountId, false);
      if (res.success) {
        setConnectStage('connected');
        setConnectStatusMessage('✓ Connected Google account successfully!');
        await onRefresh(snapshot.accountId);
        setTimeout(() => {
          setConnectStage('idle');
          setConnectStatusMessage(null);
        }, 2000);
      } else {
        setConnectStage('failed');
        setConnectErrorMessage(res.message || 'Google OAuth connection failed.');
      }
    } catch (err: any) {
      setConnectStage('failed');
      setConnectErrorMessage(err?.message || String(err) || 'Google authentication failed.');
    }
  };

  const handleDisconnectGoogleOAuth = async () => {
    try {
      await quotaPollingService.disconnectGoogleAccount(snapshot.accountId);
      await onRefresh(snapshot.accountId);
    } catch (err: any) {
      console.error('Failed to disconnect Google account:', err);
    }
  };

  const handleConnectLocalAntigravity = async () => {
    setConnectStage('detecting');
    setConnectStatusMessage('Detecting running Antigravity process...');
    setConnectErrorMessage(null);

    setTimeout(() => {
      setConnectStage((prev) => (prev === 'detecting' ? 'connecting' : prev));
      setConnectStatusMessage('Connecting to local Language Server RPC...');
    }, 300);

    setTimeout(() => {
      setConnectStage((prev) => (prev === 'connecting' ? 'reading' : prev));
      setConnectStatusMessage('Reading live model quota metrics...');
    }, 600);

    try {
      const updatedSnapshot = await quotaPollingService.connectAntigravityAccount(snapshot.accountId);
      await onRefresh(snapshot.accountId);

      if (updatedSnapshot.status === 'Online' && updatedSnapshot.quota) {
        setConnectStage('connected');
        setConnectStatusMessage('✓ Connected to Antigravity Local Runtime.');
      } else {
        setConnectStage('failed');
        setConnectErrorMessage(
          updatedSnapshot.errorMessage ||
            'Antigravity is not currently running. Please launch Antigravity to monitor quota.'
        );
        setConnectStatusMessage(null);
      }

      setTimeout(() => {
        setConnectStage('idle');
        setConnectStatusMessage(null);
        setConnectErrorMessage(null);
      }, 2500);
    } catch (err: any) {
      setConnectStage('failed');
      setConnectErrorMessage(
        err?.message ||
          snapshot.errorMessage ||
          'Antigravity is not currently running. Please launch Antigravity to monitor quota.'
      );
      setConnectStatusMessage(null);
    }
  };

  const isMismatch =
    snapshot.status === 'AuthRequired' &&
    (snapshot.errorMessage?.includes('Account mismatch') ||
      snapshot.quota?.safeDiagnosticMessage?.includes('Account mismatch'));

  // Extract runtime email from diagnostic if mismatch
  const mismatchRuntimeEmail =
    snapshot.errorMessage?.match(/authenticated as ([^,]+),/)?.[1] ||
    snapshot.quota?.safeDiagnosticMessage?.match(/authenticated as ([^,]+),/)?.[1];

  return (
    <>
      <Card
        className={`flex flex-col justify-between border-border bg-surface shadow-xs hover:shadow-sm transition-all rounded-xl relative overflow-hidden h-auto ${
          isDisabled ? 'opacity-70 bg-muted/20' : ''
        }`}
      >
        {/* Compact Card Header */}
        <CardHeader className="py-3 px-4 border-b border-border/40 bg-muted/5 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
              {/* Dynamic Provider Badge */}
              {isGooglePrimary ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25 shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Google Cloud Code · Primary
                </span>
              ) : isAntigravityFallback ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Antigravity · Fallback
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/15 text-primary border border-primary/25 shrink-0 uppercase tracking-wider">
                  {snapshot.provider ? snapshot.provider.replace('_', ' ') : 'ANTIGRAVITY'}
                </span>
              )}

              {isDefaultAccount && (
                <span className="px-1 py-0.2 rounded text-[9px] font-semibold bg-muted text-muted-foreground border shrink-0">
                  DEFAULT
                </span>
              )}

              {isRenaming ? (
                <form onSubmit={handleSaveRename} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    className="px-2 py-0.5 text-xs rounded bg-background border border-border text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  <Button type="submit" variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Icon name="Check" className="w-3.5 h-3.5 text-success" />
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setIsRenaming(false)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                  >
                    <Icon name="X" className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </form>
              ) : (
                <h3
                  className="font-semibold text-xs text-foreground truncate"
                  title={snapshot.displayName || snapshot.email}
                >
                  {snapshot.displayName || snapshot.email}
                </h3>
              )}

              <StatusBadge
                status={snapshot.status}
                errorMessage={snapshot.errorMessage}
                isGooglePrimary={isGooglePrimary}
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {relativeSyncTime && (
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  Updated {relativeSyncTime}
                </span>
              )}

              {/* Three dots kebab menu */}
              <div className="relative" ref={menuRef}>
                <Button
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground rounded-md"
                  title="More actions"
                >
                  <Icon name="MoreVertical" className="w-3.5 h-3.5" />
                </Button>

                {isMenuOpen && (
                  <div className="absolute right-0 top-7 z-30 w-52 rounded-lg bg-surface border border-border shadow-lg py-1 text-xs font-sans animate-in fade-in-50 duration-100">
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onRefresh(snapshot.accountId);
                      }}
                      className="w-full px-3 py-1.5 text-left text-foreground hover:bg-muted/50 flex items-center gap-2"
                    >
                      <Icon name="RefreshCw" className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Refresh Quota</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleConnectGoogleOAuth();
                      }}
                      className="w-full px-3 py-1.5 text-left text-foreground hover:bg-muted/50 flex items-center gap-2"
                    >
                      <Icon name="Key" className="w-3.5 h-3.5 text-blue-400" />
                      <span>{isGooglePrimary ? 'Reconnect Google OAuth' : 'Connect Google OAuth'}</span>
                    </button>

                    {isGooglePrimary && (
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          handleDisconnectGoogleOAuth();
                        }}
                        className="w-full px-3 py-1.5 text-left text-foreground hover:bg-muted/50 flex items-center gap-2"
                      >
                        <Icon name="LogOut" className="w-3.5 h-3.5 text-amber-400" />
                        <span>Disconnect Google OAuth</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onToggleEnabled(snapshot.accountId, isDisabled);
                      }}
                      className="w-full px-3 py-1.5 text-left text-foreground hover:bg-muted/50 flex items-center gap-2"
                    >
                      <Icon
                        name={isDisabled ? 'Play' : 'Pause'}
                        className="w-3.5 h-3.5 text-muted-foreground"
                      />
                      <span>{isDisabled ? 'Enable Monitoring' : 'Disable Monitoring'}</span>
                    </button>

                    {onToggleAutoConnect && (
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          const currentAuto = snapshot.autoConnect ?? true;
                          onToggleAutoConnect(snapshot.accountId, !currentAuto);
                        }}
                        className="w-full px-3 py-1.5 text-left text-foreground hover:bg-muted/50 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <Icon name="Zap" className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Auto-connect on startup</span>
                        </div>
                        <span className="text-[10px] font-semibold text-primary">
                          {(snapshot.autoConnect ?? true) ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        setNewDisplayName(snapshot.displayName || snapshot.email);
                        setIsRenaming(true);
                      }}
                      className="w-full px-3 py-1.5 text-left text-foreground hover:bg-muted/50 flex items-center gap-2"
                    >
                      <Icon name="Edit2" className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Rename Account</span>
                    </button>

                    <div className="my-1 border-t border-border" />

                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsConfirmingRemove(true);
                      }}
                      className="w-full px-3 py-1.5 text-left text-destructive hover:bg-destructive/10 flex items-center gap-2"
                    >
                      <Icon name="Trash2" className="w-3.5 h-3.5 text-destructive" />
                      <span>Remove Account</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground truncate">
            {snapshot.tier || 'Standard Tier'} · {snapshot.email}
          </div>
        </CardHeader>

        {/* Card Content */}
        <CardContent className="p-3.5 space-y-3 flex-1">
          {/* Stale Data Warning Banner */}
          {isStale && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning font-sans">
              <Icon name="AlertTriangle" className="w-3.5 h-3.5 shrink-0" />
              <span>Using last known quota {relativeSyncTime ? `· Last updated ${relativeSyncTime}` : ''}</span>
            </div>
          )}

          {/* Identity Mismatch / Reauthorization / Offline Banner */}
          {(snapshot.status === 'AuthRequired' || snapshot.status === 'ReauthorizationRequired' || !snapshot.quota) && (
            <div>
              {isMismatch ? (
                <div className="p-3.5 rounded-xl bg-muted/25 border border-border/70 text-xs space-y-2.5 font-sans">
                  <div className="flex items-center gap-2 text-warning font-semibold text-xs">
                    <Icon name="AlertTriangle" className="w-4 h-4 text-warning shrink-0" />
                    <span>Account Identity Mismatch</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground space-y-1 leading-relaxed">
                    <p>
                      Antigravity is currently authenticated as{' '}
                      <span className="font-semibold text-foreground font-mono">
                        {mismatchRuntimeEmail || 'another account'}
                      </span>
                    </p>
                    <p>
                      but this account is{' '}
                      <span className="font-semibold text-foreground font-mono">
                        {snapshot.email}
                      </span>
                      .
                    </p>
                  </div>
                </div>
              ) : snapshot.status === 'ReauthorizationRequired' || (isGooglePrimary && snapshot.errorMessage?.toLowerCase().includes('reauthorization')) ? (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs space-y-2 font-sans">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-400 text-xs">
                    <Icon name="Key" className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Google Reauthorization Required</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    {snapshot.errorMessage ||
                      snapshot.quota?.safeDiagnosticMessage ||
                      'Your Google authorization has expired or been revoked. Please reconnect your account.'}
                  </p>
                  <div className="pt-1">
                    <Button
                      size="sm"
                      onClick={handleConnectGoogleOAuth}
                      disabled={connectStage === 'connecting'}
                      className="h-6 text-[11px] px-2.5 bg-amber-600 hover:bg-amber-500 text-white gap-1 font-medium"
                    >
                      <Icon name="Key" className="w-3 h-3" />
                      <span>{connectStage === 'connecting' ? 'Reconnecting...' : 'Reconnect Google Account'}</span>
                    </Button>
                  </div>
                </div>
              ) : isGooglePrimary ? (
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-2 font-sans">
                  <div className="flex items-center gap-1.5 font-semibold text-blue-400 text-xs">
                    <Icon name="Key" className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Google Authentication Required</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    {snapshot.errorMessage ||
                      snapshot.quota?.safeDiagnosticMessage ||
                      'Google OAuth is disconnected or needs re-authentication. Click Connect Google OAuth to authorize.'}
                  </p>
                  <div className="pt-1">
                    <Button
                      size="sm"
                      onClick={handleConnectGoogleOAuth}
                      disabled={connectStage === 'connecting'}
                      className="h-6 text-[11px] px-2.5 bg-blue-600 hover:bg-blue-500 text-white gap-1"
                    >
                      <Icon name="Key" className="w-3 h-3" />
                      <span>{connectStage === 'connecting' ? 'Connecting...' : 'Connect Google OAuth'}</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-muted/25 border border-border/70 text-xs space-y-2 font-sans">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                    <Icon name="Cpu" className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Antigravity Local Runtime Offline</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    {snapshot.errorMessage ||
                      snapshot.quota?.safeDiagnosticMessage ||
                      'Antigravity is not currently running. Please launch Antigravity to monitor live quota.'}
                  </p>
                </div>
              )}

              {connectErrorMessage && (
                <div className="mt-2 p-1.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[10px] flex items-center gap-1">
                  <Icon name="AlertTriangle" className="w-3 h-3 shrink-0" />
                  <span className="truncate">{connectErrorMessage}</span>
                </div>
              )}

              {connectStatusMessage && (
                <div className="mt-2 p-1.5 rounded bg-primary/10 border border-primary/20 text-primary text-[10px] flex items-center gap-1 font-medium">
                  <Icon name="Loader2" className="w-3 h-3 animate-spin shrink-0" />
                  <span>{connectStatusMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* Monitoring Disabled Banner */}
          {isDisabled && (
            <div className="p-2 rounded-lg bg-muted/30 border text-xs text-muted-foreground flex items-center gap-2">
              <Icon name="Pause" className="w-3.5 h-3.5 shrink-0" />
              <span>Monitoring is paused for this account.</span>
            </div>
          )}

          {/* Account-Scoped Intelligent Orchestration Alerts */}
          {snapshot.status === 'Online' && (() => {
            const alerts = QuotaOrchestrationService.getAccountAlerts(snapshot).filter(
              (a) => a.type === 'quota_critical' || a.type === 'quota_warning' || a.type === 'reset_imminent'
            );
            if (alerts.length === 0) return null;
            return (
              <div className="space-y-1.5">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-sans border ${
                      alert.severity === 'critical'
                        ? 'bg-destructive/10 border-destructive/25 text-destructive'
                        : alert.severity === 'warning'
                        ? 'bg-warning/10 border-warning/25 text-warning'
                        : 'bg-primary/10 border-primary/20 text-primary'
                    }`}
                  >
                    <Icon
                      name={alert.severity === 'critical' || alert.severity === 'warning' ? 'AlertTriangle' : 'Clock'}
                      className="w-3.5 h-3.5 shrink-0"
                    />
                    <span className="font-semibold">{alert.title}:</span>
                    <span className="text-[11px] opacity-90">{alert.message}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Horizontal Quota Pool Groups Grid */}
          {(() => {
            const quotaGroups = groupModelsIntoQuotaPools(snapshot.quota?.models || []);

            if (quotaGroups.length > 0) {
              const anyHasWeekly = quotaGroups.some(
                (g) => g.weeklyRemainingFraction !== null && g.weeklyRemainingFraction !== undefined
              );

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 items-stretch">
                  {quotaGroups.map((group) => {
                    const remainingPctNumber = getRemainingPercentageNumber(
                      group.remainingFraction,
                      group.remainingPercentage
                    );
                    const pctFormatted = formatQuotaPercentage(
                      group.remainingFraction,
                      group.remainingPercentage
                    );
                    const shortCountdown = formatShortResetCountdown(group.resetAt);

                    const weeklyPctNumber = getRemainingPercentageNumber(
                      group.weeklyRemainingFraction,
                      group.weeklyRemainingPercentage
                    );
                    const weeklyPctFormatted = formatQuotaPercentage(
                      group.weeklyRemainingFraction,
                      group.weeklyRemainingPercentage
                    );
                    const weeklyCountdown = formatWeeklyResetCountdown(group.weeklyResetAt);
                    const hasWeekly =
                      group.weeklyRemainingFraction !== null &&
                      group.weeklyRemainingFraction !== undefined;

                    const isExpanded = expandedGroupIds.has(group.id);

                    return (
                      <div
                        key={group.id}
                        className="p-3 rounded-lg bg-muted/20 border border-border/70 flex flex-col space-y-2.5 font-sans hover:border-border transition-colors h-full"
                      >
                        {/* Slot 1: Short-Term Section */}
                        <div className="space-y-1.5">
                          {/* Header Row: Name & Percentage */}
                          <div className="flex items-center justify-between text-xs gap-1">
                            <span
                              className="font-bold text-foreground truncate text-xs"
                              title={group.groupName}
                            >
                              {group.groupName}
                            </span>
                            <span className="font-mono font-bold text-foreground text-xs shrink-0">
                              {pctFormatted}
                            </span>
                          </div>

                          {/* Short-term Progress Bar */}
                          <div className="w-full bg-muted/70 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                remainingPctNumber <= 15
                                  ? 'bg-amber-500'
                                  : remainingPctNumber <= 40
                                  ? 'bg-warning'
                                  : 'bg-primary'
                              }`}
                              style={{ width: `${remainingPctNumber}%` }}
                            />
                          </div>

                          {/* Short-term Metadata */}
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="truncate">
                              {group.isShared ? `${group.models.length} models · ` : 'Individual · '}
                              {shortCountdown} · {group.status === 'Available' ? 'Ready' : group.status}
                            </span>
                          </div>
                        </div>

                        {/* Slot 2: Weekly Section / Reserved Slot */}
                        {hasWeekly ? (
                          <div className="space-y-1.5 pt-1.5 border-t border-border/30">
                            <div className="flex items-center justify-between text-xs gap-1">
                              <span className="text-xs font-semibold text-foreground">
                                Weekly
                              </span>
                              <span className="font-mono font-bold text-foreground text-xs shrink-0">
                                {weeklyPctFormatted}
                              </span>
                            </div>

                            {/* Weekly Progress Bar (Blue / Sky) */}
                            <div className="w-full bg-muted/70 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500 bg-sky-500"
                                style={{ width: `${weeklyPctNumber}%` }}
                              />
                            </div>

                            {/* Weekly Metadata */}
                            <div className="text-[11px] text-muted-foreground">
                              {weeklyCountdown}
                            </div>
                          </div>
                        ) : anyHasWeekly ? (
                          /* Reserved empty slot to maintain vertical rhythm without fake data */
                          <div className="pt-1.5 border-t border-transparent min-h-[58px]" aria-hidden="true" />
                        ) : null}

                        {/* Slot 3: Footer / Models Section (Anchored to bottom) */}
                        <div className="mt-auto pt-1.5 border-t border-border/30 min-h-[26px] flex flex-col justify-center">
                          {group.isShared ? (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleGroup(group.id)}
                                className="w-full flex items-center justify-between text-[11px] font-medium text-muted-foreground hover:text-foreground py-0.5 transition-colors group/btn"
                              >
                                <span className="truncate">
                                  {isExpanded
                                    ? 'Hide models'
                                    : `${group.models.length} models using this quota`}
                                </span>
                                <Icon
                                  name={isExpanded ? 'ChevronDown' : 'ChevronRight'}
                                  className="w-3.5 h-3.5 text-muted-foreground group-hover/btn:text-foreground shrink-0 transition-transform"
                                />
                              </button>

                              {isExpanded && (
                                <div className="mt-1.5 pl-2 border-l-2 border-primary/40 space-y-1 max-h-32 overflow-y-auto pr-1 animate-in fade-in duration-150">
                                  {group.models.map((model) => (
                                    <div
                                      key={model.modelId}
                                      className="flex items-center justify-between text-[10px] gap-1"
                                    >
                                      <span
                                        className="text-foreground truncate flex-1"
                                        title={model.displayName}
                                      >
                                        {model.displayName}
                                      </span>
                                      <span className="text-[9px] text-muted-foreground shrink-0">
                                        {model.status === 'Available' ? 'Ready' : model.status}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          ) : (
                            /* Clean subtle spacer for individual models */
                            <div className="h-5" aria-hidden="true" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            if (snapshot.status === 'Online') {
              return (
                <div className="text-center py-3 text-xs text-muted-foreground font-sans">
                  Quota capacity connected.
                </div>
              );
            }

            return null;
          })()}
        </CardContent>

        {/* Card Footer */}
        <CardFooter className="py-2.5 px-4 border-t border-border/40 bg-muted/5 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Icon name="Clock" className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span>
              {relativeSyncTime ? `Updated ${relativeSyncTime}` : 'Not synced yet'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {(!snapshot.quota || snapshot.status !== 'Online') && (
              <>
                <Button
                  onClick={handleConnectGoogleOAuth}
                  disabled={connectStage !== 'idle' && connectStage !== 'failed'}
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs font-medium gap-1.5 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-all shadow-xs"
                >
                  <Icon name="Key" className="w-3.5 h-3.5 text-blue-400" />
                  <span>Connect Google</span>
                </Button>

                <Button
                  onClick={handleConnectLocalAntigravity}
                  disabled={connectStage !== 'idle' && connectStage !== 'failed'}
                  size="sm"
                  className="h-7 px-3 text-xs font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
                >
                  {connectStage === 'idle' && (
                    <>
                      <Icon name="Cpu" className="w-3.5 h-3.5" />
                      <span>Connect Antigravity</span>
                    </>
                  )}
                  {connectStage === 'detecting' && (
                    <>
                      <Icon name="Loader2" className="w-3.5 h-3.5 animate-spin" />
                      <span>Detecting...</span>
                    </>
                  )}
                  {connectStage === 'connecting' && (
                    <>
                      <Icon name="Loader2" className="w-3.5 h-3.5 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  )}
                  {connectStage === 'reading' && (
                    <>
                      <Icon name="Loader2" className="w-3.5 h-3.5 animate-spin" />
                      <span>Reading Quota...</span>
                    </>
                  )}
                  {connectStage === 'connected' && (
                    <>
                      <Icon name="CheckCircle" className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Connected</span>
                    </>
                  )}
                  {connectStage === 'failed' && (
                    <>
                      <Icon name="RefreshCw" className="w-3.5 h-3.5" />
                      <span>Retry Detection</span>
                    </>
                  )}
                </Button>
              </>
            )}

            <Button
              onClick={() => onRefresh(snapshot.accountId)}
              disabled={isRefreshing || isDisabled}
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs font-medium gap-1"
            >
              <Icon
                name={isRefreshing ? 'Loader2' : 'RefreshCw'}
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`}
              />
              <span>{isRefreshing ? 'Refreshing' : 'Refresh'}</span>
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Remove Account Confirmation Dialog */}
      {isConfirmingRemove && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <Card className="border-border bg-surface shadow-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                  <Icon name="AlertTriangle" className="w-4 h-4" />
                  Remove Account?
                </CardTitle>
                <CardDescription className="text-xs text-foreground font-semibold pt-1">
                  "{snapshot.displayName || snapshot.email}"
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>
                  This removes the account from quota monitoring in Developer Control Center.
                </p>
              </CardContent>
              <CardFooter className="pt-2 pb-3 flex items-center justify-end gap-2 border-t bg-muted/10">
                <Button
                  onClick={() => setIsConfirmingRemove(false)}
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    setIsConfirmingRemove(false);
                    await onRemove(snapshot.accountId);
                  }}
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                >
                  Remove Account
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function StatusBadge({
  status,
  errorMessage,
  isGooglePrimary,
}: {
  status: AccountPollingState;
  errorMessage?: string | null;
  isGooglePrimary?: boolean;
}) {
  switch (status) {
    case 'Online':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-success/10 text-success border border-success/30 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          Connected
        </span>
      );
    case 'Checking':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/30 shrink-0">
          <Icon name="Loader2" className="w-3 h-3 animate-spin" />
          Restoring...
        </span>
      );
    case 'ReauthorizationRequired':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Reauthorization Required
        </span>
      );
    case 'AuthRequired':
      if (isGooglePrimary) {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Google Auth Required
          </span>
        );
      }
      if (errorMessage?.includes('Account mismatch')) {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-warning/10 text-warning border border-warning/30 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-warning" />
            Account Mismatch
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-warning/10 text-warning border border-warning/30 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          Antigravity Offline
        </span>
      );
    case 'RateLimited':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-warning/10 text-warning border border-warning/30 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          Rate Limited
        </span>
      );
    case 'NetworkError':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/10 text-destructive border border-destructive/30 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
          Offline
        </span>
      );
    case 'ProviderError':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/10 text-destructive border border-destructive/30 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
          Error
        </span>
      );
    case 'Disabled':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
          Disabled
        </span>
      );
  }
}

function formatRelativeTime(timestampStr: string): string {
  const ts = Number(timestampStr);
  if (!ts || isNaN(ts)) return '';
  const diffSecs = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (diffSecs < 10) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins === 1) return '1m ago';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1h ago';
  return `${diffHours}h ago`;
}

function formatShortResetCountdown(resetAtStr: string | null | undefined): string {
  if (!resetAtStr) return 'Reset unavailable';

  const ts = Date.parse(resetAtStr) || Number(resetAtStr) * 1000;
  if (!ts || isNaN(ts)) {
    return `Reset: ${resetAtStr}`;
  }

  const diffMs = ts - Date.now();
  if (diffMs <= 0) return 'Resets now';

  const diffSecs = Math.floor(diffMs / 1000);
  const hours = Math.floor(diffSecs / 3600);
  const minutes = Math.floor((diffSecs % 3600) / 60);

  if (hours > 24) {
    return 'Reset tomorrow';
  }
  if (hours > 0 && minutes > 0) {
    return `Reset ${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  if (hours > 0) {
    return `Reset ${hours}h`;
  }
  if (minutes > 0) {
    return `Reset ${minutes}m`;
  }
  return `Reset ${diffSecs}s`;
}

function formatWeeklyResetCountdown(resetAtStr: string | null | undefined): string {
  if (!resetAtStr) return 'Weekly reset unavailable';

  const ts = Date.parse(resetAtStr) || Number(resetAtStr) * 1000;
  if (!ts || isNaN(ts)) {
    return `Reset: ${resetAtStr}`;
  }

  const diffMs = ts - Date.now();
  if (diffMs <= 0) return 'Resets now';

  const diffSecs = Math.floor(diffMs / 1000);
  const diffHours = Math.floor(diffSecs / 3600);
  const days = Math.floor(diffHours / 24);
  const hours = diffHours % 24;

  if (days > 0 && hours > 0) {
    return `Reset in ${days}d ${hours}h`;
  }
  if (days > 0) {
    return `Reset in ${days}d`;
  }
  if (diffHours > 0) {
    return `Reset in ${diffHours}h`;
  }
  const minutes = Math.floor((diffSecs % 3600) / 60);
  return `Reset in ${minutes}m`;
}

export interface QuotaGroupViewModel {
  id: string;
  groupName: string;
  remainingFraction: number | null;
  remainingPercentage: number | null;
  resetAt: string | null;
  weeklyRemainingFraction: number | null;
  weeklyRemainingPercentage: number | null;
  weeklyResetAt: string | null;
  status: string;
  isShared: boolean;
  models: ModelQuota[];
}

export function groupModelsIntoQuotaPools(models: ModelQuota[]): QuotaGroupViewModel[] {
  if (!models || models.length === 0) return [];

  const groupsMap = new Map<string, ModelQuota[]>();

  for (const model of models) {
    const nameLower = (model.displayName || model.modelId).toLowerCase();
    let family = 'other';
    if (nameLower.includes('gemini')) family = 'gemini';
    else if (nameLower.includes('claude')) family = 'claude';
    else if (nameLower.includes('gpt')) family = 'gpt';
    else if (nameLower.includes('deepseek')) family = 'deepseek';

    // Format fraction to 4 decimal places to avoid floating point mismatch
    const fractionKey =
      model.remainingFraction !== null && model.remainingFraction !== undefined
        ? Number(model.remainingFraction).toFixed(4)
        : 'null';
    const resetKey = model.resetAt || 'none';
    const statusKey = model.status || 'unknown';

    const groupKey = `${family}::${fractionKey}::${resetKey}::${statusKey}`;

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, []);
    }
    groupsMap.get(groupKey)!.push(model);
  }

  const getFamilyRank = (fam: string): number => {
    switch (fam) {
      case 'gemini':
        return 1;
      case 'claude':
        return 2;
      case 'gpt':
        return 3;
      case 'deepseek':
        return 4;
      default:
        return 5;
    }
  };

  const result: QuotaGroupViewModel[] = [];

  for (const [key, groupModels] of groupsMap.entries()) {
    // Sort models deterministically inside each group by display name / modelId
    groupModels.sort((a, b) => {
      const nameA = a.displayName || a.modelId;
      const nameB = b.displayName || b.modelId;
      return nameA.localeCompare(nameB);
    });

    const isShared = groupModels.length > 1;
    const first = groupModels[0];

    let groupName = first.displayName || first.modelId;
    if (isShared) {
      const family = key.split('::')[0];
      if (family === 'gemini') groupName = 'Gemini Shared';
      else if (family === 'claude') groupName = 'Claude Shared';
      else if (family === 'gpt') groupName = 'GPT Shared';
      else if (family === 'deepseek') groupName = 'DeepSeek Shared';
      else groupName = 'Shared Quota';
    }

    result.push({
      id: key,
      groupName,
      remainingFraction: first.remainingFraction,
      remainingPercentage: first.remainingPercentage,
      resetAt: first.resetAt,
      weeklyRemainingFraction: first.weeklyRemainingFraction ?? null,
      weeklyRemainingPercentage: first.weeklyRemainingPercentage ?? null,
      weeklyResetAt: first.weeklyResetAt ?? null,
      status: first.status,
      isShared,
      models: groupModels,
    });
  }

  // Sort groups deterministically: Gemini -> Claude -> GPT -> DeepSeek -> Other -> Alphabetical
  result.sort((a, b) => {
    const famA = a.id.split('::')[0];
    const famB = b.id.split('::')[0];
    const rankA = getFamilyRank(famA);
    const rankB = getFamilyRank(famB);
    if (rankA !== rankB) return rankA - rankB;
    return a.groupName.localeCompare(b.groupName);
  });

  return result;
}

function formatQuotaPercentage(
  fraction: number | null | undefined,
  percentage: number | null | undefined
): string {
  if (percentage !== null && percentage !== undefined && !isNaN(percentage)) {
    return `${Number(percentage).toFixed(1)}%`;
  }
  if (fraction !== null && fraction !== undefined && !isNaN(fraction)) {
    return `${(Number(fraction) * 100).toFixed(1)}%`;
  }
  return '100.0%';
}

function getRemainingPercentageNumber(
  fraction: number | null | undefined,
  percentage: number | null | undefined
): number {
  if (percentage !== null && percentage !== undefined && !isNaN(percentage)) {
    return Math.max(0, Math.min(100, Math.round(percentage)));
  }
  if (fraction !== null && fraction !== undefined && !isNaN(fraction)) {
    return Math.max(0, Math.min(100, Math.round(fraction * 100)));
  }
  return 100;
}
