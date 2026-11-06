import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { OAuthProvider, OAuthUserInfo } from '../utils/oauth/providers/base';

const databaseUrl = process.env.AUTH_REGISTRATION_TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;
const providerName = 'registration-test';
const identities = new Map<string, OAuthUserInfo>();
const provider: OAuthProvider = {
  name: providerName,
  callbackMethod: 'GET',
  requiresAuthProviderInLookup: false,
  async validateConfig(config) {
    if (!config.enabled) throw new Error('provider disabled');
  },
  getAuthUrl(_config, state) {
    return `https://oauth.example.test/authorize?state=${encodeURIComponent(state)}`;
  },
  async exchangeCode(code) {
    const identity = identities.get(code);
    if (!identity) throw new Error('invalid authorization code');
    identities.delete(code);
    return identity;
  },
  async getUserInfo(identity) {
    return identity;
  },
  getConfigSchema() {
    return { fields: [] };
  },
  getErrorMessages() {
    return [];
  },
};

async function createFixture() {
  if (!databaseUrl || new URL(databaseUrl).pathname !== '/rote_auth_registration_test') {
    throw new Error('Use the isolated rote_auth_registration_test database');
  }
  process.env.POSTGRESQL_URL = databaseUrl;
  const [
    hono,
    oauth,
    registration,
    database,
    config,
    schema,
    registrationSchema,
    operators,
    registry,
  ] = await Promise.all([
    import('hono'),
    import('../route/v2/oauth'),
    import('../route/v2/authOAuthRegistration'),
    import('../utils/drizzle'),
    import('../utils/config'),
    import('../drizzle/schema'),
    import('../drizzle/oauthRegistrationSchema'),
    import('drizzle-orm'),
    import('../utils/oauth/providers'),
  ]);
  registry.oauthProviderRegistry.registerProvider(provider);
  const security = {
    jwtSecret: 'registration-test-access-secret',
    jwtRefreshSecret: 'registration-test-refresh-secret',
    sessionSecret: 'registration-test-state-secret',
    jwtAccessExpiry: '1h',
    jwtRefreshExpiry: '1h',
    oauth: {
      enabled: true,
      providers: {
        [providerName]: {
          enabled: true,
          clientId: 'test',
          clientSecret: 'test',
          callbackUrl: 'http://localhost/callback',
        },
      },
    },
  };
  const app = new hono.Hono();
  app.route('/auth/oauth', oauth.default);
  app.route('/auth/register/oauth', registration.default);
  const db = database.default;
  const usernames: string[] = [];
  const tokenHashes: string[] = [];

  function username() {
    const value = `or_${randomBytes(5).toString('hex')}`;
    usernames.push(value);
    return value;
  }

  async function resetConfig() {
    await config.setConfig('ui', { allowRegistration: true, defaultUserRole: 'user' });
    await config.setConfig('security', security);
    await config.setConfig('site', { frontendUrl: 'http://localhost:3001', name: 'Test' });
    await config.initializeConfig();
  }

  async function callback(
    identity: OAuthUserInfo = {
      id: randomUUID(),
      username: username(),
      email: 'not-required@example.test',
      name: 'Provider name',
    },
    options: { ios?: boolean; redirect?: string } = {}
  ) {
    const query = new URLSearchParams({
      type: options.ios ? 'ioslogin' : 'web',
      redirect: options.redirect || '/login',
    });
    const initiation = await app.request(`/auth/oauth/${providerName}?${query}`);
    const state = new URL(initiation.headers.get('location')!).searchParams.get('state')!;
    const code = randomUUID();
    identities.set(code, identity);
    const response = await app.request(
      `/auth/oauth/${providerName}/callback?${new URLSearchParams({ state, code })}`
    );
    const destination = new URL(response.headers.get('location')!);
    const token = destination.searchParams.get('registrationToken');
    if (token) tokenHashes.push(createHash('sha256').update(token).digest('hex'));
    return { response, destination, token: token!, identity };
  }

  async function complete(token: string, selectedUsername: string, extra: object = {}) {
    return await app.request('/auth/register/oauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationToken: token, username: selectedUsername, ...extra }),
    });
  }

  async function usersFor(names: string[]) {
    return await db
      .select()
      .from(schema.users)
      .where(operators.inArray(schema.users.username, names));
  }

  async function cleanup() {
    if (tokenHashes.length) {
      await db
        .delete(registrationSchema.oauthRegistrationAuthorizations)
        .where(
          operators.inArray(
            registrationSchema.oauthRegistrationAuthorizations.tokenHash,
            tokenHashes
          )
        );
    }
    if (usernames.length) {
      await db.delete(schema.users).where(operators.inArray(schema.users.username, usernames));
    }
  }
  return {
    db,
    schema,
    registrationSchema,
    operators,
    config,
    app,
    security,
    username,
    resetConfig,
    callback,
    complete,
    usersFor,
    cleanup,
  };
}

