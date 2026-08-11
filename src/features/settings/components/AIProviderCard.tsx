import { AIProvider } from '../types/aiProvider';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { cn } from '@/shared/utils';

interface AIProviderCardProps {
  provider: AIProvider;
  onEdit: (provider: AIProvider) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  onTestConnection: (id: string) => void;
}

export function AIProviderCard({
  provider,
  onEdit,
  onDelete,
  onSetDefault,
  onTestConnection,
}: AIProviderCardProps) {
  const getStatusDisplay = () => {
    switch (provider.status) {
      case 'CONNECTED':
        return { label: 'Connected', icon: 'CheckCircle2', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' };
      case 'FAILED':
        return { label: 'Connection Failed', icon: 'XCircle', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' };
      case 'TESTING':
        return { label: 'Testing...', icon: 'Loader2', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', spin: true };
      case 'DISABLED':
        return { label: 'Disabled', icon: 'MinusCircle', color: 'text-muted-foreground', bg: 'bg-muted/20 border-border/40' };
      case 'UNTESTED':
      default:
        return { label: 'Untested', icon: 'HelpCircle', color: 'text-muted-foreground', bg: 'bg-muted/20 border-border/40' };
    }
  };

  const status = getStatusDisplay();

  return (
    <Card className="bg-card/40 border-border/40 backdrop-blur-sm relative">
      <CardContent className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground text-base truncate">{provider.name}</span>
            
            {provider.isDefault && (
              <div className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                <Icon name="Star" size={10} className="w-2.5 h-2.5 fill-current shrink-0" />
                DEFAULT
              </div>
            )}

            <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wide shrink-0", status.bg, status.color)}>
              <Icon name={status.icon as any} size={12} className={cn("w-3 h-3 shrink-0", status.spin && "animate-spin")} />
              {status.label}
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-mono bg-muted/20 px-1.5 py-0.5 rounded border border-border/30">{provider.model}</span>
            <span className="capitalize text-muted-foreground/80 font-medium">{provider.providerType}</span>
          </div>

          <div className="text-xs text-muted-foreground/60 truncate font-mono mt-0.5">{provider.baseUrl}</div>

          {provider.status === 'FAILED' && provider.lastError && (
            <div className="text-xs text-red-400/90 mt-1 flex items-start gap-1.5 bg-red-500/5 p-2 rounded border border-red-500/10">
              <Icon name="AlertCircle" size={14} className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
              <span>{provider.lastError}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!provider.isDefault && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetDefault(provider.id)}
              className="h-8 gap-1.5 bg-muted/20 text-xs hover:text-purple-400"
              title="Set as Default Provider"
            >
              <Icon name="Star" size={12} className="w-3 h-3 shrink-0" />
              Set Default
            </Button>
          )}

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onTestConnection(provider.id)}
            disabled={provider.status === 'TESTING'}
            className="h-8 gap-1.5 bg-muted/20 text-xs"
          >
            <Icon name="Activity" size={12} className="w-3 h-3 shrink-0" />
            {provider.status === 'TESTING' ? 'Testing...' : 'Test Connection'}
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onEdit(provider)}
            className="h-8 gap-1.5 bg-muted/20 text-xs"
          >
            <Icon name="Settings2" size={12} className="w-3 h-3 shrink-0" />
            Edit
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onDelete(provider.id)}
            className="h-8 w-8 p-0 bg-muted/20 hover:text-red-400 hover:border-red-500/30"
            title="Delete Provider"
          >
            <Icon name="Trash2" size={14} className="w-3.5 h-3.5 shrink-0" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
