import type { Rotes } from '@/types/main';
import { mutate } from 'swr';

export function removeUserContentFromPages(
  pages: Rotes[] | undefined,
  target: { id: string; username: string }
): Rotes[] | undefined {
  return pages?.map((page) =>
    page.filter((rote) => rote.authorid !== target.id && rote.author?.username !== target.username)
  );
}

export function isBlockAffectedCacheKey(key: unknown): boolean {
  if (Array.isArray(key)) {
    return key.some(isBlockAffectedCacheKey);
  }

  if (typeof key === 'string') {
    return (
      key.startsWith('/notes') ||
      key.startsWith('/articles') ||
      key.startsWith('/users/') ||
      key === '/users/me/blocks' ||
      key === 'randomRote'
    );
  }

  if (!key || typeof key !== 'object') return false;
  const apiType = (key as { apiType?: unknown }).apiType;
  return apiType === 'mine' || apiType === 'public' || apiType === 'userPublic';
}

export async function refreshBlockAffectedCaches() {
  await mutate(isBlockAffectedCacheKey, undefined, { revalidate: true });
}
