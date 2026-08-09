import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '@/utils/api';

import { fetchWereadFromApi } from './weread-api';

interface RequestBody {
  api_name: string;
  bookId?: string;
  bookid?: string;
  lastSort?: number;
  synckey?: number;
  skill_version: string;
}

const postMock = vi.spyOn(api, 'post');

describe('WeRead API client', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('filters bookmark-only books before making detail requests', async () => {
    postMock.mockImplementation(async (_url, body) => {
      const request = body as RequestBody;
      if (request.api_name === '/user/notebooks') {
        return response({
          books: [
            {
              bookId: 'bookmark-only',
              noteCount: 0,
              reviewCount: 0,
              bookmarkCount: 8,
            },
            {
              bookId: 'highlight-only',
              noteCount: 2,
              reviewCount: 0,
              book: { bookId: 'highlight-only', title: '只有划线' },
            },
            {
              bookId: 'review-only',
              noteCount: 0,
              reviewCount: 1,
              book: { bookId: 'review-only', title: '只有想法' },
            },
          ],
          hasMore: 0,
        });
      }
      if (request.api_name === '/book/bookmarklist') {
        return response({
          updated: [{ bookmarkId: 'mark-1', markText: '一条划线' }],
        });
      }
      return response({
        reviews: [{ review: { reviewId: 'review-1', content: '一条想法' } }],
        hasMore: 0,
      });
    });

    const result = await fetchWereadFromApi(' wrk-secret ');
    const requests = postMock.mock.calls.map((call) => call[1] as RequestBody);

    expect(result.books.map((book) => book.meta.bookId)).toEqual(['highlight-only', 'review-only']);
    expect(requests).toHaveLength(3);
    expect(requests.some((body) => body.bookId === 'bookmark-only')).toBe(false);
    expect(requests.some((body) => body.bookid === 'bookmark-only')).toBe(false);
    expect(requests.every((body) => !('apiKey' in body))).toBe(true);
    expect(postMock.mock.calls[0][2]?.headers).toMatchObject({
      'X-WeRead-API-Key': 'wrk-secret',
    });
  });

  it('follows notebook and review cursors and merges the result', async () => {
    postMock.mockImplementation(async (_url, body) => {
      const request = body as RequestBody;
      if (request.api_name === '/user/notebooks' && request.lastSort === undefined) {
        return response({
          books: [
            {
              bookId: 'book-1',
              sort: 20,
              noteCount: 1,
              reviewCount: 1,
              book: { bookId: 'book-1', title: '第一本' },
            },
          ],
          hasMore: 1,
        });
      }
      if (request.api_name === '/user/notebooks') {
        return response({ books: [], hasMore: 0 });
      }
      if (request.api_name === '/book/bookmarklist') {
        return response({
          updated: [{ bookmarkId: 'mark-1', markText: '划线' }],
        });
      }
      if (request.synckey === 0) {
        return response({
          reviews: [{ review: { reviewId: 'review-1', content: '想法一' } }],
          hasMore: 1,
          synckey: 99,
        });
      }
      return response({
        reviews: [{ review: { reviewId: 'review-2', content: '想法二' } }],
        hasMore: 0,
      });
    });

    const result = await fetchWereadFromApi('wrk-key');
    const requests = postMock.mock.calls.map((call) => call[1] as RequestBody);

    expect(result.books[0].content.flatMap((chapter) => chapter.items)).toHaveLength(3);
    expect(requests).toContainEqual(
      expect.objectContaining({ api_name: '/user/notebooks', lastSort: 20 })
    );
    expect(requests).toContainEqual(
      expect.objectContaining({ api_name: '/review/list/mine', synckey: 99 })
    );
    expect(requests.every((body) => body.skill_version === '1.0.4')).toBe(true);
  });

  it('keeps compatibility when notebook counts are absent', async () => {
    postMock.mockImplementation(async (_url, body) => {
      const request = body as RequestBody;
      if (request.api_name === '/user/notebooks') {
        return response({
          books: [{ bookId: 'legacy', book: { title: '旧响应' } }],
          hasMore: 0,
        });
      }
      if (request.api_name === '/book/bookmarklist') {
        return response({ updated: [{ bookmarkId: 'mark', markText: '划线' }] });
      }
      return response({ reviews: [], hasMore: 0 });
    });

    await fetchWereadFromApi('wrk-key');

    expect(postMock.mock.calls.map((call) => (call[1] as RequestBody).api_name)).toEqual([
      '/user/notebooks',
      '/book/bookmarklist',
      '/review/list/mine',
    ]);
  });

  it.each(['weread_invalid_key', 'weread_timeout', 'weread_api_forbidden'])(
    'maps proxy error %s to a user-facing failure',
    async (message) => {
      postMock.mockRejectedValue({ response: { data: { message } } });

      await expect(fetchWereadFromApi('wrk-key')).rejects.toThrow();
    }
  );
});

function response<T>(data: T) {
  return { code: 0, message: '', data };
}
