import { useScrollPosition as useJotaiScrollPosition } from '@/state/scrollRecoder';
import { throttle } from 'lodash';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useSaveScrollPosition() {
  const { pathname } = useLocation();
  const { getScrollPosition, setScrollPosition } = useJotaiScrollPosition();

  useEffect(() => {
    window.scrollTo({ top: getScrollPosition(pathname), behavior: 'instant' });

    const handleScroll = throttle(() => {
      setScrollPosition(pathname, window.scrollY);
    }, 200);

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pathname]);
}
