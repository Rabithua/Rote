import { describe, expect, it } from 'bun:test';
import type { BillingConfig } from './config';
import fixture from './fixtures/rote-to-paid-v1.json';
import { PaidBillingTransport, PaidTransportError, type BillingFetch } from './paidTransport';
import { BILLING_SIGNATURE_HEADERS } from './signature';

function enabledConfig(overrides: Partial<Extract<BillingConfig, { enabled: true }>> = {}) {
  return {
    enabled: true,
    instanceId: 'rote-official',
    officialOrigin: 'https://api.rote.ink',
    paidServerUrl: 'https://billing.rote.ink',
    productIds: ['ink.rote.pro.monthly', 'ink.rote.pro.yearly'],
    connectTimeoutMs: 50,
    totalTimeoutMs: 100,
    roteToPaid: {
      active: {
        keyId: fixture.fixtureKey.keyId,
        secret: Buffer.from(fixture.fixtureKey.secretHex, 'hex'),
      },
      previous: { keyId: 'previous-must-not-send', secret: 'x'.repeat(32) },
    },
    paidToRote: {
      active: { keyId: 'paid-active', secret: 'paid-to-rote-active-secret-00000001' },
    },
    ...overrides,
  } satisfies Extract<BillingConfig, { enabled: true }>;
}

async function expectTransportError(operation: Promise<unknown>, kind: string) {
  try {
    await operation;
    throw new Error('Expected Paid transport to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(PaidTransportError);
    expect((error as PaidTransportError).kind).toBe(kind);
  }
}

describe('Rote-to-Paid billing transport', () => {
  it('matches the exact Paid-owned canonical session fixture and sends only the active key', async () => {
    let capturedUrl: URL | null = null;
    let capturedInit: RequestInit | undefined;
    const fetch: BillingFetch = async (input, init) => {
      capturedUrl = input as URL;
      capturedInit = init;
      return Response.json({ code: 0, message: 'success', data: {} });
    };
    const transport = new PaidBillingTransport(enabledConfig(), {
      fetch,
      now: () => new Date(Number(fixture.hmacCase.timestamp) * 1000),
      requestId: () => fixture.hmacCase.requestId,
    });

    const response = await transport.postJson(
      fixture.hmacCase.pathAndQuery,
      () => fixture.hmacCase.body
    );
    const headers = new Headers(capturedInit?.headers);

    expect(capturedUrl?.toString()).toBe('https://billing.rote.ink/v1/rote/accounts/session');
    expect(capturedInit?.body).toBe(fixture.hmacCase.body);
    expect(Buffer.byteLength(capturedInit?.body as string)).toBe(
      fixture.hmacCase.expected.bodyByteLength
    );
    expect(headers.get(BILLING_SIGNATURE_HEADERS.keyId)).toBe(fixture.fixtureKey.keyId);
    expect(headers.get(BILLING_SIGNATURE_HEADERS.keyId)).not.toBe('previous-must-not-send');
    expect(headers.get(BILLING_SIGNATURE_HEADERS.signature)).toBe(
      fixture.hmacCase.expected.signature
    );
    expect(response.requestId).toBe(fixture.hmacCase.requestId);
  });

  it('distinguishes connection and total timeouts without exposing request bodies', async () => {
    const neverConnects: BillingFetch = () => new Promise(() => {});
    await expectTransportError(
      new PaidBillingTransport(enabledConfig({ connectTimeoutMs: 5, totalTimeoutMs: 50 }), {
        fetch: neverConnects,
      }).postJson('/v1/rote/app-store/activate', (requestId) =>
        JSON.stringify({ requestId, signedTransactionInfo: 'private-jws' })
      ),
      'connection_timeout'
    );

    const neverFinishesBody: BillingFetch = async () =>
      new Response(new ReadableStream<Uint8Array>({ start() {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    await expectTransportError(
      new PaidBillingTransport(enabledConfig({ connectTimeoutMs: 5, totalTimeoutMs: 15 }), {
        fetch: neverFinishesBody,
      }).postJson('/v1/rote/app-store/activate', (requestId) =>
        JSON.stringify({ requestId, signedTransactionInfo: 'private-jws' })
      ),
      'total_timeout'
    );
  });

  it('classifies non-JSON, invalid UTF-8, and oversized Paid responses as invalid', async () => {
    await expectTransportError(
      new PaidBillingTransport(enabledConfig(), {
        fetch: async () => new Response('not-json'),
      }).postJson('/v1/rote/accounts/session', () => '{}'),
      'invalid_response'
    );

    await expectTransportError(
      new PaidBillingTransport(enabledConfig(), {
        fetch: async () => new Response(Uint8Array.from([0xc3, 0x28])),
      }).postJson('/v1/rote/accounts/session', () => '{}'),
      'invalid_response'
    );

    await expectTransportError(
      new PaidBillingTransport(enabledConfig(), {
        fetch: async () =>
          new Response('{}', { headers: { 'content-length': String(256 * 1024 + 1) } }),
      }).postJson('/v1/rote/accounts/session', () => '{}'),
      'invalid_response'
    );
  });

  it('classifies a response stream read failure as a network error', async () => {
    const failedBody = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('connection reset while reading'));
      },
    });
    await expectTransportError(
      new PaidBillingTransport(enabledConfig(), {
        fetch: async () => new Response(failedBody),
      }).postJson('/v1/rote/accounts/session', () => '{}'),
      'network_error'
    );
  });
});
