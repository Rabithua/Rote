import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { SignJWT } from 'jose';
import type { NotificationConfig, SecurityConfig, SiteConfig } from '../types/config';
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
        expect(result.security.oauth.enabled).toBe(security.oauth.enabled);
        expect(result.security.oauth.providers.github.clientId).toBe(
          security.oauth.providers.github.clientId
        );
        expect(result.security.oauth.providers.github.callbackUrl).toBe(
          security.oauth.providers.github.callbackUrl
        );
        expect(result.security.oauth.providers.github.clientSecret).toBe('********');
        expect(result.notification.vapidPublicKey).toBe(notification.vapidPublicKey);
        expect(result.notification.vapidPrivateKey).toBe('********');
        expect(result.notification.adminHooks.channels[0].key).toBe('********');
        expect(result.notification.adminHooks.channels[0].id).toBe(
          notification.adminHooks.channels[0].id
        );
        const single = await request('/settings?group=security', 'GET', role);
        expect(single.status).toBe(200);
        const singleConfig = (await single.json()).data.config;
        expectNoSigningKeys(singleConfig);
        expect(singleConfig.oauth.providers.github.clientSecret).toBe('********');
      }
    });

    it('serves only valid site metadata and requires super admin to change it', async () => {
      const base = { name: 'Rote', frontendUrl: 'https://example.test' };
      const customMetaTags = '<meta content="verify-123" name="google-site-verification" />';
      const canonical = '<meta name="google-site-verification" content="verify-123">';
      const save = (role: 'admin' | 'super_admin', update: object) =>
        request('/settings', 'PUT', role, { group: 'site', config: { ...base, ...update } });
      const fragment = () => app.request('/v2/api/site/head-meta');

      // An older server allowed unknown site fields in settings.
      expect(
        await config.setConfig('site', {
          ...base,
          customMetaTags: '<script src="https://example.test/untrusted.js"></script>',
        })
      ).toBe(true);
      expect(await (await fragment()).text()).toBe('');

      expect((await save('super_admin', { customMetaTags })).status).toBe(200);
      const publicResponse = await fragment();
      expect(publicResponse.status).toBe(200);
      expect(publicResponse.headers.get('content-type')).toMatch(/^text\/plain/);
      expect(publicResponse.headers.get('cache-control')).toBe('no-store');
      expect(await publicResponse.text()).toBe(canonical);

      expect((await save('admin', { customMetaTags: '' })).status).toBe(403);
      expect((await save('admin', { description: 'Updated site description' })).status).toBe(200);
      const invalid = await save('super_admin', { customMetaTags: '<meta charset="utf-8">' });
      expect(invalid.status).toBe(400);
      expect((await invalid.json()).message).toBe('invalid_custom_meta_tags');
      expect(await (await fragment()).text()).toBe(canonical);

      // An independent server can update the row before this instance refreshes its cache.
      const { mutateStoredConfigs } = await import('./configStore');
      const newerMeta = '<meta name="twitter:creator" content="@rote">';
      await mutateStoredConfigs([
        {
          group: 'site',
          update: (site) => ({ ...(site as SiteConfig), customMetaTags: newerMeta }),
        },
      ]);
      const frontendUrl = 'https://new.example.test';
      const urlUpdate = await request('/settings/update-urls', 'POST', 'admin', { frontendUrl });
      expect(urlUpdate.status).toBe(200);
      expect((await urlUpdate.json()).data.urls.frontendUrl).toBe(frontendUrl);
      expect(await (await fragment()).text()).toBe(newerMeta);

      expect((await save('super_admin', { customMetaTags: '' })).status).toBe(200);
      expect(await (await fragment()).text()).toBe('');
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
    it('masks the storage secret for admins and super admins', async () => {
      const storageFixture = {
        endpoint: 'https://storage.example.test',
        bucket: 'isolated-bucket',
        accessKeyId: 'isolated-access-key',
        secretAccessKey: 'isolated-secret-key',
        urlPrefix: 'https://cdn.example.test',
      };
      expect(await config.setConfig('storage', storageFixture)).toBe(true);
      for (const role of ['admin', 'super_admin'] as const) {
        const response = await request('/settings?group=storage', 'GET', role);
        expect(response.status).toBe(200);
        const stored = (await response.json()).data.config;
        expect(stored.accessKeyId).toBe(storageFixture.accessKeyId);
        expect(stored.secretAccessKey).toBe('********');
        expect(stored.secretAccessKey).not.toBe(storageFixture.secretAccessKey);
      }
    });

    it('never persists the masked storage placeholder', async () => {
      const storageFixture = {
        endpoint: 'https://storage.example.test',
        bucket: 'isolated-bucket',
        accessKeyId: 'isolated-access-key',
        secretAccessKey: 'isolated-secret-key',
        urlPrefix: 'https://cdn.example.test',
      };
      expect(await config.setConfig('storage', storageFixture)).toBe(true);
      // 占位符回传会走配置连通性测试（假端点必然失败返回 400），
      // 关键断言是占位符在任何情况下都不会被持久化。
      const save = await request('/settings', 'PUT', 'admin', {
        group: 'storage',
        config: {
          ...storageFixture,
          secretAccessKey: '********',
          urlPrefix: 'https://cdn.example.test/changed',
        },
      });
      expect([200, 400]).toContain(save.status);
      const stored = await config.getConfig('storage');
      expect(stored?.secretAccessKey).toBe('isolated-secret-key');
    });

    it('gates OAuth credential and callback writes to super admin', async () => {
      const adminSave = (providerPatch: object) =>
        request('/settings', 'PUT', 'admin', {
          group: 'security',
          config: { oauth: { enabled: true, providers: { github: providerPatch } } },
        });
      const github = security.oauth.providers.github;

      // 回调地址重定向（账户接管向量）对普通管理员关闭
      expect(
        (await adminSave({ ...github, callbackUrl: 'https://attacker.example.test/callback' }))
          .status
      ).toBe(403);
      // 真实凭据变更同样关闭
      expect(
        (await adminSave({ ...github, clientSecret: 'attacker-controlled-secret' })).status
      ).toBe(403);
      // 掩码占位符原样回传 + 未变更回调：允许（保持原值）
      expect((await adminSave({ ...github, clientSecret: '********' })).status).toBe(200);
      const stored = await config.getConfig('security');
      expect(stored?.oauth?.providers?.github?.clientSecret).toBe('isolated-provider-secret');
      expect(stored?.oauth?.providers?.github?.callbackUrl).toBe(github.callbackUrl);

      // super admin 可以轮换回调地址
      const rotated = await request('/settings', 'PUT', 'super_admin', {
        group: 'security',
        config: {
          oauth: {
            enabled: true,
            providers: {
              github: { ...github, callbackUrl: 'https://example.test/callback-rotated' },
            },
          },
        },
      });
      expect(rotated.status).toBe(200);
      const rotatedConfig = await config.getConfig('security');
      expect(rotatedConfig?.oauth?.providers?.github?.callbackUrl).toBe(
        'https://example.test/callback-rotated'
      );
    });

    it('masks notification secrets and never persists or echoes placeholders', async () => {
      // GET 掩码（双角色）
      for (const role of ['admin', 'super_admin'] as const) {
        const response = await request('/settings?group=notification', 'GET', role);
        expect(response.status).toBe(200);
        const stored = (await response.json()).data.config;
        expect(stored.vapidPublicKey).toBe(notification.vapidPublicKey);
        expect(stored.vapidPrivateKey).toBe('********');
        expect(stored.adminHooks.channels[0].key).toBe('********');
      }

      // super_admin 保存：掩码回传 → 还原已存机密持久化；响应体回显掩码（非真实值）
      const save = await request('/settings', 'PUT', 'super_admin', {
        group: 'notification',
        config: {
          ...notification,
          vapidPrivateKey: '********',
          adminHooks: {
            ...notification.adminHooks,
            channels: notification.adminHooks.channels.map((channel) => ({
              ...channel,
              key: '********',
            })),
          },
        },
      });
      expect(save.status).toBe(200);
      const echoed = (await save.json()).data.config;
      expect(echoed.vapidPrivateKey).toBe('********');
      expect(echoed.adminHooks.channels[0].key).toBe('********');
      const stored = await config.getConfig('notification');
      expect(stored?.vapidPrivateKey).toBe(notification.vapidPrivateKey);
      expect(stored?.adminHooks?.channels?.[0]?.key).toBe('isolated-bark-key');
    });

    registerSettingsPersistenceCases(() => fixture);
  }
);
