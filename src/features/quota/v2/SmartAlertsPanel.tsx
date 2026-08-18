import { Icon } from '@/shared/components/ui/Icon';
import { AccountAlert } from '@/domain/services/QuotaOrchestrationService';

interface SmartAlertsPanelProps {
  alerts: { alert: AccountAlert; accountName: string }[];
  onReconnectAccount?: (accountId: string) => void;
}

export function SmartAlertsPanel({ alerts, onReconnectAccount }: SmartAlertsPanelProps) {
  return (
    <div className="p-3.5 rounded-xl bg-surface border border-border/70 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Bell" className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Smart Alerts
          </h3>
        </div>
        <span className="text-[10px] text-muted-foreground hover:text-primary cursor-pointer">
          {alerts.length} active
        </span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {alerts.length === 0 ? (
          <div className="text-center py-4 text-xs text-muted-foreground space-y-1">
            <Icon name="CheckCircle2" className="w-5 h-5 text-success mx-auto opacity-80" />
            <p className="text-[11px]">All accounts operating normally</p>
          </div>
        ) : (
          alerts.slice(0, 5).map(({ alert, accountName }) => {
            const isCritical = alert.severity === 'critical';
            const isWarning = alert.severity === 'warning';
            const isAuth = alert.type === 'auth_required' || alert.type === 'reauth_required';

            return (
              <div
                key={alert.id}
                className={`p-2 rounded-lg border text-xs font-sans space-y-1 transition-all ${
                  isCritical
                    ? 'bg-destructive/10 border-destructive/25 text-foreground'
                    : isWarning
                    ? 'bg-warning/10 border-warning/25 text-foreground'
                    : 'bg-primary/10 border-primary/20 text-foreground'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 font-bold text-[11px]">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isCritical ? 'bg-destructive' : isWarning ? 'bg-warning' : 'bg-primary'
                      }`}
                    />
                    <span className="truncate max-w-[120px]">{accountName}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {alert.title}
                  </span>
                </div>

                <div className="text-[11px] text-muted-foreground leading-tight">
                  {alert.message}
                </div>

                {isAuth && onReconnectAccount && (
                  <div className="pt-0.5">
                    <button
                      onClick={() => onReconnectAccount(alert.accountId)}
                      className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 underline"
                    >
                      Click to reconnect →
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
