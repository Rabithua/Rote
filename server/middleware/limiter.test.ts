import { beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { Hono } from 'hono';
import type { HonoVariables } from '../types/hono';

let createRateLimiterMiddleware: typeof import('./limiter').createRateLimiterMiddleware;

beforeAll(async () => {
  process.env.POSTGRESQL_URL ||= 'postgres://test:test@127.0.0.1:5432/test';
  ({ createRateLimiterMiddleware } = await import('./limiter'));
});

function createApp(consume: (key: string) => Promise<unknown>) {
  const app = new Hono<{ Variables: HonoVariables }>();
  app.use('*', createRateLimiterMiddleware(consume));
  app.get('/failure', () => {
    throw new Error('downstream failure');
  });
  app.get('/success', (c) => c.text('ok'));
  app.onError((_error, c) => c.json({ code: 500, message: 'internal_error' }, 500));
  return app;
}

describe('rate limiter middleware', () => {
  it('does not translate downstream failures into rate-limit responses', async () => {
    const response = await createApp(async () => undefined).request('/failure');

    expect(response.status).toBe(500);
    expect(response.headers.get('retry-after')).toBeNull();
    expect(await response.json()).toEqual({ code: 500, message: 'internal_error' });
  });

  it('returns 429 only for a limiter rejection', async () => {
    const log = spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const response = await createApp(async () => {
        throw Object.assign(new Error('rate limit exceeded'), { msBeforeNext: 2_000 });
      }).request('/success');

      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).toBe('2');
    } finally {
      log.mockRestore();
    }
  });
});
