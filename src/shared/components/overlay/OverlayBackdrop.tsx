import React from 'react';

interface OverlayBackdropProps {
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
  transparent?: boolean;
}

export function OverlayBackdrop({
  onClick,
  className = '',
  children,
  transparent = false,
}: OverlayBackdropProps) {
  const baseStyle = transparent
    ? 'bg-transparent'
    : 'bg-black/15';

  return (
    <div
      onClick={onClick}
      className={`fixed inset-0 z-50 transition-all duration-150 animate-in fade-in ${baseStyle} ${className}`}
    >
      {children}
    </div>
  );
}
