import { scrollPositionAtom } from '@/state/scrollRecoder';
import { useSetAtom } from 'jotai';
import { debounce } from 'lodash';
import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * 不需要保存滚动位置的路径列表（黑名单）
 * 这些路径每次访问都会从顶部开始
 */
const EXCLUDED_PATHS = ['/landing', '/login', '/setup', '/doc/', '/app/', '/404'];

/**
 * 检查路径是否在排除列表中
 * 支持前缀匹配，例如 '/doc/' 会匹配所有以 '/doc/' 开头的路径
 */
function isPathExcluded(pathname: string): boolean {
  return EXCLUDED_PATHS.some((excludedPath) => {
    // 精确匹配
    if (pathname === excludedPath) return true;
    // 前缀匹配（以 '/' 结尾的路径）
    if (excludedPath.endsWith('/') && pathname.startsWith(excludedPath)) return true;
    return false;
  });
}

export function useSaveScrollPosition() {
  const { pathname } = useLocation();
  // write-only setter to avoid subscribing/re-rendering on each update
  const setScrollPositions = useSetAtom(scrollPositionAtom);

  // 检查当前路径是否被排除
  const isExcluded = isPathExcluded(pathname);

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
    if (isExcluded) {
      // 如果路径被排除，始终滚动到顶部
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      // 否则恢复保存的滚动位置
      window.scrollTo({ top: getInitialScrollPosition(pathname), behavior: 'auto' });
    }
  }, [pathname, isExcluded]);

  useEffect(() => {
    // 如果路径被排除，不添加滚动监听器
    if (isExcluded) {
      return;
    }

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
  }, [pathname, setScrollPositions, isExcluded]);
}
