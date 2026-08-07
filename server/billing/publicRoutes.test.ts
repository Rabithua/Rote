import { describe, expect, it } from 'bun:test';
import { Hono, type MiddlewareHandler } from 'hono';
import type { BillingGrant } from '../drizzle/schema';
import type { SafeUser, HonoVariables } from '../types/hono';
import type { BillingConfig } from './config';
import {
  billingHttpResponse,
  type BillingGrantProjectionStore,
  type BillingHttpResponse,
} from './delivery';
import type { BillingGrantDelivery } from './grantSnapshot';
import { PaidBillingApiError, type PaidBillingProvider } from './paidClient';
import { BILLING_ACTIVATION_BODY_LIMIT_BYTES, createPublicBillingRouter } from './publicRoutes';

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

const authenticate: MiddlewareHandler<{ Variables: HonoVariables }> = async (c, next) => {
  c.set('user', user);
  await next();
};

const rejectAuthentication: MiddlewareHandler<{ Variables: HonoVariables }> = async (c) =>
  c.json({ code: 401, message: 'Access token required' }, 401);

const enabledConfig = {
  enabled: true,
  instanceId: 'rote-official',
  officialOrigin: 'https://api.rote.ink',
  paidServerUrl: 'https://billing.rote.ink',
  productIds: ['ink.rote.pro.monthly', 'ink.rote.pro.yearly'],
  connectTimeoutMs: 3_000,
  totalTimeoutMs: 10_000,
  roteToPaid: {
    active: { keyId: 'rote-active', secret: 'rote-to-paid-active-secret-00000001' },
  },
  paidToRote: {
    active: { keyId: 'paid-active', secret: 'paid-to-rote-active-secret-00000001' },
  },
} satisfies Extract<BillingConfig, { enabled: true }>;

const snapshot: BillingGrantDelivery = {
  deliveryId: '018f3f5a-7b2c-7d4e-8a91-2b3c4d5e6f71',
  issuer: 'rote-paid-server',
  instanceId: 'rote-official',
  revision: BigInt(42),
  planId: 'rote_pro',
  status: 'active',
  productId: 'ink.rote.pro.yearly',
  entitlementExpiresAt: new Date('2026-08-09T00:00:00.000Z'),
  leaseExpiresAt: new Date('2026-08-08T00:00:00.000Z'),
  capabilities: ['ai.chat', 'attachment.video.upload'],
};

class StubGrantStore implements BillingGrantProjectionStore {
  grant: BillingGrant | null = null;
  applied: Array<{ userId: string; grant: BillingGrantDelivery }> = [];
  applyResponse: BillingHttpResponse = billingHttpResponse(200, 'success', {
    result: 'applied',
    revision: '42',
  });
  applyError: Error | null = null;

  async findGrantForUser() {
    return this.grant;
  }

  async applyGrantSnapshot(userId: string, grant: BillingGrantDelivery) {
    this.applied.push({ userId, grant });
    if (this.applyError) throw this.applyError;
    if (this.applyResponse.status === 200 && this.grant === null) {
      this.grant = databaseGrant({
        revision: grant.revision,
        planId: grant.planId,
        status: grant.status,
        productId: grant.productId,
        entitlementExpiresAt: grant.entitlementExpiresAt,
        leaseExpiresAt: grant.leaseExpiresAt,
        capabilities: grant.capabilities,
      });
    }
    return this.applyResponse;
  }
}

class StubProvider implements PaidBillingProvider {
  sessionUsers: string[] = [];
  activations: Array<{ userId: string; signedTransactionInfo: string }> = [];
  error: Error | null = null;

