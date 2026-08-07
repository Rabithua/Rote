import type { BillingGrant, NewBillingGrant } from '../drizzle/schema';
import type { BillingGrantDelivery } from './grantSnapshot';

export const PAID_TO_ROTE_DIRECTION = 'paid_to_rote';

export type BillingApiResponse<T = unknown> = {
  code: number;
  message: string;
  data: T;
};

export type BillingCallbackResult = 'applied' | 'ignored' | 'duplicate';

export type BillingCallbackData = {
  result: BillingCallbackResult;
  revision: string;
};

export type BillingHttpResponse = {
  status: number;
  body: BillingApiResponse;
};

export type AuthenticatedInboundDelivery = {
  direction: typeof PAID_TO_ROTE_DIRECTION;
  deliveryId: string;
  keyId: string;
  bodyHash: string;
  outcome:
    | {
        kind: 'grant';
        userId: string;
        grant: BillingGrantDelivery;
        snapshotHash: string;
      }
    | {
        kind: 'response';
        response: BillingHttpResponse;
      };
};

export interface BillingGrantStore {
  processInboundDelivery(delivery: AuthenticatedInboundDelivery): Promise<BillingHttpResponse>;
  findGrantForUser(userId: string): Promise<BillingGrant | null>;
}

export type GrantRevisionDecision = BillingCallbackResult | 'conflict';

export function classifyGrantRevision(
  existing: Pick<BillingGrant, 'revision' | 'snapshotHash'> | null,
  incoming: Pick<NewBillingGrant, 'revision' | 'snapshotHash'>
): GrantRevisionDecision {
  if (!existing || incoming.revision > existing.revision) return 'applied';
  if (incoming.revision < existing.revision) return 'ignored';
  return incoming.snapshotHash === existing.snapshotHash ? 'duplicate' : 'conflict';
}

export function billingHttpResponse(
  status: number,
  message: string,
  data: unknown = null
): BillingHttpResponse {
  return { status, body: { code: status >= 400 ? 1 : 0, message, data } };
}
