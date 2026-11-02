import { randomUUID } from 'node:crypto';
import type { OAuthProvider, OAuthUserInfo } from '../utils/oauth/providers/base';
import type { OAuthMergeIdentity } from './types';

export const oauthMergeDatabaseUrl = process.env.OAUTH_MERGE_TEST_DATABASE_URL;
export const testProvider = 'merge-test';
export const testPostProvider = 'merge-test-post';
const providerCodes = new Map<string, OAuthUserInfo>();
let providerRegistered = false;

const provider: OAuthProvider = {
  name: testProvider,
  callbackMethod: 'GET',
  requiresAuthProviderInLookup: false,
  async validateConfig(config) {
    if (!config.enabled) throw new Error('provider disabled');
  },
  getAuthUrl(_config, state) {
    return `https://oauth.example.test/authorize?state=${encodeURIComponent(state)}`;
  },
  async exchangeCode(code) {
    const identity = providerCodes.get(code);
    if (!identity) throw new Error('invalid provider authorization code');
    providerCodes.delete(code);
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

export async function createOAuthMergeFixture() {
  if (
    !oauthMergeDatabaseUrl ||
    new URL(oauthMergeDatabaseUrl).pathname !== '/rote_oauth_merge_test'
  ) {
    throw new Error('Use the isolated rote_oauth_merge_test database');
  }
  process.env.POSTGRESQL_URL = oauthMergeDatabaseUrl;
  const [
    hono,
    routes,
    config,
    jwt,
    schema,
    operators,
    database,
    bindings,
    authorization,
    registry,
  ] = await Promise.all([
    import('hono'),
    import('../route/v2/oauth'),
    import('../utils/config'),
    import('../utils/jwt'),
    import('../drizzle/schema'),
    import('drizzle-orm'),
    import('../utils/drizzle'),
    import('../utils/dbMethods/userOAuth'),
    import('./authorization'),
    import('../utils/oauth/providers'),
  ]);
  if (!providerRegistered) {
    registry.oauthProviderRegistry.registerProvider(provider);
    registry.oauthProviderRegistry.registerProvider({
      ...provider,
      name: testPostProvider,
      callbackMethod: 'POST',
    });
    providerRegistered = true;
  }
  const security = {
    jwtSecret: 'oauth-merge-isolated-access-secret',
    jwtRefreshSecret: 'oauth-merge-isolated-refresh-secret',
    sessionSecret: 'oauth-merge-isolated-state-secret',
    jwtAccessExpiry: '1h',
    jwtRefreshExpiry: '1h',
    oauth: {
      enabled: true,
      providers: {
        [testProvider]: {
          enabled: true,
          clientId: 'test',
          clientSecret: 'test',
          callbackUrl: 'http://localhost/callback',
        },
        [testPostProvider]: {
          enabled: true,
          clientId: 'test',
          clientSecret: 'test',
          callbackUrl: 'http://localhost/callback',
        },
        github: {
          enabled: true,
          clientId: 'test',
          clientSecret: 'test',
          callbackUrl: 'http://localhost/callback',
        },
        apple: {
          enabled: true,
          clientId: 'test',
          teamId: 'test',
          keyId: 'test',
          privateKey: 'test',
          callbackUrl: 'http://localhost/callback',
        },
      },
    },
  };
  await config.setConfig('security', security);
  await config.initializeConfig();
  const app = new hono.Hono();
  app.route('/auth/oauth', routes.default);
  const db = database.default;
  const mergedSchema = { ...schema, ...(await import('../drizzle/accountMergeSchema')) };

  const owners: string[] = [];

  async function makeUser() {
    const id = randomUUID();
    owners.push(id);
    await db.insert(schema.users).values({ id, username: id, email: `${id}@example.test` });
    return id;
  }
  async function makePair(providerName: string = testProvider) {
    const sourceUserId = await makeUser();
    const targetUserId = await makeUser();
    const providerId = randomUUID();
    await bindings.bindOAuthProvider(
      sourceUserId,
      providerName,
      providerId,
      'verified-provider-name'
    );
    return { sourceUserId, targetUserId, provider: providerName, providerId };
  }
  async function token(userId: string) {
    return `Bearer ${await jwt.generateAccessToken({ userId, username: userId })}`;
  }
  async function requestMerge(
    identity: OAuthMergeIdentity,
    body?: unknown,
    authorizationHeader?: string
  ) {
    return app.request(`/auth/oauth/${identity.provider}/bind/merge`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: authorizationHeader ?? (await token(identity.targetUserId)),
      },
      body: JSON.stringify(
        body ?? {
          existingUserId: identity.sourceUserId,
          [`${identity.provider}UserId`]: identity.providerId,
          [`${identity.provider}Username`]: 'forged-name',
        }
      ),
    });
  }
  async function initiate(identity: OAuthMergeIdentity) {
    const response = await app.request(
      `/auth/oauth/${identity.provider}/bind?redirect=/profile/setting`,
      {
        headers: { authorization: await token(identity.targetUserId) },
      }
    );
    if (response.status !== 200) throw new Error('test bind initiation failed');
    const data = await response.json();
    return new URL(data.data.redirectUrl).searchParams.get('state')!;
  }
  async function callback(identity: OAuthMergeIdentity, state?: string, code?: string) {
    const providerCode = code ?? randomUUID();
    if (!code)
      providerCodes.set(providerCode, {
        id: identity.providerId,
        username: 'verified-provider-name',
        email: null,
        name: null,
      });
    if (identity.provider === testPostProvider) {
      return app.request(`/auth/oauth/${identity.provider}/callback`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: providerCode,
          state: state ?? (await initiate(identity)),
        }),
      });
    }
    return app.request(
      `/auth/oauth/${identity.provider}/callback?${new URLSearchParams({ code: providerCode, state: state ?? (await initiate(identity)) })}`
    );
  }
  async function grant(identity: OAuthMergeIdentity) {
    const rows = await db
      .select()
      .from(mergedSchema.oauthMergeAuthorizations)
      .where(
        operators.and(
          operators.eq(mergedSchema.oauthMergeAuthorizations.targetUserId, identity.targetUserId),
          operators.eq(mergedSchema.oauthMergeAuthorizations.sourceUserId, identity.sourceUserId),
          operators.eq(mergedSchema.oauthMergeAuthorizations.provider, identity.provider),
          operators.eq(mergedSchema.oauthMergeAuthorizations.providerId, identity.providerId)
        )
      );
    return rows[0] ?? null;
  }
  async function cleanup() {
    if (owners.length) {
      await db
        .delete(schema.attachments)
        .where(operators.inArray(schema.attachments.userid, owners));
      await db
        .delete(schema.resourceStorageObjects)
        .where(operators.inArray(schema.resourceStorageObjects.ownerId, owners));
      await db
        .delete(schema.pushCampaigns)
        .where(operators.inArray(schema.pushCampaigns.createdBy, owners));
      await db
        .delete(schema.roteChanges)
        .where(operators.inArray(schema.roteChanges.userid, owners));
      await db.delete(schema.users).where(operators.inArray(schema.users.id, owners));
    }
    providerCodes.clear();
  }
  return {
    app,
    jwt,
    db,
    schema: mergedSchema,
    operators,
    config,
    security,
    bindings,
    authorization,
    makeUser,
    makePair,
    token,
    requestMerge,
    initiate,
    callback,
    grant,
    cleanup,
  };
}

export type OAuthMergeFixture = Awaited<ReturnType<typeof createOAuthMergeFixture>>;
