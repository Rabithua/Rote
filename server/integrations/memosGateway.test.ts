import { describe, expect, test } from 'bun:test';
import { MemosGatewayError, requestMemosPage } from './memosGateway';

describe('requestMemosPage', () => {
  test('forwards a bounded page request through the backend', async () => {
    let requestedUrl = '';
    let authorization = '';
    let redirectMode: RequestRedirect | undefined;
    const data = await requestMemosPage({
      accessToken: 'memos_pat_test',
      body: { baseUrl: 'https://memos.example.com/', state: 'NORMAL', pageToken: 'next' },
      assertSafeUrl: async () => {},
      fetcher: async (input, init) => {
        requestedUrl = String(input);
        authorization = new Headers(init?.headers).get('authorization') ?? '';
        redirectMode = init?.redirect;
        return Response.json({ memos: [], nextPageToken: '' });
      },
    });

    expect(data).toEqual({ memos: [], nextPageToken: '' });
    expect(requestedUrl).toBe(
      'https://memos.example.com/api/v1/memos?pageSize=50&state=NORMAL&pageToken=next'
    );
    expect(authorization).toBe('Bearer memos_pat_test');
    expect(redirectMode).toBe('manual');
  });

  test('validates every redirect and does not forward credentials across origins', async () => {
    const checkedUrls: string[] = [];
    const requests: Array<{ url: string; authorization: string | null }> = [];
    const data = await requestMemosPage({
      accessToken: 'memos_pat_test',
      body: { baseUrl: 'https://memos.example.com', state: 'NORMAL' },
      assertSafeUrl: async (url) => {
        checkedUrls.push(url);
      },
      fetcher: async (input, init) => {
        const url = String(input);
        requests.push({
          url,
          authorization: new Headers(init?.headers).get('authorization'),
        });
        if (url.startsWith('https://memos.example.com/')) {
          return new Response(null, {
            status: 302,
            headers: { location: 'https://cdn.example.com/memos-page' },
          });
        }
        return Response.json({ memos: [], nextPageToken: '' });
      },
    });

    expect(data).toEqual({ memos: [], nextPageToken: '' });
    expect(checkedUrls).toEqual([
      'https://memos.example.com/api/v1/memos?pageSize=50&state=NORMAL',
      'https://cdn.example.com/memos-page',
    ]);
    expect(requests).toEqual([
      {
        url: 'https://memos.example.com/api/v1/memos?pageSize=50&state=NORMAL',
        authorization: 'Bearer memos_pat_test',
      },
      { url: 'https://cdn.example.com/memos-page', authorization: null },
    ]);
  });

  test('rejects an unsafe redirect before requesting it', async () => {
    const requestedUrls: string[] = [];
    await expect(
      requestMemosPage({
        accessToken: 'memos_pat_test',
        body: { baseUrl: 'https://memos.example.com', state: 'NORMAL' },
        assertSafeUrl: async (url) => {
          if (url.includes('169.254.169.254')) throw new Error('unsafe');
        },
        fetcher: async (input) => {
          requestedUrls.push(String(input));
          return new Response(null, {
            status: 302,
            headers: { location: 'http://169.254.169.254/latest/meta-data' },
          });
        },
      })
    ).rejects.toMatchObject<MemosGatewayError>({ code: 'memos_invalid_request', status: 400 });

    expect(requestedUrls).toEqual([
      'https://memos.example.com/api/v1/memos?pageSize=50&state=NORMAL',
    ]);
  });

  test('rejects an oversized streamed response without buffering the full body', async () => {
    let canceled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(6 * 1024 * 1024));
        controller.enqueue(new Uint8Array(6 * 1024 * 1024));
      },
      cancel() {
        canceled = true;
      },
    });

    await expect(
      requestMemosPage({
        accessToken: 'memos_pat_test',
        body: { baseUrl: 'https://memos.example.com', state: 'NORMAL' },
        assertSafeUrl: async () => {},
        fetcher: async () => new Response(body),
      })
    ).rejects.toMatchObject<MemosGatewayError>({ code: 'memos_invalid_response', status: 502 });
    expect(canceled).toBe(true);
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
