import { z } from 'zod';
import type { BillingProductId } from './config';
import { parseBillingGrantSnapshot, type BillingGrantDelivery } from './grantSnapshot';

export const PAID_SESSION_PATH = '/v1/rote/accounts/session';
export const PAID_ACTIVATION_PATH = '/v1/rote/app-store/activate';

export const PAID_APP_ERROR_STATUSES = {
  billing_not_configured: 403,
  billing_provider_unavailable: 503,
  billing_invalid_transaction: 400,
  billing_environment_not_allowed: 403,
  billing_subscription_owned_by_another_account: 409,
} as const;

export type PaidAppErrorMessage = keyof typeof PAID_APP_ERROR_STATUSES;

const accountSessionResponseSchema = z
  .object({
    code: z.literal(0),
    message: z.literal('success'),
    data: z.object({ appAccountToken: z.uuid() }).strict(),
  })
  .strict();

const activationResponseSchema = z
  .object({
    code: z.literal(0),
    message: z.literal('success'),
    data: z.unknown(),
  })
  .strict();

const paidErrorResponseSchema = z
  .object({
    code: z.number().int(),
    message: z.enum(Object.keys(PAID_APP_ERROR_STATUSES) as [PaidAppErrorMessage]),
    data: z.record(z.string(), z.unknown()).nullable(),
  })
  .strict();

export class PaidContractError extends Error {
  constructor() {
    super('Paid billing response did not match the shared contract');
    this.name = 'PaidContractError';
  }
}

export function serializePaidSessionRequest(params: {
  requestId: string;
  instanceId: string;
  userId: string;
}): string {
  return JSON.stringify({
    requestId: params.requestId,
    instanceId: params.instanceId,
    userId: params.userId,
  });
}

export function serializePaidActivationRequest(params: {
  requestId: string;
  instanceId: string;
  userId: string;
  signedTransactionInfo: string;
}): string {
  return JSON.stringify({
    requestId: params.requestId,
    instanceId: params.instanceId,
    userId: params.userId,
    signedTransactionInfo: params.signedTransactionInfo,
  });
}

export function parsePaidSessionResponse(value: unknown): { appAccountToken: string } {
  try {
    return accountSessionResponseSchema.parse(value).data;
  } catch {
    throw new PaidContractError();
  }
}

export function parsePaidActivationResponse(params: {
  value: unknown;
  instanceId: string;
  productIds: readonly BillingProductId[];
  receivedAt: Date;
}): BillingGrantDelivery {
  try {
    const response = activationResponseSchema.parse(params.value);
    return parseBillingGrantSnapshot({
      value: response.data,
      instanceId: params.instanceId,
      productIds: params.productIds,
      issuedAt: params.receivedAt,
      requireCanonicalCapabilities: true,
    });
  } catch {
    throw new PaidContractError();
  }
}

export function parsePaidErrorResponse(params: { status: number; value: unknown }): {
  status: number;
  message: PaidAppErrorMessage;
} {
  try {
    const response = paidErrorResponseSchema.parse(params.value);
    const expectedStatus = PAID_APP_ERROR_STATUSES[response.message];
    if (params.status !== expectedStatus || response.code !== params.status) {
      throw new Error('Paid error status and envelope code do not match the stable message');
    }
    return { status: params.status, message: response.message };
  } catch {
    throw new PaidContractError();
  }
}
