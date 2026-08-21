import React, { useEffect } from 'react';
import { OverlayPortal } from './OverlayPortal';
import { OverlayBackdrop } from './OverlayBackdrop';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { Icon } from '@/shared/components/ui/Icon';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
  closeOnBackdropClick?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = 'max-w-2xl',
  closeOnBackdropClick = true,
}: ModalProps) {
  useBodyScrollLock(isOpen);

  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <OverlayPortal>
      <OverlayBackdrop onClick={closeOnBackdropClick ? onClose : undefined} />

      <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        <div
          onClick={(e) => e.stopPropagation()}
          className={`w-full ${maxWidthClass} max-h-[calc(100dvh-48px)] flex flex-col min-h-0 bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150`}
        >
          {/* Fixed Header */}
          {(title || subtitle) && (
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/60 shrink-0">
              <div className="space-y-0.5 pr-4">
                {title && <div className="text-sm font-bold font-mono text-foreground">{title}</div>}
                {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer shrink-0"
                title="Close (Esc)"
              >
                <Icon name="X" className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Internal Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
            {children}
          </div>

          {/* Fixed Footer */}
          {footer && (
            <div className="p-4 border-t border-border/60 bg-muted/20 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </OverlayPortal>
  );
}
