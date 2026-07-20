import { describe, expect, it } from 'bun:test';
import { requestWereadGateway, WereadGatewayError } from './wereadGateway';

describe('requestWereadGateway', () => {
  it('forwards an allowlisted request without exposing unrelated APIs', async () => {
    const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://i.weread.qq.com/api/agent/gateway');
      expect(init?.headers).toEqual({
        Authorization: 'Bearer wrk-secret',
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        api_name: '/user/notebooks',
        count: 100,
        skill_version: '1.0.4',
      });
      return Response.json({ books: [] });
    };

    await expect(
      requestWereadGateway({
        apiKey: 'wrk-secret',
        body: { api_name: '/user/notebooks', count: 100 },
        fetcher,
      })
    ).resolves.toEqual({ books: [] });
  });

  it('rejects invalid keys and APIs before making an upstream request', async () => {
    const fetcher = (() => {
      throw new Error('should not be called');
    }) as typeof fetch;

    await expect(
      requestWereadGateway({
        apiKey: 'invalid',
        body: { api_name: '/user/notebooks' },
        fetcher,
      })
    ).rejects.toMatchObject<WereadGatewayError>({ code: 'weread_invalid_key' });

    await expect(
      requestWereadGateway({
        apiKey: 'wrk-secret',
        body: { api_name: '/book/info' },
        fetcher,
      })
    ).rejects.toMatchObject<WereadGatewayError>({ code: 'weread_api_forbidden' });

    await expect(
      requestWereadGateway({
        apiKey: 'wrk-secret',
        body: { api_name: '/book/bookmarklist' },
        fetcher,
      })
    ).rejects.toMatchObject<WereadGatewayError>({ code: 'weread_invalid_request' });
  });

  it('forwards only bounded parameters required by the official API', async () => {
    const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        api_name: '/review/list/mine',
        bookid: 'book-1',
        count: 100,
        skill_version: '1.0.4',
        synckey: 20,
      });
      return Response.json({ reviews: [] });
    };

    await requestWereadGateway({
      apiKey: 'wrk-secret',
      body: {
        api_name: '/review/list/mine',
        bookid: 'book-1',
        count: 1_000_000,
        ignored: 'value',
        synckey: 20,
      },
      fetcher,
    });
  });

  it('maps upstream timeouts to a stable error code', async () => {
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';

    await expect(
      requestWereadGateway({
        apiKey: 'wrk-secret',
        body: { api_name: '/user/notebooks' },
        fetcher: (() => Promise.reject(timeout)) as typeof fetch,
      })
    ).rejects.toMatchObject<WereadGatewayError>({ code: 'weread_timeout' });
  });

  it('maps upstream authentication failures without exposing the response body', async () => {
    await expect(
      requestWereadGateway({
        apiKey: 'wrk-secret',
        body: { api_name: '/user/notebooks' },
        fetcher: (() =>
          Promise.resolve(
            Response.json({ message: 'sensitive upstream detail' }, { status: 401 })
          )) as typeof fetch,
      })
    ).rejects.toMatchObject<WereadGatewayError>({ code: 'weread_invalid_key', status: 401 });
  });
});
