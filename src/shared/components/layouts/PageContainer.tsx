import { cn } from '@/shared/utils';

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageContainer({ title, description, actions, className, children, ...props }: PageContainerProps) {
  return (
    <div className={cn("flex flex-col h-full w-full", className)} {...props}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/50 shrink-0">
          <div>
            {title && <h1 className="text-display text-2xl font-bold tracking-tight">{title}</h1>}
            {description && <p className="text-muted-foreground mt-1.5 text-sm">{description}</p>}
          </div>
          {actions && <div className="flex items-center space-x-3">{actions}</div>}
        </div>
      )}
      <div className="flex-1 w-full min-h-0 flex flex-col">
        {children}
      </div>
    </div>
  );
}
