import React from 'react';
import { Icon } from './Icon';
import { cn } from '@/shared/utils';

interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
}

export function LoadingState({ message = 'Loading...', className, ...props }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500", className)} {...props}>
      <Icon name="Loader2" size={32} className="animate-spin text-primary mb-4" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
