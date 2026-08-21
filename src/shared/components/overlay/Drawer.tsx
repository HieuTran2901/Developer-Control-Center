import React, { useEffect } from 'react';
import { OverlayPortal } from './OverlayPortal';
import { OverlayBackdrop } from './OverlayBackdrop';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { Icon } from '@/shared/components/ui/Icon';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
  closeOnBackdropClick?: boolean;
  transparentBackdrop?: boolean;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  footer,
  widthClass = 'max-w-2xl',
  closeOnBackdropClick = true,
  transparentBackdrop = false,
}: DrawerProps) {
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
      <OverlayBackdrop
        transparent={transparentBackdrop}
        onClick={closeOnBackdropClick ? onClose : undefined}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className={`fixed inset-y-0 right-0 z-60 w-full ${widthClass} bg-card border-l border-border/80 flex flex-col min-h-0 shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200 pointer-events-auto`}
      >
        {/* Fixed Drawer Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/60 shrink-0">
          <div className="text-sm font-bold font-mono text-foreground truncate pr-2">
            {title}
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

        {/* Internal Scrollable Content Container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          {children}
        </div>

        {/* Optional Fixed Footer */}
        {footer && (
          <div className="p-4 border-t border-border/60 bg-muted/20 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </OverlayPortal>
  );
}
