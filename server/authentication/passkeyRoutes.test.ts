import { beforeAll, describe, expect, it } from 'bun:test';
import { Hono } from 'hono';

let app: Hono;

beforeAll(async () => {
  process.env.POSTGRESQL_URL ||=
    process.env.AUTH_REGISTRATION_TEST_DATABASE_URL ||
    'postgres://test:test@127.0.0.1:1/passkey_routes_no_database';
  const [{ default: authRouter }, { default: passkeyRouter }] = await Promise.all([
    import('../route/v2/auth'),
    import('../route/v2/passkey'),
  ]);
  app = new Hono();
  app.route('/auth', authRouter);
  app.route('/auth/passkey', passkeyRouter);
});

describe('Passkey route availability', () => {
  it.each([
    '/auth/register/passkey/options',
    '/auth/register/passkey/verify',
    '/auth/passkey/continue/options',
  ])('does not expose new-account signup at %s', async (path) => {
    const response = await app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'unregistered-passkey-user' }),
    });
    expect(response.status).toBe(404);
  });

  it.each(['/auth/passkey/register/options', '/auth/passkey/register/verify'])(
    'retains existing-account enrollment behind authentication at %s',
    async (path) => {
      const response = await app.request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(response.status).toBe(401);
      expect((await response.json()).message).toBe('Access token required');
    }
  );
});
