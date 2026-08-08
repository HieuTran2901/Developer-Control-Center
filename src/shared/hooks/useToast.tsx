import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Icon } from '@/shared/components/ui/Icon';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'error' | 'info';
}

interface ToastContextType {
  toasts: Toast[];
  toast: (options: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((options: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 11);
    setToasts(prev => [...prev, { id, ...options }]);
    
    // Auto remove after 3s
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, toast, removeToast }}>
      {children}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            role={t.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            style={{
              minWidth: '340px',
              width: '380px',
              maxWidth: '400px',
            }}
            className={`
              pointer-events-auto flex items-center gap-[12px]
              rounded-[12px] border
              pl-[16px] pr-[12px] py-[12px]
              shadow-[0_8px_24px_rgba(0,0,0,0.25)]
              animate-in fade-in slide-in-from-top-4 duration-200
              ${t.type === 'success' ? 'bg-surface border-success/40' : ''}
              ${t.type === 'error' ? 'bg-surface border-destructive/40' : ''}
              ${t.type === 'info' || !t.type ? 'bg-surface border-border/50' : ''}
            `}
          >
            <div className={`shrink-0 flex items-center justify-center w-[32px] h-[32px] rounded-full ${
              t.type === 'success' ? 'bg-success/10 text-success' : 
              t.type === 'error' ? 'bg-destructive/10 text-destructive' : 
              'bg-info/10 text-info'
            } ${t.description ? 'self-start mt-0.5' : ''}`}>
              {t.type === 'success' && <Icon name="CheckCircle2" size={18} />}
              {t.type === 'error' && <Icon name="XCircle" size={18} />}
              {(t.type === 'info' || !t.type) && <Icon name="Info" size={18} />}
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col justify-center">
              <h4 className="text-[14.5px] font-medium leading-[1.4] text-foreground truncate">{t.title}</h4>
              {t.description && <p className="text-[13px] font-normal leading-[1.4] text-muted-foreground mt-0.5 truncate">{t.description}</p>}
            </div>
            
            <button 
              onClick={() => removeToast(t.id)} 
              className="shrink-0 flex items-center justify-center w-[32px] h-[32px] rounded-md text-muted-foreground opacity-70 hover:opacity-100 hover:text-foreground hover:bg-muted/60 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-ring"
              aria-label="Close"
            >
              <Icon name="X" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
