import { beforeAll, describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import type { EffectiveCapability } from '../../authz/capabilities';
import { UserRole } from '../../types/main';

let createPermissionsRouter: typeof import('./permissions').createPermissionsRouter;

beforeAll(async () => {
  process.env.POSTGRESQL_URL ||= 'postgres://test:test@127.0.0.1:5432/test';
  ({ createPermissionsRouter } = await import('./permissions'));
});

const safeUser = {
  id: '3d594650-3436-4a2e-905c-438b5a93992a',
  certified: true,
  emailVerified: true,
  passwordhash: null,
  salt: null,
  email: 'permissions@example.test',
  username: 'permissions-test',
  nickname: null,
  description: null,
  avatar: null,
  cover: null,
  role: UserRole.USER,
  createdAt: new Date('2026-08-07T00:00:00.000Z'),
  updatedAt: new Date('2026-08-07T00:00:00.000Z'),
};

function appWithAiCapability(aiChat: EffectiveCapability) {
  const app = new Hono();
  app.route(
    '/permissions',
    createPermissionsRouter({
      authenticate: async (context, next) => {
        context.set('user', safeUser);
        await next();
      },
      getCapabilities: async () => ({
        role: UserRole.USER,
        capabilities: {
          'attachment.upload': {
            allowed: true,
            source: 'role_default',
            role: UserRole.USER,
          },
          'attachment.video.upload': {
            allowed: false,
            source: 'role_default',
            role: UserRole.USER,
          },
          'ai.chat': aiChat,
          'resource.storage.unlimited': {
            allowed: false,
            source: 'role_default',
            role: UserRole.USER,
          },
        },
      }),
    })
  );
  return app;
}

describe('GET /permissions/me DTO', () => {
  it('keeps validUntil absent for non-subscription sources', async () => {
    const response = await appWithAiCapability({
      allowed: false,
      source: 'role_default',
      role: UserRole.USER,
    }).request('/permissions/me');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.capabilities['ai.chat']).toEqual({
      allowed: false,
      source: 'role_default',
      role: UserRole.USER,
    });
  });

  it('returns the subscription lease as optional validUntil', async () => {
    const response = await appWithAiCapability({
      allowed: true,
      source: 'subscription',
      role: UserRole.USER,
      validUntil: '2026-08-08T00:00:00.000Z',
    }).request('/permissions/me');
    const body = await response.json();

    expect(body.data.capabilities['ai.chat'].validUntil).toBe('2026-08-08T00:00:00.000Z');
  });
});
