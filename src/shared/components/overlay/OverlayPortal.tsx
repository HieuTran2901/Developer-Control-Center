import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface OverlayPortalProps {
  children: React.ReactNode;
  targetId?: string;
}

export function OverlayPortal({ children, targetId = 'dcc-overlay-root' }: OverlayPortalProps) {
  const [mounted, setMounted] = useState(false);
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    let el = document.getElementById(targetId);
    if (!el) {
      el = document.createElement('div');
      el.id = targetId;
      document.body.appendChild(el);
    }
    setPortalElement(el);

    return () => {
      setMounted(false);
    };
  }, [targetId]);

  if (!mounted || !portalElement) return null;

  return createPortal(children, portalElement);
}
