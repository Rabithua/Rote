import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import {
  createOAuthMergeFixture,
  oauthMergeDatabaseUrl,
  type OAuthMergeFixture,
} from './integrationFixture';

const databaseDescribe = oauthMergeDatabaseUrl ? describe : describe.skip;

databaseDescribe('OAuth merge HTTP authorization with actual JWT and PostgreSQL', () => {
  let fixture: OAuthMergeFixture;
  beforeAll(async () => {
    fixture = await createOAuthMergeFixture();
  });
  afterAll(async () => {
    await fixture?.cleanup();
  });

  it('rejects known correct account IDs without a successful OAuth callback', async () => {
    const identity = await fixture.makePair();
    const response = await fixture.requestMerge(identity);
    expect(response.status).toBe(403);
    expect((await response.json()).errorCode).toBe('oauth_merge_authorization_required');
    expect(await fixture.grant(identity)).toBeNull();
    const source = await fixture.db
      .select()
      .from(fixture.schema.users)
      .where(fixture.operators.eq(fixture.schema.users.id, identity.sourceUserId));
    expect(source).toHaveLength(1);
  });

  it('does not grant authority at initiation, from a signed state, or after failed code exchange', async () => {
    const identity = await fixture.makePair();
    const state = await fixture.initiate(identity);
    expect(await fixture.grant(identity)).toBeNull();
    const forged = await fixture.requestMerge(identity, {
      existingUserId: identity.sourceUserId,
      [`${identity.provider}UserId`]: identity.providerId,
      state,
    });
    expect(forged.status).toBe(403);
    const callback = await fixture.callback(identity, state, 'unknown-provider-code');
    expect(new URL(callback.headers.get('location')!).searchParams.get('oauth')).toBe('bind');
    expect(await fixture.grant(identity)).toBeNull();
    expect((await fixture.requestMerge(identity)).status).toBe(403);
  });

  it('creates a ten-minute authorization only after provider verification and preserves the redirect contract', async () => {
    const identity = await fixture.makePair();
    const start = Date.now();
    const response = await fixture.callback(identity);
    expect(response.status).toBe(302);
    const redirect = new URL(response.headers.get('location')!);
    expect(redirect.pathname).toBe('/profile/setting');
    expect(redirect.searchParams.get('bind')).toBe('merge_required');
    expect(redirect.searchParams.get('existingUserId')).toBe(identity.sourceUserId);
    expect(redirect.searchParams.get(`${identity.provider}UserId`)).toBe(identity.providerId);
    const grant = await fixture.grant(identity);
    expect(grant?.targetUserId).toBe(identity.targetUserId);
    expect(grant?.completedAt).toBeNull();
    expect(grant!.expiresAt.getTime()).toBeGreaterThanOrEqual(start + 10 * 60 * 1000);
    expect(grant!.expiresAt.getTime()).toBeLessThan(Date.now() + 10 * 60 * 1000 + 1000);
  });

  it('scopes verified authorization to the exact JWT user, source, provider and subject', async () => {
    const identity = await fixture.makePair();
    await fixture.callback(identity);
    const other = await fixture.makeUser();
    for (const changed of [
      { ...identity, targetUserId: other },
      { ...identity, sourceUserId: other },
      { ...identity, providerId: randomUUID() },
      { ...identity, provider: 'github' },
    ]) {
      expect((await fixture.requestMerge(changed)).status).toBe(403);
    }
    expect((await fixture.grant(identity))?.completedAt).toBeNull();
  });

  it('rejects expired authorization and stale binding identities without deleting the source', async () => {
    const expired = await fixture.makePair();
    await fixture.callback(expired);
    await fixture.db
      .update(fixture.schema.oauthMergeAuthorizations)
      .set({ expiresAt: new Date(0) })
      .where(
        fixture.operators.eq(
          fixture.schema.oauthMergeAuthorizations.targetUserId,
          expired.targetUserId
        )
      );
    expect((await fixture.requestMerge(expired)).status).toBe(403);
    const stale = await fixture.makePair();
    await fixture.callback(stale);
    const bindingId = (await fixture.grant(stale))!.sourceBindingId;
    await fixture.db
      .delete(fixture.schema.userOAuthBindings)
      .where(fixture.operators.eq(fixture.schema.userOAuthBindings.id, bindingId));
    await fixture.db.insert(fixture.schema.userOAuthBindings).values({
      userid: stale.sourceUserId,
      provider: stale.provider,
      providerId: stale.providerId,
    });
    const response = await fixture.requestMerge(stale);
    expect(response.status).toBe(409);
    expect((await response.json()).errorCode).toBe('oauth_merge_conflict');
  });

  it('observes stored OAuth disablement even while the route config cache is enabled', async () => {
    const identity = await fixture.makePair();
    await fixture.callback(identity);
    for (const security of [
      { ...fixture.security, oauth: { ...fixture.security.oauth, enabled: false } },
      {
        ...fixture.security,
        oauth: {
          ...fixture.security.oauth,
          providers: {
            ...fixture.security.oauth.providers,
            [identity.provider]: {
              ...fixture.security.oauth.providers[identity.provider],
              enabled: false,
            },
          },
        },
      },
    ]) {
      await fixture.db
        .update(fixture.schema.settings)
        .set({ config: security })
        .where(fixture.operators.eq(fixture.schema.settings.group, 'security'));
      try {
        const response = await fixture.requestMerge(identity);
        expect(response.status).toBe(403);
        expect((await response.json()).errorCode).toBe('oauth_merge_disabled');
      } finally {
        await fixture.config.setConfig('security', fixture.security);
      }
    }
    expect((await fixture.grant(identity))?.completedAt).toBeNull();
  });

  it('requires current JWT authentication and rejects malformed request representations', async () => {
    const identity = await fixture.makePair();
    for (const token of ['', 'Bearer invalid-token']) {
      expect((await fixture.requestMerge(identity, undefined, token)).status).toBe(401);
    }
    for (const body of [
      [],
      'body',
      {},
      { existingUserId: 'bad', [`${identity.provider}UserId`]: identity.providerId },
    ]) {
      expect((await fixture.requestMerge(identity, body)).status).toBe(400);
    }
    const invalidJson = await fixture.app.request(`/auth/oauth/${identity.provider}/bind/merge`, {
      method: 'POST',
      headers: {
        authorization: await fixture.token(identity.targetUserId),
        'content-type': 'application/json',
      },
      body: '{',
    });
    expect(invalidJson.status).toBe(400);
  });

  it('accepts a valid pending authorization after the stored provider is re-enabled despite stale disabled cache', async () => {
    const identity = await fixture.makePair();
    await fixture.callback(identity);
    await fixture.config.setConfig('security', {
      ...fixture.security,
      oauth: { ...fixture.security.oauth, enabled: false },
    });
    await fixture.db
      .update(fixture.schema.settings)
      .set({ config: fixture.security })
      .where(fixture.operators.eq(fixture.schema.settings.group, 'security'));
    try {
      expect((await fixture.requestMerge(identity)).status).toBe(200);
    } finally {
      await fixture.config.setConfig('security', fixture.security);
    }
  });
});
