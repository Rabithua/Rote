import { describe, expect, it } from 'bun:test';
import type { BillingConfig } from './config';
import outboundFixture from './fixtures/rote-to-paid-v1.json';
import {
  PaidBillingApiError,
  PaidBillingClient,
  PaidBillingInternalContractError,
} from './paidClient';
import type { BillingFetch } from './paidTransport';

const config = {
  enabled: true,
  instanceId: 'rote-official',
  officialOrigin: 'https://api.rote.ink',
  paidServerUrl: 'https://billing.rote.ink',
  productIds: ['ink.rote.pro.monthly', 'ink.rote.pro.yearly'],
  connectTimeoutMs: 50,
  totalTimeoutMs: 100,
  purchaseAvailable: true,
  roteToPaid: {
    active: { keyId: 'rote-active', secret: 'rote-to-paid-active-secret-00000001' },
  },
  paidToRote: {
    active: { keyId: 'paid-active', secret: 'paid-to-rote-active-secret-00000001' },
  },
} satisfies Extract<BillingConfig, { enabled: true }>;

async function expectApiError(operation: Promise<unknown>, status: number, message: string) {
  try {
    await operation;
    throw new Error('Expected Paid API error');
  } catch (error) {
    expect(error).toBeInstanceOf(PaidBillingApiError);
    const apiError = error as PaidBillingApiError;
    expect(apiError.status).toBe(status);
    expect(apiError.billingMessage).toBe(message);
    return apiError;
  }
}

describe('Paid billing client error mapping', () => {
  it('parses stable session and activation success envelopes', async () => {
    const fetch: BillingFetch = async (input) => {
      const path = new URL(input.toString()).pathname;
      if (path.endsWith('/session')) {
        return Response.json(outboundFixture.sessionSuccessResponse);
      }
      return Response.json(outboundFixture.activationSuccessResponse);
    };
    const client = new PaidBillingClient(config, {
      fetch,
      now: () => new Date('2026-08-07T00:00:00.000Z'),
      requestId: () => outboundFixture.hmacCase.requestId,
    });

    expect(await client.createSession('11111111-2222-4333-8444-555555555555')).toEqual(
      outboundFixture.sessionSuccessResponse.data
    );
    expect(
      (await client.activate('11111111-2222-4333-8444-555555555555', 'private-jws')).revision
    ).toBe(BigInt(42));
  });

  it('forwards only exact stable Paid errors and fails closed on malformed envelopes', async () => {
    for (const [name, errorCase] of Object.entries(outboundFixture.standardErrorResponses)) {
      if (name === 'idempotencyConflict') continue;
      await expectApiError(
        new PaidBillingClient(config, {
          fetch: async () => Response.json(errorCase.body, { status: errorCase.httpStatus }),
        }).createSession('11111111-2222-4333-8444-555555555555'),
        errorCase.httpStatus,
        errorCase.body.message
      );
    }

    const idempotencyConflict = outboundFixture.standardErrorResponses.idempotencyConflict;
    const translated = await expectApiError(
      new PaidBillingClient(config, {
        fetch: async () =>
          Response.json(idempotencyConflict.body, {
            status: idempotencyConflict.httpStatus,
          }),
      }).createSession('11111111-2222-4333-8444-555555555555'),
      503,
      'billing_provider_unavailable'
    );
    expect(translated.internalCause).toBeInstanceOf(PaidBillingInternalContractError);
    expect(translated.internalCause?.status).toBe(409);
    expect(translated.internalCause?.billingMessage).toBe('billing_idempotency_conflict');

    await expectApiError(
      new PaidBillingClient(config, {
        fetch: async () =>
          Response.json(
            { ...outboundFixture.errorResponse, code: 1 },
            {
              status: 409,
            }
          ),
      }).createSession('11111111-2222-4333-8444-555555555555'),
      503,
      'billing_provider_unavailable'
    );
  });

  it('maps Paid connection timeouts to the stable provider-unavailable contract', async () => {
    await expectApiError(
      new PaidBillingClient(
        { ...config, connectTimeoutMs: 5, totalTimeoutMs: 50 },
        { fetch: () => new Promise(() => {}) }
      ).createSession('11111111-2222-4333-8444-555555555555'),
      503,
      'billing_provider_unavailable'
    );
  });
});
