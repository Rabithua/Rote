import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import {
  createOAuthMergeFixture,
  oauthMergeDatabaseUrl,
  testPostProvider,
  testProvider,
  type OAuthMergeFixture,
} from './integrationFixture';

const databaseDescribe = oauthMergeDatabaseUrl ? describe : describe.skip;

databaseDescribe('existing OAuth login and binding continuations', () => {
  let fixture: OAuthMergeFixture;
  beforeAll(async () => {
    fixture = await createOAuthMergeFixture();
  });
  afterAll(async () => {
    await fixture?.cleanup();
  });

  it('supports the POST callback method used by Apple through verified merge confirmation', async () => {
    const identity = await fixture.makePair(testPostProvider);
    const wrongMethod = await fixture.app.request(`/auth/oauth/${identity.provider}/callback`);
    expect(wrongMethod.status).toBe(405);
    const callback = await fixture.callback(identity);
    expect(callback.status).toBe(302);
    expect(new URL(callback.headers.get('location')!).searchParams.get('bind')).toBe(
      'merge_required'
    );
    expect((await fixture.grant(identity))?.providerId).toBe(identity.providerId);
    expect((await fixture.requestMerge(identity)).status).toBe(200);
  });

  it('retains ordinary successful binding for both GET and POST providers', async () => {
    for (const provider of [testProvider, testPostProvider]) {
      const targetUserId = await fixture.makeUser();
      const identity = {
        targetUserId,
        sourceUserId: randomUUID(),
        provider,
        providerId: randomUUID(),
      };
      const response = await fixture.callback(identity);
      expect(response.status).toBe(302);
      expect(new URL(response.headers.get('location')!).searchParams.get('bind')).toBe('success');
      expect(await fixture.grant(identity)).toBeNull();
      const bindings = await fixture.bindings.getUserOAuthBindings(targetUserId);
      expect(bindings).toHaveLength(1);
      expect(bindings[0].providerId).toBe(identity.providerId);
    }
  });

  it('retains browser login and iOS deep-link token redirects without issuing merge authority', async () => {
    const identity = await fixture.makePair();
    for (const iosLogin of [false, true]) {
      const start = await fixture.app.request(
        `/auth/oauth/${identity.provider}?redirect=/login${iosLogin ? '&type=ioslogin' : ''}`
      );
      expect(start.status).toBe(302);
      const state = new URL(start.headers.get('location')!).searchParams.get('state')!;
      const callback = await fixture.callback(identity, state);
      expect(callback.status).toBe(302);
      const redirect = new URL(callback.headers.get('location')!);
      if (iosLogin) {
        expect(redirect.protocol).toBe('rote:');
        expect(redirect.hostname).toBe('callback');
      } else {
        expect(redirect.pathname).toBe('/login');
        expect(redirect.searchParams.get('oauth')).toBe('success');
      }
      const payload = await fixture.jwt.verifyAccessToken(redirect.searchParams.get('token')!);
      expect(payload.userId).toBe(identity.sourceUserId);
      expect(redirect.searchParams.get('refreshToken')).toBeTruthy();
      expect(await fixture.grant(identity)).toBeNull();
    }
  });

  it('keeps asynchronous binding and login failures inside the OAuth error redirect flow', async () => {
    const identity = await fixture.makePair();
    const bindState = await fixture.initiate(identity);
    await fixture.bindings.bindOAuthProvider(
      identity.targetUserId,
      identity.provider,
      randomUUID()
    );
    const bindFailure = await fixture.callback(identity, bindState);
    expect(bindFailure.status).toBe(302);
    const bindRedirect = new URL(bindFailure.headers.get('location')!);
    expect(bindRedirect.searchParams.get('oauth')).toBe('bind');
    expect(bindRedirect.searchParams.get('bind')).toBe('error');
    expect(await fixture.grant(identity)).toBeNull();
    const start = await fixture.app.request(`/auth/oauth/${identity.provider}?redirect=/login`);
    const loginState = new URL(start.headers.get('location')!).searchParams.get('state')!;
    const loginFailure = await fixture.callback({ ...identity, providerId: '' }, loginState);
    expect(loginFailure.status).toBe(302);
    const loginRedirect = new URL(loginFailure.headers.get('location')!);
    expect(loginRedirect.pathname).toBe('/login');
    expect(loginRedirect.searchParams.get('oauth')).toBe('error');
  });
});
