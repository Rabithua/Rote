import { describe, expect, it } from 'bun:test';
import fixture from './fixtures/provisional-v1.json';
import { parseBillingGrantDelivery, parseBillingGrantSnapshot } from './grantSnapshot';

const requestId = fixture.hmacCase.requestId;
const base = JSON.parse(fixture.hmacCase.body);
const parse = (value: unknown, headerRequestId = requestId) =>
  parseBillingGrantDelivery({
    value,
    requestId: headerRequestId,
    instanceId: 'rote-official',
    productIds: ['ink.rote.pro.monthly', 'ink.rote.pro.yearly'],
    issuedAt: new Date(Number(fixture.hmacCase.timestamp) * 1000),
  });

describe('billing grant validation', () => {
  it('normalizes revision, dates, and capability ordering', () => {
    const grant = parse({
      ...base,
      capabilities: ['attachment.video.upload', 'ai.chat'],
    });
    expect(grant.revision).toBe(BigInt(42));
    expect(grant.leaseExpiresAt?.toISOString()).toBe('2026-08-08T00:00:00.000Z');
    expect(grant.capabilities).toEqual(['ai.chat', 'attachment.video.upload']);
  });

  it('rejects request ID mismatches, unknown capabilities, and invalid lease order', () => {
    expect(() => parse(base, '018f3f5a-7b2c-7d4e-8a91-2b3c4d5e6f74')).toThrow();
    expect(() => parse({ ...base, capabilities: ['unknown.capability'] })).toThrow();
    expect(() =>
      parse({
        ...base,
        leaseExpiresAt: '2026-08-09T00:00:00.000Z',
      })
    ).toThrow('leaseExpiresAt must not exceed entitlementExpiresAt');
  });

  it('rejects globally known capabilities outside the v1 billing allowlist', () => {
    expect(() => parse({ ...base, capabilities: ['attachment.upload'] })).toThrow();
  });

  it('can enforce the narrower Paid activation capability contract', () => {
    expect(() =>
      parseBillingGrantSnapshot({
        value: { ...base, capabilities: ['ai.chat'] },
        instanceId: 'rote-official',
        productIds: ['ink.rote.pro.monthly', 'ink.rote.pro.yearly'],
        issuedAt: new Date(Number(fixture.hmacCase.timestamp) * 1000),
        requireCanonicalCapabilities: true,
      })
    ).toThrow('canonical v1 capability order');
  });

  it('requires an empty, expiry-free snapshot for status none', () => {
    expect(() =>
      parse({
        ...base,
        status: 'none',
      })
    ).toThrow('status none requires');
  });

  it('requires Paid canonical positive revisions and a stable plan ID', () => {
    expect(() => parse({ ...base, revision: '0' })).toThrow();
    expect(() => parse({ ...base, planId: null })).toThrow();
  });

  it('rejects leases beyond the 24 hour signed-request horizon', () => {
    expect(() =>
      parse({
        ...base,
        entitlementExpiresAt: '2026-08-09T12:00:00.000Z',
        leaseExpiresAt: '2026-08-08T09:30:00.001Z',
      })
    ).toThrow('24 hour lease horizon');
  });
});
