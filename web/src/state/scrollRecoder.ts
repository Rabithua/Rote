import { atomWithStorage } from 'jotai/utils';

/**
 * Jotai atom to persist scroll positions across different routes using local storage.
 * The key is the route path, and the value is the scroll position in pixels.
 */
export const scrollPositionAtom = atomWithStorage<Record<string, number>>('scrollPositionAtom', {});
