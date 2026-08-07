import { describe, expect, it } from 'bun:test';
import { isBillingRequestId } from './signature';
import { createBillingRequestId } from './requestId';

describe('billing UUIDv7 request IDs', () => {
  it('encodes the timestamp, UUID version, and RFC variant', () => {
    const now = new Date('2026-08-07T00:00:00.123Z');
    const requestId = createBillingRequestId({
      now,
      random: Uint8Array.from([0xab, 0xcd, 0xef, 1, 2, 3, 4, 5, 6, 7]),
    });

    expect(requestId).toBe('019fd985-007b-7bcd-af01-020304050607');
    expect(isBillingRequestId(requestId)).toBe(true);
    expect(Number.parseInt(requestId.replaceAll('-', '').slice(0, 12), 16)).toBe(now.getTime());
  });

  it('rejects invalid random input lengths', () => {
    expect(() => createBillingRequestId({ random: new Uint8Array(9) })).toThrow('exactly 10');
  });
});
