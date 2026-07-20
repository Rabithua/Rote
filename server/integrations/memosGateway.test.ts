import { describe, expect, test } from 'bun:test';
import { MemosGatewayError, requestMemosPage } from './memosGateway';

describe('requestMemosPage', () => {
  test('forwards a bounded page request through the backend', async () => {
    let requestedUrl = '';
    let authorization = '';
    const data = await requestMemosPage({
      accessToken: 'memos_pat_test',
      body: { baseUrl: 'https://memos.example.com/', state: 'NORMAL', pageToken: 'next' },
      assertSafeUrl: async () => {},
      fetcher: async (input, init) => {
        requestedUrl = String(input);
        authorization = new Headers(init?.headers).get('authorization') ?? '';
        return Response.json({ memos: [], nextPageToken: '' });
      },
    });

    expect(data).toEqual({ memos: [], nextPageToken: '' });
    expect(requestedUrl).toBe(
      'https://memos.example.com/api/v1/memos?pageSize=50&state=NORMAL&pageToken=next'
    );
    expect(authorization).toBe('Bearer memos_pat_test');
  });

  test('rejects invalid states and upstream authentication failures', async () => {
    await expect(
      requestMemosPage({
        accessToken: 'token',
        body: { baseUrl: 'https://memos.example.com', state: 'DELETED' },
        assertSafeUrl: async () => {},
      })
    ).rejects.toMatchObject<MemosGatewayError>({ code: 'memos_invalid_request' });

    await expect(
      requestMemosPage({
        accessToken: 'token',
        body: { baseUrl: 'https://memos.example.com', state: 'ARCHIVED' },
        assertSafeUrl: async () => {},
        fetcher: async () => new Response(null, { status: 401 }),
      })
    ).rejects.toMatchObject<MemosGatewayError>({ code: 'memos_unauthorized' });
  });
});
