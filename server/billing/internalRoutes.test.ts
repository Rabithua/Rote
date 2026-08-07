import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import type { BillingConfig } from './config';
import {
  billingHttpResponse,
  type AuthenticatedInboundDelivery,
  type BillingGrantStore,
  type BillingHttpResponse,
} from './delivery';
import fixture from './fixtures/provisional-v1.json';
import { createInternalBillingRouter } from './internalRoutes';
import { BILLING_SIGNATURE_HEADERS, signBillingRequest } from './signature';

const active = {
  keyId: fixture.fixtureKey.keyId,
  secret: fixture.fixtureKey.secret,
};
const previous = {
  keyId: 'paid-previous-2026-07',
  secret: 'paid-to-rote-previous-fixture-secret-01',
};
const enabledConfig: BillingConfig = {
  enabled: true,
  instanceId: 'rote-official',
  officialOrigin: 'https://api.rote.ink',
  paidServerUrl: 'https://billing.rote.ink',
  productIds: ['ink.rote.pro.monthly', 'ink.rote.pro.yearly'],
  roteToPaid: {
    active: { keyId: 'rote-active', secret: 'rote-to-paid-route-fixture-secret-01' },
  },
  paidToRote: { active, previous },
};

class StubGrantStore implements BillingGrantStore {
  deliveries: AuthenticatedInboundDelivery[] = [];
  nextResponse: BillingHttpResponse | null = null;

  async findGrantForUser() {
    return null;
  }

  async processInboundDelivery(delivery: AuthenticatedInboundDelivery) {
    this.deliveries.push(delivery);
    return (
      this.nextResponse ??
      (delivery.outcome.kind === 'response'
        ? delivery.outcome.response
        : billingHttpResponse(200, 'success', {
            result: 'applied',
            revision: delivery.outcome.grant.revision.toString(),
          }))
    );
  }
}

function createApp(config: BillingConfig, store: StubGrantStore) {
  const app = new Hono();
  app.route(
    '/internal/billing',
    createInternalBillingRouter({
      config,
      grantStore: store,
      now: () => new Date(Number(fixture.hmacCase.timestamp) * 1000),
    })
  );
  return app;
}

function signedRequest(key = active, body = fixture.hmacCase.body) {
  const signed = signBillingRequest({
    key,
    method: fixture.hmacCase.method,
    pathAndQuery: fixture.hmacCase.rawPathAndQuery,
    timestamp: fixture.hmacCase.timestamp,
    requestId: fixture.hmacCase.requestId,
    body,
  });
  return new Request(`https://api.rote.ink${fixture.hmacCase.rawPathAndQuery}`, {
    method: fixture.hmacCase.method,
    headers: {
      'content-type': 'application/json',
      [BILLING_SIGNATURE_HEADERS.keyId]: key.keyId,
      [BILLING_SIGNATURE_HEADERS.timestamp]: fixture.hmacCase.timestamp,
      [BILLING_SIGNATURE_HEADERS.requestId]: fixture.hmacCase.requestId,
      [BILLING_SIGNATURE_HEADERS.signature]: signed.signature,
    },
    body,
  });
}

describe('internal billing grant route', () => {
  it('keeps disabled self-hosted servers independent of Paid configuration', async () => {
    const store = new StubGrantStore();
    const response = await createApp({ enabled: false }, store).request(
      `/internal/billing/grants/${fixture.hmacCase.userId}`,
      { method: 'PUT' }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      code: 1,
      message: 'billing_not_configured',
      data: null,
    });
    expect(store.deliveries).toHaveLength(0);
  });

  it('verifies and parses an active-key grant before handing it to the store', async () => {
    const store = new StubGrantStore();
    const response = await createApp(enabledConfig, store).request(signedRequest());

    expect(response.status).toBe(200);
    expect(store.deliveries).toHaveLength(1);
    expect(store.deliveries[0].keyId).toBe(active.keyId);
    expect(store.deliveries[0].outcome.kind).toBe('grant');
    if (store.deliveries[0].outcome.kind !== 'grant') throw new Error('Expected grant outcome');
    expect(store.deliveries[0].outcome.grant.revision).toBe(BigInt(42));
  });

  it('accepts the previous key and persists authenticated validation failures', async () => {
    const store = new StubGrantStore();
    const invalidBody = JSON.stringify({ ...JSON.parse(fixture.hmacCase.body), revision: 42 });
    const response = await createApp(enabledConfig, store).request(
      signedRequest(previous, invalidBody)
    );

    expect(response.status).toBe(400);
    expect(store.deliveries[0].keyId).toBe(previous.keyId);
    expect(store.deliveries[0].outcome).toEqual({
      kind: 'response',
      response: billingHttpResponse(400, 'billing_invalid_grant'),
    });
  });

  it('returns the structured user-not-found response supplied by the atomic store', async () => {
    const store = new StubGrantStore();
    store.nextResponse = billingHttpResponse(404, 'billing_grant_user_not_found');
    const response = await createApp(enabledConfig, store).request(signedRequest());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: 1,
      message: 'billing_grant_user_not_found',
      data: null,
    });
  });
});
