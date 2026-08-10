import { beforeAll, describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import type { HonoVariables, SafeUser } from '../types/hono';

let createJWTAuthenticationMiddleware: typeof import('./jwtAuth').createJWTAuthenticationMiddleware;

beforeAll(async () => {
  process.env.POSTGRESQL_URL ||= 'postgres://test:test@127.0.0.1:5432/test';
  ({ createJWTAuthenticationMiddleware } = await import('./jwtAuth'));
});

const user: SafeUser = {
  id: '11111111-2222-4333-8444-555555555555',
  certified: true,
  emailVerified: true,
  passwordhash: null,
  salt: null,
  email: 'billing@example.test',
  username: 'billing-user',
  nickname: null,
  description: null,
  avatar: null,
  cover: null,
  role: 'user',
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

function createApp(params: {
  verify?: () => Promise<{ userId: string; username: string }>;
  findUser?: () => Promise<SafeUser | null>;
}) {
  const authenticate = createJWTAuthenticationMiddleware({
    verifyAccessToken:
      params.verify ?? (async () => ({ userId: user.id, username: user.username })),
    getSafeUser: params.findUser ?? (async () => user),
  });
  const app = new Hono<{ Variables: HonoVariables }>();
  app.get('/billing/me', authenticate, () => {
    throw new Error('grant store failure');
  });
  app.onError((_error, c) => c.json({ code: 500, message: 'internal_error' }, 500));
  return app;
}

const authorization = { authorization: 'Bearer valid-token' };

describe('JWT authentication middleware', () => {
  it('does not translate downstream grant-store failures into invalid-token responses', async () => {
    const response = await createApp({}).request('/billing/me', { headers: authorization });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: 500, message: 'internal_error' });
  });

  it('returns 401 only for token validation failures', async () => {
    const response = await createApp({
      verify: async () => {
        throw new Error('invalid token');
      },
    }).request('/billing/me', { headers: authorization });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: 401, message: 'Invalid token' });
  });

  it('allows user-store failures to reach the global error handler', async () => {
    const response = await createApp({
      findUser: async () => {
        throw new Error('database unavailable');
      },
    }).request('/billing/me', { headers: authorization });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: 500, message: 'internal_error' });
  });
});
