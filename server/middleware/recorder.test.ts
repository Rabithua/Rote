import { beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { Hono } from 'hono';
import type { HonoVariables } from '../types/hono';

let recorderIpAndTime: typeof import('./recorder').recorderIpAndTime;

beforeAll(async () => {
  process.env.POSTGRESQL_URL ||= 'postgres://test:test@127.0.0.1:5432/test';
  ({ recorderIpAndTime } = await import('./recorder'));
});

describe('request recorder path privacy', () => {
  it('does not log the full user ID for internal billing grant callbacks', async () => {
    const userId = '3d594650-3436-4a2e-905c-438b5a93992a';
    const messages: string[] = [];
    const log = spyOn(console, 'log').mockImplementation((message) => {
      messages.push(String(message));
    });
    const app = new Hono<{ Variables: HonoVariables }>();
    app.use('*', recorderIpAndTime);
    app.put('/internal/billing/grants/:userId', (c) => c.text('ok'));

    try {
      const response = await app.request(`/internal/billing/grants/${userId}`, { method: 'PUT' });

      expect(response.status).toBe(200);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('Path: /internal/billing/grants/:userId');
      expect(messages[0]).not.toContain(userId);
    } finally {
      log.mockRestore();
    }
  });

  it('records activation metadata without logging the signed transaction JWS', async () => {
    const signedTransactionInfo = 'private.header.payload.signature';
    const messages: string[] = [];
    const log = spyOn(console, 'log').mockImplementation((message) => {
      messages.push(String(message));
    });
    const app = new Hono<{ Variables: HonoVariables }>();
    app.use('*', recorderIpAndTime);
    app.post('/v2/api/billing/app-store/activate', async (c) => {
      await c.req.json();
      return c.text('ok');
    });

    try {
      const response = await app.request('/v2/api/billing/app-store/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signedTransactionInfo }),
      });

      expect(response.status).toBe(200);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('Path: /v2/api/billing/app-store/activate');
      expect(messages[0]).not.toContain(signedTransactionInfo);
      expect(messages[0]).not.toContain('signedTransactionInfo');
    } finally {
      log.mockRestore();
    }
  });
});
