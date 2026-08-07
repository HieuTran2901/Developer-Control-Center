import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Icon } from '@/shared/components/ui/Icon';
import { Alert } from '@/domain/entities/Alert';
import { EventBus, EventType } from '@/application/events/EventBus';
import { ScrollArea } from '@/shared/components/ui/scroll-area';

export function AlertPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const unsub = EventBus.subscribe<Alert[]>(EventType.AlertTriggered, (newAlerts) => {
      setAlerts([...newAlerts]);
    });
    return () => unsub();
  }, []);

  const getAlertIcon = (type: string) => {
    switch(type) {
      case 'cpu_high': return <Icon name="Cpu" size={14} className="text-orange-400" />;
      case 'mem_high': return <Icon name="Database" size={14} className="text-orange-400" />;
      case 'crash': return <Icon name="AlertOctagon" size={14} className="text-destructive" />;
      case 'restart_loop': return <Icon name="RefreshCw" size={14} className="text-destructive" />;
      default: return <Icon name="AlertTriangle" size={14} className="text-yellow-400" />;
    }
  };

  if (alerts.length === 0) return null;

  return (
    <Card className="border-orange-500/30 bg-orange-500/5 mt-4">
      <CardHeader className="py-3 px-4 flex flex-row items-center space-y-0">
        <Icon name="Bell" size={16} className="text-orange-500 mr-2 animate-pulse" />
        <CardTitle className="text-sm font-medium text-orange-500">System Alerts</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ScrollArea className="h-[120px] pr-4">
          <div className="space-y-2">
            {alerts.map(alert => (
              <div key={alert.id} className="flex items-start space-x-3 text-sm bg-background/50 p-2 rounded-md border border-border/40">
                <div className="mt-0.5 shrink-0">{getAlertIcon(alert.type)}</div>
                <div className="flex-1">
                  <div className="font-medium">{alert.message}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex justify-between">
                    <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    {alert.pid && <span>PID: {alert.pid}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}


