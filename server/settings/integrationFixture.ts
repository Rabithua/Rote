import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { NotificationConfig, SecurityConfig } from '../types/config';
import type { HonoVariables } from '../types/hono';

export const fixtureSecurity: SecurityConfig = {
  jwtSecret: 'isolated-admin-settings-access-signing-key',
  jwtRefreshSecret: 'isolated-admin-settings-refresh-signing-key',
  sessionSecret: 'isolated-admin-settings-state-signing-key',
  jwtAccessExpiry: '2h',
  jwtRefreshExpiry: '14d',
  requireCertifiedUserForExplore: true,
  oauth: {
    enabled: true,
    providers: {
      github: {
        enabled: true,
        clientId: 'isolated-client',
        clientSecret: 'isolated-provider-secret',
        callbackUrl: 'https://example.test/callback',
      },
    },
  },
  passkey: { enabled: true, rpId: 'example.test', origin: 'https://example.test' },
};

export const fixtureNotification: NotificationConfig = {
  vapidPublicKey: 'isolated-vapid-public',
  vapidPrivateKey: 'isolated-vapid-private',
  adminHooks: {
    enabled: true,
    channels: [
      {
        id: 'test-hook',
        name: 'Test',
        type: 'bark',
        key: 'isolated-bark-key',
        enabled: true,
        events: ['user.registered'],
      },
    ],
  },
};

export async function createAdminSettingsFixture(databaseUrl: string) {
  if (new URL(databaseUrl).pathname !== '/rote_security_settings_test') {
    throw new Error(
      'ADMIN_SETTINGS_TEST_DATABASE_URL must use the isolated settings test database'
    );
  }
  process.env.POSTGRESQL_URL = databaseUrl;
  const { default: db, closeDatabase } = await import('../utils/drizzle');
  const schema = await import('../drizzle/schema');
  const config = await import('../utils/config');
  const jwt = await import('../utils/jwt');
  const operators = await import('drizzle-orm');
  const ids = { user: randomUUID(), admin: randomUUID(), super_admin: randomUUID() };
  const tokens = { user: '', admin: '', super_admin: '' };
  await db.insert(schema.users).values(
    Object.entries(ids).map(([role, id]) => ({
      id,
      role,
      username: `settings-${id}`,
      email: `${id}@example.test`,
    }))
  );
  const { default: router } = await import('../route/v2/admin');
  const app = new Hono<{ Variables: HonoVariables }>();
  app.route('/admin', router);
  return {
    db,
    schema,
    config,
    jwt,
    operators,
    ids,
    tokens,
    app,
    request(path: string, method = 'GET', role: keyof typeof tokens = 'admin', body?: unknown) {
      return app.request(`/admin${path}`, {
        method,
        headers: { Authorization: `Bearer ${tokens[role]}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    },
    async storedSecurity() {
      const [row] = await db
        .select()
        .from(schema.settings)
        .where(operators.eq(schema.settings.group, 'security'));
      return row.config as SecurityConfig;
    },
    async reset() {
      if (
        !(await config.setConfig('security', fixtureSecurity)) ||
        !(await config.setConfig('notification', fixtureNotification)) ||
        !(await config.setConfig('system', { isInitialized: true }))
      ) {
        throw new Error('Isolated settings fixture could not initialize configuration');
      }
      for (const role of Object.keys(ids) as (keyof typeof ids)[]) {
        tokens[role] = await jwt.generateAccessToken({
          userId: ids[role],
          username: `settings-${ids[role]}`,
        });
      }
    },
    async close() {
      await db.delete(schema.users).where(operators.inArray(schema.users.id, Object.values(ids)));
      await closeDatabase();
    },
  };
}
