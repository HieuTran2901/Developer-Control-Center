import { useEffect, useRef } from 'react';

// Set of active lock instances by unique ID
const activeLockIds = new Set<string>();

// Store original body styles before locking
let originalOverflow: string | null = null;
let originalPaddingRight: string | null = null;

export function useBodyScrollLock(isLocked: boolean = true) {
  // Unique ID for each hook instance
  const idRef = useRef<string | null>(null);
  if (!idRef.current) {
    idRef.current = `lock_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const id = idRef.current!;

    if (isLocked) {
      if (activeLockIds.size === 0) {
        originalOverflow = document.body.style.overflow;
        originalPaddingRight = document.body.style.paddingRight;

        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = 'var(--scrollbar-width, 0px)';
      }
      activeLockIds.add(id);
    } else {
      if (activeLockIds.has(id)) {
        activeLockIds.delete(id);
        if (activeLockIds.size === 0) {
          document.body.style.overflow = originalOverflow !== null ? originalOverflow : '';
          document.body.style.paddingRight = originalPaddingRight !== null ? originalPaddingRight : '';
          originalOverflow = null;
          originalPaddingRight = null;
        }
      }
    }

    return () => {
      if (activeLockIds.has(id)) {
        activeLockIds.delete(id);
        if (activeLockIds.size === 0) {
          document.body.style.overflow = originalOverflow !== null ? originalOverflow : '';
          document.body.style.paddingRight = originalPaddingRight !== null ? originalPaddingRight : '';
          originalOverflow = null;
          originalPaddingRight = null;
        }
      }
    };
  }, [isLocked]);
}
