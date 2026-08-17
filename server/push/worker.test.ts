import { describe, expect, it } from 'bun:test';
import { APNS_REQUEST_TIMEOUT_MS } from './apns';
import {
  DELIVERY_BATCH_SIZE,
  DELIVERY_CLAIM_LEASE_MS,
  DELIVERY_CLAIM_SAFETY_MS,
  hasSafeDeliveryClaimLease,
  shouldDrainDeliveryQueue,
} from './deliveryPolicy';

describe('push worker delivery lease', () => {
  it('claims ten deliveries and keeps the lease beyond the worst-case send window', () => {
    expect(DELIVERY_BATCH_SIZE).toBe(10);
    expect(DELIVERY_CLAIM_LEASE_MS).toBe(5 * 60 * 1000);
    expect(DELIVERY_CLAIM_SAFETY_MS).toBe(2 * 60 * 1000);
    expect(DELIVERY_CLAIM_LEASE_MS).toBeGreaterThanOrEqual(
      DELIVERY_BATCH_SIZE * APNS_REQUEST_TIMEOUT_MS + DELIVERY_CLAIM_SAFETY_MS
    );
    expect(hasSafeDeliveryClaimLease()).toBe(true);
  });

  it('continues immediately after a full batch and sleeps after the queue tail', () => {
    expect(shouldDrainDeliveryQueue(DELIVERY_BATCH_SIZE)).toBe(true);
    expect(shouldDrainDeliveryQueue(DELIVERY_BATCH_SIZE - 1)).toBe(false);
    expect(shouldDrainDeliveryQueue(0)).toBe(false);
  });
});
