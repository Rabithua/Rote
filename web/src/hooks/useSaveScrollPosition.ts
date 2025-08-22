import { scrollPositionAtom } from '@/state/scrollRecoder';
import { useSetAtom } from 'jotai';
import { debounce } from 'lodash';
import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useSaveScrollPosition() {
  const { pathname } = useLocation();
  // write-only setter to avoid subscribing/re-rendering on each update
  const setScrollPositions = useSetAtom(scrollPositionAtom);

  // Read initial value directly from localStorage to avoid atom subscription
  function getInitialScrollPosition(route: string): number {
    try {
      const raw = localStorage.getItem('scrollPositionAtom');
      if (!raw) return 0;
      const obj = JSON.parse(raw) as Record<string, number>;
      const pos = obj?.[route];
      return typeof pos === 'number' ? pos : 0;
    } catch {
      return 0;
    }
  }

  // restore position before paint to avoid initial jump
  useLayoutEffect(() => {
    window.scrollTo({ top: getInitialScrollPosition(pathname), behavior: 'auto' });
  }, [pathname]);

  useEffect(() => {
    let ticking = false;
    const saveDebounced = debounce(
      (y: number) => {
        setScrollPositions((prev) => ({ ...(prev || {}), [pathname]: y }));
      },
      250,
      { leading: false, trailing: true }
    );

    const onScroll = () => {
      const y = window.scrollY;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          saveDebounced(y);
          ticking = false;
        });
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveDebounced.flush?.();
      }
    };
    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onVisibilityChange);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onVisibilityChange);
      saveDebounced.flush?.();
      saveDebounced.cancel?.();
    };
  }, [pathname, setScrollPositions]);
}
