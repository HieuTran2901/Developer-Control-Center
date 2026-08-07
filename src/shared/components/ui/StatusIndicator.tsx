import { cn } from '@/shared/utils';
import { ProcessState } from '@/domain/entities/ProcessState';

interface StatusIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  status: ProcessState | 'success' | 'warning';
  pulse?: boolean;
}

export function StatusIndicator({ status, pulse = false, className, ...props }: StatusIndicatorProps) {
  const statusConfig: Record<string, string> = {
    [ProcessState.Starting]: 'bg-info text-info-foreground shadow-info/30',
    [ProcessState.Running]: 'bg-success text-success-foreground shadow-success/30',
    [ProcessState.Stopping]: 'bg-warning text-warning-foreground shadow-warning/30',
    [ProcessState.Stopped]: 'bg-muted-foreground text-background shadow-muted-foreground/30',
    [ProcessState.Idle]: 'bg-muted-foreground text-background shadow-muted-foreground/30',
    [ProcessState.Failed]: 'bg-danger text-danger-foreground shadow-danger/30',
    [ProcessState.Exited]: 'bg-muted-foreground text-background shadow-muted-foreground/30',
    [ProcessState.Restarting]: 'bg-info text-info-foreground shadow-info/30',
    success: 'bg-success text-success-foreground shadow-success/30',
    warning: 'bg-warning text-warning-foreground shadow-warning/30',
  };

  return (
    <div className={cn('flex items-center space-x-2', className)} {...props}>
      <span className="relative flex h-3 w-3">
        {pulse && (
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', statusConfig[status])} />
        )}
        <span className={cn('relative inline-flex h-3 w-3 rounded-full shadow-sm', statusConfig[status])} />
      </span>
      <span className="text-sm font-medium capitalize text-muted-foreground">
        {status}
      </span>
    </div>
  );
}
