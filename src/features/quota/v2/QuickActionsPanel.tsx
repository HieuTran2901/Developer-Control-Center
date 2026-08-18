import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';

interface QuickActionsPanelProps {
  onAddAccount: () => void;
  onRefreshAll: () => void;
  onReconnectAccounts: () => void;
  actionRequiredCount: number;
  isRefreshingAll: boolean;
}

export function QuickActionsPanel({
  onAddAccount,
  onRefreshAll,
  onReconnectAccounts,
  actionRequiredCount,
  isRefreshingAll,
}: QuickActionsPanelProps) {
  return (
    <div className="p-3.5 rounded-xl bg-surface border border-border/70 shadow-xs space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="Zap" className="w-3.5 h-3.5 text-primary" />
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
          Quick Actions
        </h3>
      </div>

      <div className="space-y-1.5">
        {/* Add Google Account */}
        <Button
          size="sm"
          variant="outline"
          onClick={onAddAccount}
          className="w-full justify-start h-8 text-xs font-medium bg-surface/60 hover:bg-muted text-foreground gap-2 border-border/70"
        >
          <div className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[10px]">
            G
          </div>
          <span>Add Google Account</span>
        </Button>

        {/* Reconnect Accounts (if any) */}
        {actionRequiredCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={onReconnectAccounts}
            className="w-full justify-start h-8 text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 gap-2 border-amber-500/30"
          >
            <Icon name="Key" className="w-3.5 h-3.5 text-amber-400" />
            <span>Reconnect Accounts ({actionRequiredCount})</span>
          </Button>
        )}

        {/* Refresh All */}
        <Button
          size="sm"
          variant="outline"
          onClick={onRefreshAll}
          disabled={isRefreshingAll}
          className="w-full justify-start h-8 text-xs font-medium bg-surface/60 hover:bg-muted text-foreground gap-2 border-border/70"
        >
          <Icon
            name={isRefreshingAll ? 'Loader2' : 'RotateCw'}
            className={`w-3.5 h-3.5 text-primary ${isRefreshingAll ? 'animate-spin' : ''}`}
          />
          <span>{isRefreshingAll ? 'Refreshing All...' : 'Refresh All'}</span>
        </Button>

        {/* View Orchestration Logs */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {}}
          className="w-full justify-start h-8 text-xs font-medium text-muted-foreground hover:text-foreground gap-2"
        >
          <Icon name="FileText" className="w-3.5 h-3.5" />
          <span>View Orchestration Logs</span>
        </Button>

        {/* Orchestration Settings */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {}}
          className="w-full justify-start h-8 text-xs font-medium text-muted-foreground hover:text-foreground gap-2"
        >
          <Icon name="Settings" className="w-3.5 h-3.5" />
          <span>Orchestration Settings</span>
        </Button>
      </div>
    </div>
  );
}
