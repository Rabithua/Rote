import { beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { HonoVariables } from '../types/hono';
import type { UsageLogData } from '../utils/dbMethods/apikey';

let createOpenKeyMiddleware: typeof import('./middleware').createOpenKeyMiddleware;
let DatabaseError: typeof import('../utils/dbMethods/common').DatabaseError;
let errorHandler: typeof import('../utils/handlers').errorHandler;

beforeAll(async () => {
  process.env.POSTGRESQL_URL ||= 'postgres://test:test@127.0.0.1:5432/test';
  ({ createOpenKeyMiddleware } = await import('./middleware'));
  ({ DatabaseError } = await import('../utils/dbMethods/common'));
  ({ errorHandler } = await import('../utils/handlers'));
});

type UsageAudit = { openKeyId: string; data: UsageLogData };

function createTestApp(options?: {
  missingOpenKey?: boolean;
  routeThrows?: boolean;
  lookupDurationMs?: number;
}) {
  const openKeyId = randomUUID();
  const audits: UsageAudit[] = [];
  let lookupCount = 0;
  let currentTime = 1_000;
  const openKeyRouter = new Hono<{ Variables: HonoVariables }>();

  openKeyRouter.use(
    '*',
    createOpenKeyMiddleware({
      async getOneOpenKey(id) {
        lookupCount += 1;
        currentTime += options?.lookupDurationMs ?? 0;
        if (options?.missingOpenKey) throw new DatabaseError('Open key not found');
        return {
          id,
          userid: randomUUID(),
          permissions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
      async logOpenKeyUsage(id, data) {
        audits.push({ openKeyId: id, data });
      },
      now() {
        return currentTime;
      },
    })
  );
  openKeyRouter.get('/resource', (c) => {
    if (options?.routeThrows) throw new Error('expected route failure');
    return c.json({ ok: true }, 201);
  });

  const app = new Hono<{ Variables: HonoVariables }>();
  app.route('/openkey', openKeyRouter);
  app.onError(errorHandler);

  return { app, audits, getLookupCount: () => lookupCount, openKeyId };
}

describe('OpenKey authentication middleware', () => {
  it('rejects malformed credentials before querying or writing usage records', async () => {
    const credential = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx';
    const messages: string[] = [];
    const error = spyOn(console, 'error').mockImplementation((...args) => {
      messages.push(args.map(String).join(' '));
    });
    const fixture = createTestApp();

    try {
      const response = await fixture.app.request(
        `/openkey/resource?openkey=${encodeURIComponent(credential)}`
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: 1,
        message: 'openkey_invalid_credential',
        data: null,
      });
      expect(fixture.getLookupCount()).toBe(0);
      expect(fixture.audits).toHaveLength(0);
      expect(messages.join('\n')).not.toContain(credential);
    } finally {
      error.mockRestore();
    }
  });

  it('returns the same stable error code when the credential is missing', async () => {
    const fixture = createTestApp();
    const response = await fixture.app.request('/openkey/resource');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: 1,
      message: 'openkey_invalid_credential',
      data: null,
    });
    expect(fixture.getLookupCount()).toBe(0);
    expect(fixture.audits).toHaveLength(0);
  });

  it('does not write a foreign-key usage record for a missing credential', async () => {
    const messages: string[] = [];
    const error = spyOn(console, 'error').mockImplementation((...args) => {
      messages.push(args.map(String).join(' '));
    });
    const fixture = createTestApp({ missingOpenKey: true });

    try {
      const response = await fixture.app.request(`/openkey/resource?openkey=${fixture.openKeyId}`);

      expect(response.status).toBe(404);
      expect(fixture.getLookupCount()).toBe(1);
      expect(fixture.audits).toHaveLength(0);
      expect(messages.join('\n')).not.toContain(fixture.openKeyId);
    } finally {
      error.mockRestore();
    }
  });

  it('records the resolved credential and successful response status', async () => {
    const fixture = createTestApp({ lookupDurationMs: 37 });
    const response = await fixture.app.request(`/openkey/resource?openkey=${fixture.openKeyId}`);

    expect(response.status).toBe(201);
    expect(fixture.audits).toHaveLength(1);
    expect(fixture.audits[0].openKeyId).toBe(fixture.openKeyId);
    expect(fixture.audits[0].data.statusCode).toBe(201);
    expect(fixture.audits[0].data.responseTime).toBe(37);
    expect(fixture.audits[0].data.errorMessage).toBeUndefined();
  });

  it('records the final status for a downstream exception', async () => {
    const error = spyOn(console, 'error').mockImplementation(() => undefined);
    const fixture = createTestApp({ routeThrows: true });

    try {
      const response = await fixture.app.request(`/openkey/resource?openkey=${fixture.openKeyId}`);

      expect(response.status).toBe(500);
      expect(fixture.audits).toHaveLength(1);
      expect(fixture.audits[0].data.statusCode).toBe(500);
      expect(fixture.audits[0].data.errorMessage).toBeUndefined();
    } finally {
      error.mockRestore();
    }
  });
});
