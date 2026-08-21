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

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && onClick) {
      onClick();
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) {
      e.stopPropagation();
    }
  };

  return (
    <div
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      className={`fixed inset-0 z-50 transition-all duration-150 animate-in fade-in ${baseStyle} ${className}`}
    >
      {children}
    </div>
  );
}
