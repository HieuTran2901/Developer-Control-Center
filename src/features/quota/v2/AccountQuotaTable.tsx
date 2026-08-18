import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { AccountQuotaSnapshot } from '@/domain/entities/QuotaPolling';
import { RankedAccount, QuotaOrchestrationService } from '@/domain/services/QuotaOrchestrationService';

interface AccountQuotaTableProps {
  snapshots: AccountQuotaSnapshot[];
  rankedAccounts: RankedAccount[];
  onRefreshAccount: (accountId: string) => Promise<void>;
  onReconnectAccount: (accountId: string) => Promise<void>;
  onDisconnectAccount: (accountId: string) => Promise<void>;
  onToggleEnabled: (accountId: string, enabled: boolean) => Promise<void>;
  onRenameAccount: (accountId: string, displayName: string | null) => Promise<void>;
  onRemoveAccount: (accountId: string) => Promise<void>;
  onUseAccount?: (accountId: string) => void;
  refreshingAccountId: string | null;
}

export function AccountQuotaTable({
  snapshots,
  rankedAccounts,
  onRefreshAccount,
  onReconnectAccount,
  onDisconnectAccount,
  onToggleEnabled,
  onRenameAccount,
  onRemoveAccount,
  onUseAccount,
  refreshingAccountId,
}: AccountQuotaTableProps) {
  const [activeMenuAccountId, setActiveMenuAccountId] = useState<string | null>(null);
  const [renamingAccountId, setRenamingAccountId] = useState<string | null>(null);
  const [newDisplayName, setNewDisplayName] = useState<string>('');

  const getRankInfo = (accountId: string) => {
    return rankedAccounts.find((r) => r.accountId === accountId);
  };

  const getAvatarColor = (idx: number, isOnline: boolean) => {
    if (!isOnline) return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    const colors = [
      'bg-success/20 text-success border-success/40',
      'bg-primary/20 text-primary border-primary/40',
      'bg-purple-500/20 text-purple-400 border-purple-500/40',
      'bg-blue-500/20 text-blue-400 border-blue-500/40',
      'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    ];
    return colors[idx % colors.length];
  };

  const getInitials = (name: string, email: string) => {
    const match = name.match(/account\s*(\d+)/i);
    if (match) return `A${match[1]}`;
    if (email) return email.slice(0, 2).toUpperCase();
    return 'A';
  };

  const formatRelativeTime = (lastSyncAt: string | null) => {
    if (!lastSyncAt) return 'Never';
    const now = Math.floor(Date.now() / 1000);
    const syncTime = Number(lastSyncAt);
    if (isNaN(syncTime) || syncTime === 0) return 'Never';
    const diff = Math.max(0, now - syncTime);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const handleStartRename = (accountId: string, currentName: string) => {
    setRenamingAccountId(accountId);
    setNewDisplayName(currentName);
    setActiveMenuAccountId(null);
  };

  const handleSaveRename = async (accountId: string) => {
    if (renamingAccountId) {
      await onRenameAccount(accountId, newDisplayName.trim() || null);
      setRenamingAccountId(null);
    }
  };

  // Explicit, deterministic state badges
  const getSubBadge = (s: AccountQuotaSnapshot) => {
    const isMismatch = s.errorMessage?.includes('Account mismatch') || (s.status === 'AuthRequired' && s.errorMessage?.toLowerCase().includes('mismatch'));
    const isAuthReq = (s.status === 'AuthRequired' && !isMismatch) || s.status === 'ReauthorizationRequired';
    const isStale = s.dataQuality === 'Stale';
    const isDisabled = s.status === 'Disabled';
    const isChecking = s.status === 'Checking';
    const isNetworkError = s.status === 'NetworkError';
    const isProviderError = s.status === 'ProviderError';
    const isRateLimited = s.status === 'RateLimited';
    const isOnline = s.status === 'Online' && s.quota !== null;

    if (isMismatch) {
      return { label: 'Account Mismatch', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25' };
    }
    if (isAuthReq) {
      return { label: 'Auth Required', color: 'bg-destructive/15 text-destructive border-destructive/25' };
    }
    if (isStale) {
      return { label: 'Stale', color: 'bg-purple-500/15 text-purple-400 border-purple-500/25' };
    }
    if (isChecking) {
      return { label: 'Checking', color: 'bg-primary/15 text-primary border-primary/25' };
    }
    if (isNetworkError) {
      return { label: 'Network Error', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25' };
    }
    if (isProviderError) {
      return { label: 'Provider Error', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25' };
    }
    if (isRateLimited) {
      return { label: 'Rate Limited', color: 'bg-warning/15 text-warning border-warning/25' };
    }
    if (isDisabled) {
      return { label: 'Disabled', color: 'bg-muted/30 text-muted-foreground border-border/40' };
    }
    if (isOnline) {
      return { label: 'Connected', color: 'bg-success/15 text-success border-success/25' };
    }
    return { label: 'Sync Pending', color: 'bg-muted/40 text-muted-foreground border-border/60' };
  };

  const getStatusPresentation = (s: AccountQuotaSnapshot, rankInfo?: RankedAccount) => {
    const isMismatch = s.errorMessage?.includes('Account mismatch') || (s.status === 'AuthRequired' && s.errorMessage?.toLowerCase().includes('mismatch'));
    const isAuthReq = (s.status === 'AuthRequired' && !isMismatch) || s.status === 'ReauthorizationRequired';
    const isStale = s.dataQuality === 'Stale';
    const isDisabled = s.status === 'Disabled';
    const isChecking = s.status === 'Checking';
    const isNetworkError = s.status === 'NetworkError';
    const isProviderError = s.status === 'ProviderError';
    const isRateLimited = s.status === 'RateLimited';
    const isOnline = s.status === 'Online' && s.quota !== null;

    if (isMismatch) {
      return {
        dotColor: 'bg-amber-400',
        textColor: 'text-amber-400',
        label: 'Account Mismatch',
        sublabel: 'Local runtime mismatch',
      };
    }
    if (isAuthReq) {
      return {
        dotColor: 'bg-destructive',
        textColor: 'text-destructive',
        label: 'Auth Required',
        sublabel: 'Reauthentication needed',
      };
    }
    if (isStale) {
      return {
        dotColor: 'bg-purple-400',
        textColor: 'text-purple-400',
        label: 'Stale Data',
        sublabel: 'Sync delayed',
      };
    }
    if (isChecking) {
      return {
        dotColor: 'bg-primary animate-pulse',
        textColor: 'text-primary',
        label: 'Checking...',
        sublabel: 'Verifying quota',
      };
    }
    if (isNetworkError) {
      return {
        dotColor: 'bg-amber-400',
        textColor: 'text-amber-400',
        label: 'Network Error',
        sublabel: 'Connection failed',
      };
    }
    if (isProviderError) {
      return {
        dotColor: 'bg-amber-400',
        textColor: 'text-amber-400',
        label: 'Provider Error',
        sublabel: 'API error',
      };
    }
    if (isRateLimited) {
      return {
        dotColor: 'bg-warning',
        textColor: 'text-warning',
        label: 'Rate Limited',
        sublabel: 'Request cooldown',
      };
    }
    if (isDisabled) {
      return {
        dotColor: 'bg-muted-foreground',
        textColor: 'text-muted-foreground',
        label: 'Disabled',
        sublabel: 'Monitoring paused',
      };
    }
    if (isOnline) {
      if (rankInfo?.health.health5h === 'Warning' || rankInfo?.health.healthWeekly === 'Warning') {
        return {
          dotColor: 'bg-warning',
          textColor: 'text-warning',
          label: 'Warning',
          sublabel: 'Online · Low quota',
        };
      }
      if (rankInfo?.health.health5h === 'Critical' || rankInfo?.health.healthWeekly === 'Critical') {
        return {
          dotColor: 'bg-destructive',
          textColor: 'text-destructive',
          label: 'Critical',
          sublabel: 'Online · Quota near 0',
        };
      }
      return {
        dotColor: 'bg-success',
        textColor: 'text-success',
        label: 'Healthy',
        sublabel: 'Online',
      };
    }
    return {
      dotColor: 'bg-muted-foreground',
      textColor: 'text-muted-foreground',
      label: 'Sync Pending',
      sublabel: 'Awaiting quota',
    };
  };

  return (
    <div className="rounded-xl border border-border/70 bg-surface/80 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-sans">
          <thead>
            <tr className="border-b border-border/60 bg-muted/20 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
              <th className="py-3 px-4 min-w-[220px]">Account</th>
              <th className="py-3 px-3 min-w-[120px]">Status</th>
              <th className="py-3 px-3 min-w-[160px]">5H Quota</th>
              <th className="py-3 px-3 min-w-[160px]">Weekly Quota</th>
              <th className="py-3 px-3 min-w-[110px]">Next Reset</th>
              <th className="py-3 px-3 min-w-[100px]">Last Updated</th>
              <th className="py-3 px-3 min-w-[150px]">Recommendation</th>
              <th className="py-3 px-4 text-right min-w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {snapshots.map((s, idx) => {
              const rankInfo = getRankInfo(s.accountId);
              const isRecommended = rankInfo?.rank === 1 && rankInfo.isEligible;
              const isOnline = s.status === 'Online' && s.quota !== null;
              const subBadge = getSubBadge(s);
              const statusPres = getStatusPresentation(s, rankInfo);

              const isAuthReq = s.status === 'AuthRequired' || s.status === 'ReauthorizationRequired';
              const isDisabled = s.status === 'Disabled';
              const models = s.quota?.models || [];
              const primaryModel = models[0];

              const pct5h = primaryModel?.remainingFraction !== null && primaryModel?.remainingFraction !== undefined
                ? Math.round(primaryModel.remainingFraction * 100)
                : null;
              const pctWeekly = primaryModel?.weeklyRemainingFraction !== null && primaryModel?.weeklyRemainingFraction !== undefined
                ? Math.round(primaryModel.weeklyRemainingFraction * 100)
                : null;

              const reset5hCountdown = QuotaOrchestrationService.getResetCountdown(primaryModel?.resetAt).formattedCountdown;
              const resetWeeklyCountdown = QuotaOrchestrationService.getResetCountdown(primaryModel?.weeklyResetAt).formattedCountdown;

              const isCurrentRefreshing = refreshingAccountId === s.accountId;

              return (
                <tr
                  key={s.accountId}
                  className={`hover:bg-muted/15 transition-colors group ${
                    isRecommended ? 'bg-primary/5' : ''
                  }`}
                >
                  {/* 1. Account Column */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      {/* Star for Recommended */}
                      <div className="w-4 shrink-0 text-center">
                        {isRecommended && (
                          <Icon name="Star" className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                        )}
                      </div>

                      {/* Avatar Badge */}
                      <div
                        className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs font-mono shrink-0 ${getAvatarColor(
                          idx,
                          isOnline
                        )}`}
                      >
                        {getInitials(s.displayName || s.email, s.email)}
                      </div>

                      {/* Name & Email & Tier */}
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {renamingAccountId === s.accountId ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={newDisplayName}
                                onChange={(e) => setNewDisplayName(e.target.value)}
                                className="h-6 px-1.5 text-xs bg-background border rounded text-foreground font-semibold"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => handleSaveRename(s.accountId)}
                              >
                                <Icon name="Check" className="w-3 h-3 text-success" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => setRenamingAccountId(null)}
                              >
                                <Icon name="X" className="w-3 h-3 text-muted-foreground" />
                              </Button>
                            </div>
                          ) : (
                            <span
                              className="font-bold text-foreground truncate max-w-[140px]"
                              title={s.displayName || s.email}
                            >
                              {s.displayName || s.email}
                            </span>
                          )}

                          {/* Sub-badge: Connected / Mismatch / Auth Required / Stale / Error / Checking */}
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0 ${subBadge.color}`}
                            title={
                              subBadge.label === 'Sync Pending'
                                ? 'Google account is authenticated, but quota data is currently unavailable. The Gemini Code Assist cloud project may not yet be provisioned or quota may not yet be available.'
                                : undefined
                            }
                          >
                            {subBadge.label}
                          </span>
                        </div>

                        <div className="text-[11px] text-muted-foreground truncate font-mono max-w-[180px]" title={s.email}>
                          {s.email}
                        </div>
                        <div className="text-[10px] text-muted-foreground/80">
                          {s.tier || 'Standard Tier'}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 2. Status Column */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <div
                      className="space-y-0.5"
                      title={
                        statusPres.label === 'Sync Pending'
                          ? 'Google account is authenticated, but quota data is currently unavailable. The Gemini Code Assist cloud project may not yet be provisioned or quota may not yet be available.'
                          : undefined
                      }
                    >
                      <div className={`flex items-center gap-1.5 font-semibold ${statusPres.textColor}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusPres.dotColor}`} />
                        <span>{statusPres.label}</span>
                        {statusPres.label === 'Sync Pending' && (
                          <span className="text-[10px] text-muted-foreground cursor-help" title="Google account is authenticated, but quota data is currently unavailable. The Gemini Code Assist cloud project may not yet be provisioned or quota may not yet be available.">
                            ℹ️
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {statusPres.sublabel}
                      </div>
                    </div>
                  </td>

                  {/* 3. 5H Quota Column */}
                  <td className="py-3.5 px-3">
                    {pct5h !== null ? (
                      <div className="space-y-1 max-w-[150px]">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="font-bold text-foreground">{pct5h.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              pct5h <= 20
                                ? 'bg-destructive'
                                : pct5h <= 50
                                ? 'bg-warning'
                                : 'bg-success'
                            }`}
                            style={{ width: `${pct5h}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {models.length} models · Resets in {reset5hCountdown}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5 text-muted-foreground">
                        <div className="font-mono text-xs">—</div>
                        <div className="text-[10px]">
                          {isAuthReq ? 'Reauthenticate' : s.status === 'Checking' ? 'Checking...' : 'No data'}
                        </div>
                      </div>
                    )}
                  </td>

                  {/* 4. Weekly Quota Column */}
                  <td className="py-3.5 px-3">
                    {pctWeekly !== null ? (
                      <div className="space-y-1 max-w-[150px]">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="font-bold text-foreground">{pctWeekly.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${pctWeekly}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          Weekly pool · Resets in {resetWeeklyCountdown}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5 text-muted-foreground">
                        <div className="font-mono text-xs">—</div>
                        <div className="text-[10px]">
                          {isAuthReq ? 'Reauthenticate' : s.status === 'Checking' ? 'Checking...' : 'No data'}
                        </div>
                      </div>
                    )}
                  </td>

                  {/* 5. Next Reset Column */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    {isOnline && reset5hCountdown !== 'Unknown' ? (
                      <div className="space-y-0.5">
                        <div className="font-bold text-foreground font-mono">{reset5hCountdown}</div>
                        <div className="text-[10px] text-muted-foreground">5H Window</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground font-mono">—</span>
                    )}
                  </td>

                  {/* 6. Last Updated Column */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-[11px]">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/60" />
                      <span>{formatRelativeTime(s.lastSuccessfulSyncAt)}</span>
                    </div>
                  </td>

                  {/* 7. Recommendation Column */}
                  <td className="py-3.5 px-3">
                    {rankInfo && rankInfo.isEligible && rankInfo.score > 0 ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground">
                            🏆 #{rankInfo.rank}
                          </span>
                          {rankInfo.rank === 1 ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-success/20 text-success">
                              Best Choice
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              {rankInfo.fraction5h && rankInfo.fraction5h > 0.5 ? 'Good 5H' : 'Average'}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          Confidence: {Math.round(rankInfo.score * 100)}%
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground">
                        {isAuthReq ? 'Authentication required' : statusPres.label}
                      </div>
                    )}
                  </td>

                  {/* 8. Actions Column */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap relative">
                    <div className="flex items-center justify-end gap-1.5">
                      {isAuthReq ? (
                        <Button
                          size="sm"
                          onClick={() => onReconnectAccount(s.accountId)}
                          className="h-6 text-[11px] px-2 bg-amber-600 hover:bg-amber-500 text-white font-medium gap-1 shadow-xs"
                        >
                          <Icon name="Key" className="w-3 h-3" />
                          <span>Reconnect</span>
                        </Button>
                      ) : isRecommended ? (
                        <Button
                          size="sm"
                          onClick={() => onUseAccount ? onUseAccount(s.accountId) : onRefreshAccount(s.accountId)}
                          className="h-6 text-[11px] px-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1 shadow-xs"
                        >
                          <span>Use</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRefreshAccount(s.accountId)}
                          disabled={isCurrentRefreshing}
                          className="h-6 text-[11px] px-2 bg-surface hover:bg-muted font-medium gap-1"
                        >
                          <Icon
                            name={isCurrentRefreshing ? 'Loader2' : 'RotateCw'}
                            className={`w-3 h-3 ${isCurrentRefreshing ? 'animate-spin' : ''}`}
                          />
                          <span>Refresh</span>
                        </Button>
                      )}

                      {/* Dropdown Menu Trigger */}
                      <div className="relative">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setActiveMenuAccountId(activeMenuAccountId === s.accountId ? null : s.accountId)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <Icon name="MoreVertical" className="w-3.5 h-3.5" />
                        </Button>

                        {/* Dropdown Menu Popup */}
                        {activeMenuAccountId === s.accountId && (
                          <div
                            className="absolute right-0 top-7 w-44 rounded-xl bg-surface border border-border/80 shadow-lg py-1.5 z-50 text-xs font-sans animate-in fade-in-50 duration-100"
                            onMouseLeave={() => setActiveMenuAccountId(null)}
                          >
                            <button
                              onClick={() => {
                                onRefreshAccount(s.accountId);
                                setActiveMenuAccountId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2 text-foreground"
                            >
                              <Icon name="RotateCw" className="w-3.5 h-3.5 text-primary" />
                              <span>Refresh Quota</span>
                            </button>

                            <button
                              onClick={() => {
                                onReconnectAccount(s.accountId);
                                setActiveMenuAccountId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2 text-foreground"
                            >
                              <Icon name="Key" className="w-3.5 h-3.5 text-amber-400" />
                              <span>Reconnect Google</span>
                            </button>

                            <button
                              onClick={() => {
                                onDisconnectAccount(s.accountId);
                                setActiveMenuAccountId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2 text-warning"
                            >
                              <Icon name="Unlink" className="w-3.5 h-3.5" />
                              <span>Disconnect Google</span>
                            </button>

                            <button
                              onClick={() => handleStartRename(s.accountId, s.displayName || s.email)}
                              className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2 text-foreground"
                            >
                              <Icon name="Edit2" className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>Rename Account</span>
                            </button>

                            <button
                              onClick={() => {
                                onToggleEnabled(s.accountId, isDisabled);
                                setActiveMenuAccountId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2 text-foreground"
                            >
                              <Icon name={isDisabled ? 'Play' : 'Pause'} className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{isDisabled ? 'Enable Monitoring' : 'Disable Monitoring'}</span>
                            </button>

                            <div className="my-1 border-t border-border/60" />

                            <button
                              onClick={() => {
                                onRemoveAccount(s.accountId);
                                setActiveMenuAccountId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-destructive/10 flex items-center gap-2 text-destructive"
                            >
                              <Icon name="Trash2" className="w-3.5 h-3.5" />
                              <span>Remove Account</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
