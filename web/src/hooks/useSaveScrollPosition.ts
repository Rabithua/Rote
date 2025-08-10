import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { throttle } from 'lodash';
import { useScrollPosition as useJotaiScrollPosition } from '@/state/scrollRecoder';

export function useSaveScrollPosition() {
  const { pathname } = useLocation();
  const { getScrollPosition, setScrollPosition } = useJotaiScrollPosition();

  useEffect(() => {
    setTimeout(() => {
      window.scrollTo({
        top: getScrollPosition(pathname),
        behavior: 'smooth',
      });
    }, 100);

    const handleScroll = throttle(() => {
      setScrollPosition(pathname, window.scrollY);
    }, 200);

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pathname, getScrollPosition, setScrollPosition]);
}