databaseDescribe('OAuth username-only registration with PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createFixture>>;
  beforeAll(async () => {
    fixture = await createFixture();
  });
  beforeEach(async () => {
    await fixture.resetConfig();
  });
  afterAll(async () => {
    await fixture?.cleanup();
  });

  it('waits for username confirmation, then registers without collecting or matching email', async () => {
    const legacyName = fixture.username();
    await fixture.db
      .insert(fixture.schema.users)
      .values({ username: legacyName, email: 'not-required@example.test' });
    const pending = await fixture.callback();
    expect(pending.destination.pathname).toBe('/login');
    expect(pending.destination.searchParams.get('oauth')).toBe('register');
    expect(pending.destination.searchParams.has('token')).toBe(false);
    expect(await fixture.usersFor([pending.identity.username])).toHaveLength(0);
    const options = await fixture.app.request(`/auth/register/oauth/${pending.token}`);
    expect(options.headers.get('cache-control')).toBe('no-store');
    expect((await options.json()).data).toEqual({
      provider: providerName,
      suggestedUsername: pending.identity.username,
    });
    const response = await fixture.complete(pending.token, pending.identity.username);
    expect(response.status).toBe(201);
    const result = (await response.json()).data;
    expect(result.user.email).toBeNull();
    expect(result.user.nickname).toBe(pending.identity.username);
    expect(result.user.passwordhash).toBeUndefined();
    expect(result.accessToken).toBeString();
    const destination = new URL(result.completionUrl);
    expect(destination.searchParams.get('oauth')).toBe('success');
    expect(destination.searchParams.get('token')).toBe(result.accessToken);
    expect((await fixture.complete(pending.token, fixture.username())).status).toBe(410);
  });

  it('keeps the authorization usable after invalid or occupied usernames', async () => {
    const pending = await fixture.callback();
    expect((await fixture.complete(pending.token, 'name with spaces')).status).toBe(400);
    expect((await fixture.complete(pending.token, 'login')).status).toBe(400);
    const occupied = fixture.username();
    await fixture.db.insert(fixture.schema.users).values({ username: occupied, email: null });
    const conflict = await fixture.complete(pending.token, occupied);
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).errorCode).toBe('username_unavailable');
    expect((await fixture.complete(pending.token, fixture.username())).status).toBe(201);
  });

  it('checks registration and provider enablement again when completing', async () => {
    const pending = await fixture.callback();
    await fixture.config.setConfig('ui', { allowRegistration: false });
    const disabled = await fixture.complete(pending.token, fixture.username());
    expect(disabled.status).toBe(403);
    expect((await disabled.json()).errorCode).toBe('registration_disabled');
    await fixture.config.setConfig('ui', { allowRegistration: true });
    await fixture.config.setConfig('security', {
      ...fixture.security,
      oauth: { ...fixture.security.oauth, enabled: false },
    });
    const providerDisabled = await fixture.complete(pending.token, fixture.username());
    expect(providerDisabled.status).toBe(403);
    expect((await providerDisabled.json()).errorCode).toBe('oauth_disabled');
  });

  it('honors stored policy changes while this process still has enabled cached configuration', async () => {
    const pending = await fixture.callback();
    await fixture.db
      .update(fixture.schema.settings)
      .set({ config: { allowRegistration: false } })
      .where(fixture.operators.eq(fixture.schema.settings.group, 'ui'));
    const registrationDisabled = await fixture.complete(pending.token, fixture.username());
    expect(registrationDisabled.status).toBe(403);
    expect((await registrationDisabled.json()).errorCode).toBe('registration_disabled');
    await fixture.db
      .update(fixture.schema.settings)
      .set({ config: { allowRegistration: true } })
      .where(fixture.operators.eq(fixture.schema.settings.group, 'ui'));
    await fixture.db
      .update(fixture.schema.settings)
      .set({
        config: { ...fixture.security, oauth: { ...fixture.security.oauth, enabled: false } },
      })
      .where(fixture.operators.eq(fixture.schema.settings.group, 'security'));
    const providerDisabled = await fixture.complete(pending.token, fixture.username());
    expect(providerDisabled.status).toBe(403);
    expect((await providerDisabled.json()).errorCode).toBe('oauth_disabled');
    await fixture.db
      .update(fixture.schema.settings)
      .set({ config: fixture.security })
      .where(fixture.operators.eq(fixture.schema.settings.group, 'security'));
    expect((await fixture.complete(pending.token, fixture.username())).status).toBe(201);
  });

  it('rejects invalid, expired, and consumed credentials without creating accounts', async () => {
    expect((await fixture.app.request('/auth/register/oauth/invalid')).status).toBe(410);
    const pending = await fixture.callback();
    await fixture.db
      .update(fixture.registrationSchema.oauthRegistrationAuthorizations)
      .set({ expiresAt: new Date(0) })
      .where(
        fixture.operators.eq(
          fixture.registrationSchema.oauthRegistrationAuthorizations.tokenHash,
          createHash('sha256').update(pending.token).digest('hex')
        )
      );
    expect((await fixture.complete(pending.token, pending.identity.username)).status).toBe(410);
    expect(await fixture.usersFor([pending.identity.username])).toHaveLength(0);
  });

  it('consumes one authorization only once during simultaneous submissions', async () => {
    const pending = await fixture.callback();
    const names = [fixture.username(), fixture.username()];
    const responses = await Promise.all(names.map((name) => fixture.complete(pending.token, name)));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 410]);
    expect(await fixture.usersFor(names)).toHaveLength(1);
  });

  it('rolls back the losing account when the same provider identity registers concurrently', async () => {
    const first = await fixture.callback();
    const second = await fixture.callback(first.identity);
    const names = [fixture.username(), fixture.username()];
    const responses = await Promise.all([
      fixture.complete(first.token, names[0]),
      fixture.complete(second.token, names[1]),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await fixture.usersFor(names)).toHaveLength(1);
  });

  it('uses only server-held Web/MCP and iOS return contexts', async () => {
    const redirect = '/oauth/authorize?requestId=request-123&client=example';
    const web = await fixture.callback(undefined, {
      redirect: `/login?redirect=${encodeURIComponent(redirect)}`,
    });
    const response = await fixture.complete(web.token, fixture.username(), {
      redirectUrl: '//evil.test',
      iosLogin: true,
      providerId: 'forged',
    });
    const destination = new URL((await response.json()).data.completionUrl);
    expect(destination.origin).toBe('http://localhost:3001');
    expect(destination.searchParams.get('redirect')).toBe(redirect);
    const ios = await fixture.callback(undefined, { ios: true });
    expect(ios.destination.searchParams.get('type')).toBe('ioslogin');
    const iosResponse = await fixture.complete(ios.token, fixture.username());
    expect(new URL((await iosResponse.json()).data.completionUrl).protocol).toBe('rote:');
  });

  it('continues existing bound logins while registration is closed', async () => {
    const pending = await fixture.callback();
    const selectedUsername = fixture.username();
    expect((await fixture.complete(pending.token, selectedUsername)).status).toBe(201);
    await fixture.config.setConfig('ui', { allowRegistration: false });
    const existing = await fixture.callback(pending.identity);
    expect(existing.destination.searchParams.get('oauth')).toBe('success');
    expect(existing.destination.searchParams.has('registrationToken')).toBe(false);
    const newcomer = await fixture.callback();
    expect(newcomer.destination.searchParams.get('errorCode')).toBe('registration_disabled');
  });
});