  async createSession(userId: string) {
    this.sessionUsers.push(userId);
    if (this.error) throw this.error;
    return { appAccountToken: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' };
  }

  async activate(userId: string, signedTransactionInfo: string) {
    this.activations.push({ userId, signedTransactionInfo });
    if (this.error) throw this.error;
    return snapshot;
  }
}

function databaseGrant(overrides: Partial<BillingGrant> = {}): BillingGrant {
  return {
    userId: user.id,
    issuer: 'rote-paid-server',
    instanceId: 'rote-official',
    revision: BigInt(42),
    planId: 'rote_pro',
    status: 'active',
    productId: 'ink.rote.pro.yearly',
    entitlementExpiresAt: new Date('2026-08-09T00:00:00.000Z'),
    leaseExpiresAt: new Date('2026-08-08T00:00:00.000Z'),
    capabilities: ['ai.chat', 'attachment.video.upload'],
    snapshotHash: 'a'.repeat(64),
    updatedAt: new Date('2026-08-07T00:00:00.000Z'),
    ...overrides,
  };
}

function createApp(
  params: {
    config?: BillingConfig;
    store?: StubGrantStore;
    provider?: StubProvider | null;
    auth?: MiddlewareHandler<{ Variables: HonoVariables }>;
    now?: Date;
    dynamicApiUrl?: string;
  } = {}
) {
  const store = params.store ?? new StubGrantStore();
  const provider = params.provider === undefined ? new StubProvider() : params.provider;
  const app = new Hono<{ Variables: HonoVariables }>();
  if (params.dynamicApiUrl) {
    app.use('*', async (c, next) => {
      c.set('dynamicApiUrl', params.dynamicApiUrl);
      await next();
    });
  }
  app.route(
    '/v2/api/billing',
    createPublicBillingRouter({
      config: params.config ?? enabledConfig,
      grantStore: store,
      provider,
      authenticate: params.auth ?? authenticate,
      now: () => params.now ?? new Date('2026-08-07T12:00:00.000Z'),
    })
  );
  return { app, store, provider };
}

describe('public billing routes', () => {
  it('returns safe config only for the exact official origin and instance', async () => {
    const { app } = createApp();
    const response = await app.request('https://api.rote.ink/v2/api/billing/config');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      code: 0,
      message: 'success',
      data: {
        enabled: true,
        officialOrigin: 'https://api.rote.ink',
        products: ['ink.rote.pro.monthly', 'ink.rote.pro.yearly'],
        features: { offerCode: true, promotedPurchases: false },
      },
    });
    expect(JSON.stringify(body)).not.toContain('billing.rote.ink');
    expect(JSON.stringify(body)).not.toContain('rote-active');

    for (const url of [
      'https://api.rote.ink.evil.example/v2/api/billing/config',
      'https://sub.api.rote.ink/v2/api/billing/config',
      'http://api.rote.ink/v2/api/billing/config',
    ]) {
      expect((await (await app.request(url)).json()).data).toEqual({
        enabled: false,
        officialOrigin: 'https://api.rote.ink',
        products: ['ink.rote.pro.monthly', 'ink.rote.pro.yearly'],
        features: { offerCode: true, promotedPurchases: false },
      });
    }

    const proxied = createApp({ dynamicApiUrl: 'https://api.rote.ink' });
    expect(
      (await (await proxied.app.request('http://internal:3000/v2/api/billing/config')).json()).data
        .enabled
    ).toBe(true);

    const wrongInstance = createApp({
      config: { ...enabledConfig, instanceId: 'rote-official-lookalike' },
    });
    expect(
      (await (await wrongInstance.app.request('https://api.rote.ink/v2/api/billing/config')).json())
        .data.enabled
    ).toBe(false);
  });

  it('keeps disabled self-hosted config safe and protects every other route with JWT', async () => {
    const disabled = createApp({ config: { enabled: false }, provider: null });
    expect(
      (await (await disabled.app.request('https://api.rote.ink/v2/api/billing/config')).json()).data
    ).toEqual({
      enabled: false,
      officialOrigin: 'https://api.rote.ink',
      products: ['ink.rote.pro.monthly', 'ink.rote.pro.yearly'],
      features: { offerCode: true, promotedPurchases: false },
    });
    expect(
      (
        await disabled.app.request('https://api.rote.ink/v2/api/billing/me', {
          headers: { authorization: 'Bearer irrelevant' },
        })
      ).status
    ).toBe(403);

    const unauthenticated = createApp({ auth: rejectAuthentication });
    for (const [path, method, body] of [
      ['/me', 'GET', undefined],
      ['/app-store/session', 'POST', '{}'],
      ['/app-store/activate', 'POST', '{"signedTransactionInfo":"jws"}'],
    ] as const) {
      const response = await unauthenticated.app.request(
        `https://api.rote.ink/v2/api/billing${path}`,
        { method, body }
      );
      expect(response.status).toBe(401);
    }
  });

  it('reads only the local grant and fails closed exactly at the lease boundary', async () => {
    const store = new StubGrantStore();
    store.grant = databaseGrant();
    const provider = new StubProvider();
    const before = createApp({
      store,
      provider,
      now: new Date('2026-08-07T23:59:59.999Z'),
    });
    expect(
      (await (await before.app.request('https://api.rote.ink/v2/api/billing/me')).json()).data
    ).toMatchObject({ status: 'active', capabilities: ['ai.chat', 'attachment.video.upload'] });

    const boundary = createApp({
      store,
      provider,
      now: new Date('2026-08-08T00:00:00.000Z'),
    });
    expect(
      (await (await boundary.app.request('https://api.rote.ink/v2/api/billing/me')).json()).data
    ).toMatchObject({ status: 'unavailable', capabilities: [] });
    expect(provider.sessionUsers).toHaveLength(0);
    expect(provider.activations).toHaveLength(0);
  });

  it('returns the complete empty BillingStatusDTO when no local grant exists', async () => {
    const { app } = createApp();
    expect(
      (await (await app.request('https://api.rote.ink/v2/api/billing/me')).json()).data
    ).toEqual({
      planId: null,
      status: 'none',
      productId: null,
      entitlementExpiresAt: null,
      leaseExpiresAt: null,
      capabilities: [],
    });
  });

