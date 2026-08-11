import { AIProvider } from '../types/aiProvider';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { cn } from '@/shared/utils';

interface AIProviderCardProps {
  provider: AIProvider;
  onEdit: (provider: AIProvider) => void;
  onTestConnection: (id: string) => void;
}

export function AIProviderCard({ provider, onEdit, onTestConnection }: AIProviderCardProps) {
  const getStatusDisplay = () => {
    switch (provider.connectionStatus) {
      case 'Connected':
        return { icon: 'CheckCircle2', color: 'text-green-500', bg: 'bg-green-500/10' };
      case 'Failed':
        return { icon: 'XCircle', color: 'text-red-500', bg: 'bg-red-500/10' };
      case 'Connecting':
        return { icon: 'Loader2', color: 'text-blue-500', bg: 'bg-blue-500/10', spin: true };
      default:
        return { icon: 'MinusCircle', color: 'text-muted-foreground', bg: 'bg-muted/20' };
    }
  };

  const status = getStatusDisplay();

  return (
    <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
      <CardContent className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground truncate">{provider.displayName}</span>
            <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border/50 text-[10px] font-medium uppercase tracking-wide", status.bg, status.color)}>
              <Icon name={status.icon as any} size={12} className={cn("w-3 h-3 shrink-0", status.spin && "animate-spin")} />
              {provider.connectionStatus}
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground truncate">{provider.model}</div>
          <div className="text-xs text-muted-foreground/60 truncate font-mono">{provider.baseUrl}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onTestConnection(provider.id)}
            disabled={provider.connectionStatus === 'Connecting'}
            className="h-8 gap-2 bg-muted/20"
          >
            <Icon name="Activity" size={14} className="w-3.5 h-3.5 shrink-0" />
            Test Connection
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onEdit(provider)}
            className="h-8 gap-2 bg-muted/20"
          >
            <Icon name="Settings2" size={14} className="w-3.5 h-3.5 shrink-0" />
            Edit
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-muted/20 hover:text-danger">
            <Icon name="Trash2" size={14} className="w-3.5 h-3.5 shrink-0" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
