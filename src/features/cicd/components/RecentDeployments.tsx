import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Icon } from '@/shared/components/ui/Icon';
import { Button } from '@/shared/components/ui/button';
import { mockDeployments, Status } from '../data/mockCICDData';
import { cn } from '@/shared/utils';

export function RecentDeployments() {
  const getStatusIcon = (status: Status) => {
    switch (status) {
      case 'Success':
        return { name: 'CheckCircle2', color: 'text-green-500' };
      case 'Failed':
        return { name: 'XCircle', color: 'text-red-500' };
      case 'Running':
        return { name: 'Loader2', color: 'text-blue-500', className: 'animate-spin' };
      default:
        return { name: 'MinusCircle', color: 'text-muted-foreground' };
    }
  };

  return (
    <Card className="col-span-1 bg-card/40 border-border/40 backdrop-blur-sm flex flex-col h-full">
      <CardHeader className="p-4 border-b border-border/20 flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-sm font-semibold">Recent Deployments</CardTitle>
        <button className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 group">
          View all
          <Icon name="ArrowRight" size={12} className="group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden flex flex-col flex-1">
        {/* Table Header */}
        <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_40px] gap-2 px-5 py-2 bg-muted/10 border-b border-border/20 text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">
          <div>Environment</div>
          <div>Status</div>
          <div>Version</div>
          <div>Deployed</div>
          <div></div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto">
          {mockDeployments.map((dep) => {
            const statusStyle = getStatusIcon(dep.status);
            
            return (
              <div 
                key={dep.id}
                className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_40px] gap-2 px-5 py-2 border-b border-border/20 hover:bg-muted/10 transition-colors items-center"
              >
                {/* ENVIRONMENT */}
                <div className="text-xs font-medium text-foreground truncate pr-2">
                  {dep.environment}
                </div>

                {/* STATUS */}
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <Icon 
                    name={statusStyle.name as any} 
                    size={14} 
                    className={cn("w-3.5 h-3.5 shrink-0", statusStyle.color, statusStyle.className)} 
                  />
                  <span className={cn("text-xs font-medium truncate", statusStyle.color)}>
                    {dep.status}
                  </span>
                </div>

                {/* VERSION */}
                <div className="text-xs font-mono text-muted-foreground truncate">
                  {dep.version}
                </div>

                {/* DEPLOYED */}
                <div className="overflow-hidden">
                  <div className="text-xs text-muted-foreground truncate">{dep.deployedAt}</div>
                  <div className="text-[10px] text-muted-foreground truncate">by {dep.deployedBy}</div>
                </div>

                {/* ACTIONS */}
                <div className="flex items-center justify-end">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                    <Icon name="MoreHorizontal" size={14} className="w-3.5 h-3.5 shrink-0" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