  it('creates a Paid session for the logged-in user and returns only the local Product allowlist', async () => {
    const { app, provider } = createApp();
    const response = await app.request('https://api.rote.ink/v2/api/billing/app-store/session', {
      method: 'POST',
    });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      appAccountToken: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      products: ['ink.rote.pro.monthly', 'ink.rote.pro.yearly'],
    });
    expect(provider?.sessionUsers).toEqual([user.id]);

    const explicitEmptyObject = await app.request(
      'https://api.rote.ink/v2/api/billing/app-store/session',
      { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }
    );
    expect(explicitEmptyObject.status).toBe(200);
    expect(provider?.sessionUsers).toEqual([user.id, user.id]);
  });

  it('applies the exact Paid activation snapshot locally before returning success', async () => {
    const { app, store } = createApp();
    const response = await app.request('https://api.rote.ink/v2/api/billing/app-store/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ signedTransactionInfo: 'private-jws' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      code: 0,
      message: 'success',
      data: {
        planId: 'rote_pro',
        status: 'active',
        productId: 'ink.rote.pro.yearly',
        entitlementExpiresAt: '2026-08-09T00:00:00.000Z',
        leaseExpiresAt: '2026-08-08T00:00:00.000Z',
        capabilities: ['ai.chat', 'attachment.video.upload'],
      },
    });
    expect(store.applied).toEqual([{ userId: user.id, grant: snapshot }]);
  });

  it('returns the current local status after ignored or duplicate activation snapshots', async () => {
    for (const result of ['ignored', 'duplicate'] as const) {
      const store = new StubGrantStore();
      store.grant = databaseGrant({
        revision: BigInt(43),
        productId: 'ink.rote.pro.monthly',
      });
      store.applyResponse = billingHttpResponse(200, 'success', { result, revision: '43' });
      const { app } = createApp({ store });
      const response = await app.request('https://api.rote.ink/v2/api/billing/app-store/activate', {
        method: 'POST',
        body: JSON.stringify({ signedTransactionInfo: 'private-jws' }),
      });
      expect(response.status).toBe(200);
      expect((await response.json()).data).toMatchObject({
        status: 'active',
        productId: 'ink.rote.pro.monthly',
      });
    }
  });

  it('maps Paid stable errors and every local projection failure without logging the JWS', async () => {
    const provider = new StubProvider();
    provider.error = new PaidBillingApiError(400, 'billing_invalid_transaction');
    const invalid = createApp({ provider });
    const invalidResponse = await invalid.app.request(
      'https://api.rote.ink/v2/api/billing/app-store/activate',
      {
        method: 'POST',
        body: JSON.stringify({ signedTransactionInfo: 'private-jws' }),
      }
    );
    expect(invalidResponse.status).toBe(400);
    expect((await invalidResponse.json()).message).toBe('billing_invalid_transaction');

    for (const applyFailure of [
      billingHttpResponse(409, 'billing_grant_revision_conflict'),
      billingHttpResponse(404, 'billing_grant_user_not_found'),
    ]) {
      const store = new StubGrantStore();
      store.applyResponse = applyFailure;
      const localFailure = createApp({ store });
      const response = await localFailure.app.request(
        'https://api.rote.ink/v2/api/billing/app-store/activate',
        {
          method: 'POST',
          body: JSON.stringify({ signedTransactionInfo: 'private-jws' }),
        }
      );
      expect(response.status).toBe(503);
      expect((await response.json()).message).toBe('billing_provider_unavailable');
    }

    const store = new StubGrantStore();
    store.applyError = new Error('database transaction failed');
    const transactionFailure = createApp({ store });
    const response = await transactionFailure.app.request(
      'https://api.rote.ink/v2/api/billing/app-store/activate',
      {
        method: 'POST',
        body: JSON.stringify({ signedTransactionInfo: 'private-jws' }),
      }
    );
    expect(response.status).toBe(503);
    expect((await response.json()).message).toBe('billing_provider_unavailable');
  });

  it('stops an oversized activation body before buffering or forwarding its JWS', async () => {
    const { app, provider } = createApp();
    const totalChunks = 128;
    let chunksRead = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunksRead += 1;
        controller.enqueue(new Uint8Array(1024));
        if (chunksRead === totalChunks) controller.close();
      },
    });
    const response = await app.request(
      new Request('https://api.rote.ink/v2/api/billing/app-store/activate', {
        method: 'POST',
        body,
        duplex: 'half',
      } as RequestInit & { duplex: 'half' })
    );

    expect(response.status).toBe(413);
    expect(chunksRead).toBeLessThan(totalChunks);
    expect(chunksRead * 1024).toBeLessThanOrEqual(BILLING_ACTIVATION_BODY_LIMIT_BYTES + 1024);
    expect(provider?.activations).toHaveLength(0);
  });
});
