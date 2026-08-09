import { describe, expect, it } from 'bun:test';
import { BillingSignatureError, signBillingRequest, verifyBillingRequest } from './signature';

const requestId = '018f3f5a-7b2c-7d4e-8a91-2b3c4d5e6f73';
const timestamp = '1786095000';
const request = {
  method: 'PUT',
  pathAndQuery: '/internal/billing/grants/3d594650-3436-4a2e-905c-438b5a93992a',
  timestamp,
  requestId,
  body: '{}',
};
const active = { keyId: 'active', secret: 'paid-to-rote-active-signing-secret-01' };
const previous = { keyId: 'previous', secret: 'paid-to-rote-previous-secret-0001' };

function expectSignatureError(operation: () => unknown, code: string) {
  try {
    operation();
    throw new Error('Expected signature verification to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(BillingSignatureError);
    expect((error as BillingSignatureError).code).toBe(code);
  }
}

describe('billing HMAC verification', () => {
  it('accepts active and previous keys during rotation', () => {
    for (const key of [active, previous]) {
      const signed = signBillingRequest({ ...request, key });
      expect(
        verifyBillingRequest({
          ...request,
          keys: { active, previous },
          headers: {
            keyId: key.keyId,
            timestamp,
            requestId,
            signature: signed.signature,
          },
          now: new Date(Number(timestamp) * 1000),
        }).keyId
      ).toBe(key.keyId);
    }
  });

  it('accepts exactly 300 seconds of skew and rejects 301 seconds', () => {
    const signed = signBillingRequest({ ...request, key: active });
    const verifyAt = (offsetSeconds: number) =>
      verifyBillingRequest({
        ...request,
        keys: { active },
        headers: {
          keyId: active.keyId,
          timestamp,
          requestId,
          signature: signed.signature,
        },
        now: new Date((Number(timestamp) + offsetSeconds) * 1000),
      });

    expect(verifyAt(300).requestId).toBe(requestId);
    expectSignatureError(() => verifyAt(301), 'billing_signature_expired');
  });

  it('rejects body changes and unknown keys', () => {
    const signed = signBillingRequest({ ...request, key: active });
    const base = {
      ...request,
      keys: { active },
      headers: {
        keyId: active.keyId,
        timestamp,
        requestId,
        signature: signed.signature,
      },
      now: new Date(Number(timestamp) * 1000),
    };
    expectSignatureError(
      () => verifyBillingRequest({ ...base, body: '{"changed":true}' }),
      'billing_signature_invalid'
    );
    expectSignatureError(
      () =>
        verifyBillingRequest({
          ...base,
          headers: { ...base.headers, keyId: 'missing' },
        }),
      'billing_signature_key_unknown'
    );
  });
});
