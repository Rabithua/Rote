import { useAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

/**
 * Jotai atom to persist scroll positions across different routes using local storage.
 * The key is the route path, and the value is the scroll position in pixels.
 */
export const scrollPositionAtom = atomWithStorage<Record<string, number>>('scrollPositionAtom', {});

export function useScrollPosition() {
  const [scrollPositions, setScrollPositions] = useAtom(scrollPositionAtom);

  /**
   * Retrieves the saved scroll position for a given route.
   * @param route - The unique identifier for the route (e.g., pathname).
   * @returns The scroll position in pixels, defaults to 0.
   */
  const getScrollPosition = (route: string) => scrollPositions[route] || 0;

  /**
   * Updates the scroll position for a given route.
   * @param route - The unique identifier for the route.
   * @param position - The new scroll position in pixels.
   */
  const setScrollPosition = (route: string, position: number) => {
    setScrollPositions((prev) => ({ ...prev, [route]: position }));
  };

  return { getScrollPosition, setScrollPosition };
}
