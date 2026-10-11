import { useEffect, type RefObject } from 'react';

export function imageIsVisible(element: HTMLElement | null) {
  if (!element || document.visibilityState === 'hidden') return false;
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth
  );
}

export function useImageActivity(
  surface: RefObject<HTMLSpanElement | null>,
  recordPlaceholder: () => void,
  freezeGeometry: () => void,
  attempt: number
) {
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    let frame = 0;
    let wasVisible = false;
    const update = () => {
      const visible = imageIsVisible(element);
      element.dataset.imageActive = String(visible);
      cancelAnimationFrame(frame);
      if (visible) {
        // The second frame observes a placeholder that had a chance to paint.
        // Image loading and cache hits never wait for these callbacks.
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            if (imageIsVisible(element)) recordPlaceholder();
          });
        });
      } else if (wasVisible) {
        freezeGeometry();
      }
      wasVisible = visible;
    };
    const observer = new IntersectionObserver(update);
    observer.observe(element);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      freezeGeometry();
    };
  }, [surface, recordPlaceholder, freezeGeometry, attempt]);
}
