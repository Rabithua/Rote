import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { SignJWT } from 'jose';
import type { NotificationConfig, SecurityConfig } from '../types/config';
import { registerSettingsPersistenceCases } from '../tests/settingsPersistenceCases';
import {
  createAdminSettingsFixture,
  fixtureSecurity as security,
  fixtureNotification as notification,
} from './integrationFixture';

const databaseUrl = process.env.ADMIN_SETTINGS_TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;

databaseDescribe(
  'admin settings with real JWTs and an isolated migrated PostgreSQL database',
  () => {
    let fixture: Awaited<ReturnType<typeof createAdminSettingsFixture>>;
    let config: typeof import('../utils/config');
    let jwt: typeof import('../utils/jwt');
    let ids: typeof fixture.ids;
    let tokens: typeof fixture.tokens;
    let app: typeof fixture.app;
    let request: typeof fixture.request;
    let storedSecurity: typeof fixture.storedSecurity;
    function expectNoSigningKeys(settings: object) {
      for (const field of ['jwtSecret', 'jwtRefreshSecret', 'sessionSecret']) {
        expect(Object.prototype.hasOwnProperty.call(settings, field)).toBe(false);
      }
    }
    beforeAll(async () => {
      fixture = await createAdminSettingsFixture(databaseUrl!);
      ({ config, jwt, ids, tokens, app, request, storedSecurity } = fixture);
    });
    beforeEach(async () => {
      await fixture.reset();
    });
    afterAll(async () => {
      await fixture?.close();
    });

    it('omits signing material from both GET variants for admin and super admin', async () => {
      expect((await request('/settings', 'GET', 'user')).status).toBe(403);
      for (const role of ['admin', 'super_admin'] as const) {
        const all = await request('/settings', 'GET', role);
        expect(all.status).toBe(200);
        const result = (await all.json()).data;
        expectNoSigningKeys(result.security);
        expect(result.security.oauth).toEqual(security.oauth);
        expect(result.notification).toEqual(notification);
        const single = await request('/settings?group=security', 'GET', role);
        expect(single.status).toBe(200);
        expectNoSigningKeys((await single.json()).data.config);
      }
    });

    it('rejects root-key changes and cannot use the proposed attacker key to promote an admin', async () => {
      for (const role of ['admin', 'super_admin'] as const) {
        for (const field of ['jwtSecret', 'jwtRefreshSecret', 'sessionSecret']) {
          const response = await request('/settings', 'PUT', role, {
            group: 'security',
            config: { [field]: 'attacker-key' },
          });
          expect(response.status).toBe(403);
          expect((await response.json()).message).toBe('security_signing_keys_not_editable');
        }
      }
      expect(await storedSecurity()).toEqual(security);
      const forged = await new SignJWT({ userId: ids.super_admin, username: 'forged' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('rote-app')
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode('attacker-key'));
      const response = await app.request(`/admin/users/${ids.admin}/role`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${forged}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'super_admin' }),
      });
      expect(response.status).toBe(401);
      expect(
        (await request(`/users/${ids.admin}/role`, 'PUT', 'admin', { role: 'super_admin' })).status
      ).toBe(403);
      expect(
        (await request(`/users/${ids.admin}/role`, 'PUT', 'super_admin', { role: 'admin' })).status
      ).toBe(200);
    });

    it('preserves normal admin settings, omitted keys and top-level sections without leaking PUT secrets', async () => {
      for (const [index, patch] of [
        { requireCertifiedUserForExplore: false },
        { jwtAccessExpiry: '3h' },
        { passkey: { enabled: true, rpId: 'other.example.test' } },
        { oauth: { enabled: false, providers: {} } },
      ].entries()) {
        const response = await request('/settings', 'PUT', index === 0 ? 'super_admin' : 'admin', {
          group: 'security',
          config: patch,
        });
        expect(response.status).toBe(200);
        expectNoSigningKeys((await response.json()).data.config);
      }
      const saved = await storedSecurity();
      expect(saved).toEqual({
        ...security,
        requireCertifiedUserForExplore: false,
        jwtAccessExpiry: '3h',
        passkey: { enabled: true, rpId: 'other.example.test' },
        oauth: { enabled: false, providers: {} },
      });
      expect(config.getGlobalConfig<SecurityConfig>('security')?.jwtSecret).toBe(
        security.jwtSecret
      );
      expect(
        (
          await request('/settings', 'PUT', 'admin', {
            group: 'security',
            config: { requireVerifiedEmailForExplore: true },
          })
        ).status
      ).toBe(200);
      expect(
        config.getGlobalConfig<SecurityConfig>('security')?.requireVerifiedEmailForExplore
      ).toBe(true);
      for (const invalid of [
        { unknown: true },
        [],
        { oauth: null },
        { jwtAccessExpiry: 'never' },
      ]) {
        expect(
          (await request('/settings', 'PUT', 'admin', { group: 'security', config: invalid }))
            .status
        ).toBe(400);
      }
    });

    it('initializes missing material without rotating existing policy, signing keys or notifications', async () => {
      const partial = { ...security, jwtRefreshSecret: '' };
      expect(await config.setConfig('security', partial)).toBe(true);
      expect(await config.initializeSecurityKeys()).toBe(true);
      const initialized = await storedSecurity();
      expect(initialized.jwtRefreshSecret).toBeTruthy();
      expect({ ...initialized, jwtRefreshSecret: security.jwtRefreshSecret }).toEqual(security);
      expect(config.getGlobalConfig('notification')).toEqual(notification);
      expect(await config.initializeSecurityKeys()).toBe(true);
      expect(await storedSecurity()).toEqual(initialized);
    });

    it('limits rotation to super admins and validates scope before changing material', async () => {
      for (const role of ['user', 'admin'] as const) {
        expect((await request('/settings/regenerate-keys', 'POST', role)).status).toBe(403);
      }
      for (const body of [{ scope: 'vapid' }, [], { scope: false }]) {
        expect(
          (await request('/settings/regenerate-keys', 'POST', 'super_admin', body)).status
        ).toBe(400);
      }
      expect(await storedSecurity()).toEqual(security);
    });

    it('defaults to authentication rotation, invalidates old credentials and preserves VAPID/hooks', async () => {
      const oldRefresh = await jwt.generateRefreshToken({
        userId: ids.admin,
        username: 'settings-admin',
      });
      const oauth = await import('../utils/oauth');
      const oldState = await oauth.generateStateToken({ provider: 'github', userId: ids.admin });
      const mcp = await import('../oauth/tokens');
      const mcpInput = {
        issuer: 'https://example.test',
        resource: 'https://example.test/mcp',
        userId: ids.admin,
        clientId: 'isolated-client',
        scopes: ['notes:read'],
      };
      const oldMcp = await mcp.generateMcpAccessToken(mcpInput);
      const response = await request('/settings/regenerate-keys', 'POST', 'super_admin');
      expect(response.status).toBe(200);
      const body = (await response.json()).data;
      expect(body.scope).toBe('authentication');
      expect(body.keys.jwtSecret).toBe('***regenerated***');
      const rotated = await storedSecurity();
      for (const field of ['jwtSecret', 'jwtRefreshSecret', 'sessionSecret'] as const) {
        expect(rotated[field]).not.toBe(security[field]);
      }
      expect({
        ...rotated,
        jwtSecret: security.jwtSecret,
        jwtRefreshSecret: security.jwtRefreshSecret,
        sessionSecret: security.sessionSecret,
      }).toEqual(security);
      expect(config.getGlobalConfig('notification')).toEqual(notification);
      await expect(jwt.verifyAccessToken(tokens.admin)).rejects.toThrow();
      await expect(jwt.verifyRefreshToken(oldRefresh)).rejects.toThrow();
      await expect(
        mcp.verifyMcpAccessToken(oldMcp, mcpInput.issuer, mcpInput.resource)
      ).rejects.toThrow();
      const newMcp = await mcp.generateMcpAccessToken(mcpInput);
      expect(
        (await mcp.verifyMcpAccessToken(newMcp, mcpInput.issuer, mcpInput.resource)).userId
      ).toBe(ids.admin);
      expect(await oauth.verifyStateToken(oldState)).toBeNull();
      const fresh = await jwt.generateAccessToken({
        userId: ids.admin,
        username: 'settings-admin',
      });
      expect((await jwt.verifyAccessToken(fresh)).userId).toBe(ids.admin);
    });

    it('retains explicit all-key rotation and commits/cache-publishes concurrent settings in order', async () => {
      const response = await request('/settings/regenerate-keys', 'POST', 'super_admin', {
        scope: 'all',
      });
      expect(response.status).toBe(200);
      const keys = config.getGlobalConfig<NotificationConfig>('notification')!;
      expect(keys.vapidPublicKey).not.toBe(notification.vapidPublicKey);
      expect(keys.vapidPrivateKey).not.toBe(notification.vapidPrivateKey);
      expect(keys.adminHooks).toEqual(notification.adminHooks);
      const { mergeSecuritySettings } = await import('./securitySettings');
      await Promise.all([
        config.updateConfig<SecurityConfig>('security', (current) =>
          mergeSecuritySettings(current!, { jwtAccessExpiry: '4h' })
        ),
        config.rotateSecurityKeys('authentication'),
        config.refreshConfigCache(),
        config.updateConfig<SecurityConfig>('security', (current) =>
          mergeSecuritySettings(current!, { requireCertifiedUserForExplore: false })
        ),
      ]);
      const stored = await storedSecurity();
      const cached = config.getGlobalConfig<SecurityConfig>('security')!;
      expect(stored.jwtAccessExpiry).toBe('4h');
      expect(stored.requireCertifiedUserForExplore).toBe(false);
      expect(stored.oauth).toEqual(security.oauth);
      expect(cached.jwtSecret).toBe(stored.jwtSecret);
      expect(cached.sessionSecret).toBe(stored.sessionSecret);
      expect(config.getGlobalConfig('notification')).toEqual(keys);
    });
    registerSettingsPersistenceCases(() => fixture);
  }
);
