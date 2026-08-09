import type { Rotes } from '@/types/main';
import { describe, expect, it } from 'vitest';
import { isBlockAffectedCacheKey, removeUserContentFromPages } from './cache';

describe('user block cache helpers', () => {
  it('removes a blocked author from every cached page without mutating other entries', () => {
    const pages = [
      [
        { id: 'one', authorid: 'blocked', author: { username: 'blocked-user' } },
        { id: 'two', authorid: 'visible', author: { username: 'visible-user' } },
      ],
      [{ id: 'three', authorid: 'blocked', author: { username: 'blocked-user' } }],
    ] as unknown as Rotes[];

    expect(
      removeUserContentFromPages(pages, { id: 'blocked', username: 'blocked-user' })?.map((page) =>
        page.map((rote) => rote.id)
      )
    ).toEqual([['two'], []]);
    expect(pages[0]).toHaveLength(2);
  });

  it('targets user-content and infinite public cache keys', () => {
    expect(isBlockAffectedCacheKey('/notes/public')).toBe(true);
    expect(isBlockAffectedCacheKey('/users/me/blocks')).toBe(true);
    expect(isBlockAffectedCacheKey({ apiType: 'public' })).toBe(true);
    expect(isBlockAffectedCacheKey({ apiType: 'mine' })).toBe(true);
    expect(
      isBlockAffectedCacheKey([
        'viewer-aware',
        'https://rote.example|account-id',
        '/articles/article-id',
      ])
    ).toBe(true);
    expect(
      isBlockAffectedCacheKey(['viewer-aware', 'https://rote.example|account-id', 'randomRote'])
    ).toBe(true);
    expect(isBlockAffectedCacheKey('https://api.github.com/repo')).toBe(false);
  });
});
