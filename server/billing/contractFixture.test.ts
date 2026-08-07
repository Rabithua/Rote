import { describe, expect, it } from 'bun:test';
import fixture from './fixtures/provisional-v1.json';
import {
  canonicalizeBillingGrantSnapshot,
  hashBillingGrantSnapshot,
  parseBillingGrantDelivery,
} from './grantSnapshot';
import { signBillingRequest, verifyBillingRequest } from './signature';

const productIds = ['ink.rote.pro.monthly', 'ink.rote.pro.yearly'] as const;

describe('provisional Paid-to-Rote contract fixture', () => {
  it('matches the exact body bytes, canonical request, and HMAC', () => {
    const signed = signBillingRequest({
      key: {
        keyId: fixture.fixtureKey.keyId,
        secret: fixture.fixtureKey.secret,
      },
      method: fixture.hmacCase.method,
      pathAndQuery: fixture.hmacCase.rawPathAndQuery,
      timestamp: fixture.hmacCase.timestamp,
      requestId: fixture.hmacCase.requestId,
      body: fixture.hmacCase.body,
    });

    expect(Buffer.from(fixture.hmacCase.body).toString('hex')).toBe(
      fixture.hmacCase.expected.bodyUtf8Hex
    );
    expect(signed.bodyHash).toBe(fixture.hmacCase.expected.bodySha256);
    expect(signed.canonicalRequest).toBe(fixture.hmacCase.expected.canonicalRequest);
    expect(Buffer.from(signed.canonicalRequest).toString('hex')).toBe(
      fixture.hmacCase.expected.canonicalRequestUtf8Hex
    );
    expect(signed.signature).toBe(fixture.hmacCase.expected.signature);

    expect(
      verifyBillingRequest({
        keys: { active: fixture.fixtureKey },
        method: fixture.hmacCase.method,
        pathAndQuery: fixture.hmacCase.rawPathAndQuery,
        body: fixture.hmacCase.body,
        headers: {
          keyId: fixture.fixtureKey.keyId,
          timestamp: fixture.hmacCase.timestamp,
          requestId: fixture.hmacCase.requestId,
          signature: fixture.hmacCase.expected.signature,
        },
        now: new Date(Number(fixture.hmacCase.timestamp) * 1000),
      }).bodyHash
    ).toBe(fixture.hmacCase.expected.bodySha256);
  });

  for (const grantCase of fixture.grantCases) {
    it(`matches the ${grantCase.name} normalized snapshot bytes`, () => {
      const value = JSON.parse(grantCase.body);
      const grant = parseBillingGrantDelivery({
        value,
        requestId: value.deliveryId,
        instanceId: 'rote-official',
        productIds,
        issuedAt: new Date(Number(fixture.hmacCase.timestamp) * 1000),
      });
      const canonicalSnapshot = canonicalizeBillingGrantSnapshot(grant);

      expect(canonicalSnapshot).toBe(grantCase.canonicalSnapshot);
      expect(Buffer.from(canonicalSnapshot).toString('hex')).toBe(
        grantCase.canonicalSnapshotUtf8Hex
      );
      expect(hashBillingGrantSnapshot(grant)).toBe(grantCase.snapshotSha256);
    });
  }
});
