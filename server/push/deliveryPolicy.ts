import { APNS_REQUEST_TIMEOUT_MS } from './apns';

export const DELIVERY_BATCH_SIZE = 10;
export const DELIVERY_CLAIM_LEASE_MS = 5 * 60 * 1000;
export const DELIVERY_CLAIM_SAFETY_MS = 2 * 60 * 1000;

export function hasSafeDeliveryClaimLease(): boolean {
  return (
    DELIVERY_CLAIM_LEASE_MS >=
    DELIVERY_BATCH_SIZE * APNS_REQUEST_TIMEOUT_MS + DELIVERY_CLAIM_SAFETY_MS
  );
}
