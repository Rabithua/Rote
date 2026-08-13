import { z } from 'zod';
import type { CapabilityKey } from '../authz/capabilities';
import { BILLING_ALLOWED_PRODUCT_IDS, BILLING_ISSUER, type BillingProductId } from './config';
import { isBillingRequestId, sha256Hex } from './signature';

export const BILLING_GRANT_STATUSES = ['active', 'grace_period', 'none'] as const;
export const BILLING_PLAN_ID = 'rote_pro';
export const BILLING_MAX_REVISION = BigInt('9223372036854775807');
export const BILLING_MAX_LEASE_SECONDS = 24 * 60 * 60;
export const BILLING_GRANT_CAPABILITY_KEYS = [
  'ai.chat',
  'attachment.video.upload',
] as const satisfies readonly CapabilityKey[];

export type BillingGrantStatus = (typeof BILLING_GRANT_STATUSES)[number];
export type BillingGrantCapability = (typeof BILLING_GRANT_CAPABILITY_KEYS)[number];

export type BillingGrantBenefits = {
  storage: {
    baseBytes: bigint;
    bonusBytes: bigint;
    quotaBytes: bigint;
  };
  openKey: { creationPolicy: 'unlimited' };
};

export type BillingGrantSnapshot = {
  issuer: typeof BILLING_ISSUER;
  instanceId: string;
  revision: bigint;
  planId: typeof BILLING_PLAN_ID;
  status: BillingGrantStatus;
  productId: BillingProductId | null;
  entitlementExpiresAt: Date | null;
  leaseExpiresAt: Date | null;
  capabilities: BillingGrantCapability[];
  benefits: BillingGrantBenefits | null;
};

export type BillingGrantDelivery = BillingGrantSnapshot & {
  deliveryId: string;
};

const grantDeliverySchema = z
  .object({
    deliveryId: z.string().refine(isBillingRequestId, 'deliveryId must be a UUIDv7'),
    issuer: z.literal(BILLING_ISSUER),
    instanceId: z.string().min(1),
    revision: z
      .string()
      .regex(/^[1-9][0-9]*$/)
      .refine((revision) => BigInt(revision) <= BILLING_MAX_REVISION, 'revision is too large'),
    planId: z.literal(BILLING_PLAN_ID),
    status: z.enum(BILLING_GRANT_STATUSES),
    productId: z.enum(BILLING_ALLOWED_PRODUCT_IDS).nullable(),
    entitlementExpiresAt: z.iso.datetime({ offset: true }).nullable(),
    leaseExpiresAt: z.iso.datetime({ offset: true }).nullable(),
    capabilities: z
      .array(z.enum(BILLING_GRANT_CAPABILITY_KEYS))
      .max(BILLING_GRANT_CAPABILITY_KEYS.length)
      .refine(
        (capabilities) => new Set(capabilities).size === capabilities.length,
        'capabilities must be unique'
      ),
    benefits: z
      .object({
        storage: z
          .object({
            baseBytes: z.string().regex(/^(0|[1-9][0-9]*)$/),
            bonusBytes: z.string().regex(/^(0|[1-9][0-9]*)$/),
            quotaBytes: z.string().regex(/^(0|[1-9][0-9]*)$/),
          })
          .strict(),
        openKey: z.object({ creationPolicy: z.literal('unlimited') }).strict(),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.status === 'none') {
      if (
        snapshot.productId !== null ||
        snapshot.entitlementExpiresAt !== null ||
        snapshot.leaseExpiresAt !== null ||
        snapshot.capabilities.length !== 0 ||
        snapshot.benefits !== null
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'status none requires null product, expiry and benefits values and no capabilities',
        });
      }
      return;
    }

    if (
      snapshot.planId !== BILLING_PLAN_ID ||
      snapshot.productId === null ||
      snapshot.entitlementExpiresAt === null ||
      snapshot.leaseExpiresAt === null ||
      snapshot.benefits === null
    ) {
      context.addIssue({
        code: 'custom',
        message: 'active grants require plan, product, entitlement expiry, and lease expiry',
      });
      return;
    }

    const { baseBytes, bonusBytes, quotaBytes } = snapshot.benefits.storage;
    const parsedValues = [baseBytes, bonusBytes, quotaBytes].map((value) => BigInt(value));
    if (parsedValues.some((value) => value > BILLING_MAX_REVISION)) {
      context.addIssue({
        code: 'custom',
        path: ['benefits', 'storage'],
        message: 'storage bytes exceed signed 64-bit range',
      });
    } else if (parsedValues[0] + parsedValues[1] !== parsedValues[2]) {
      context.addIssue({
        code: 'custom',
        path: ['benefits', 'storage', 'quotaBytes'],
        message: 'quotaBytes must equal baseBytes + bonusBytes',
      });
    }

    if (Date.parse(snapshot.leaseExpiresAt) > Date.parse(snapshot.entitlementExpiresAt)) {
      context.addIssue({
        code: 'custom',
        message: 'leaseExpiresAt must not exceed entitlementExpiresAt',
      });
    }
  });

export function parseBillingGrantSnapshot(params: {
  value: unknown;
  instanceId: string;
  productIds: readonly BillingProductId[];
  issuedAt: Date;
  expectedDeliveryId?: string;
  requireCanonicalCapabilities?: boolean;
}): BillingGrantDelivery {
  const parsed = grantDeliverySchema.parse(params.value);
  if (params.expectedDeliveryId !== undefined && parsed.deliveryId !== params.expectedDeliveryId) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['deliveryId'],
        message: 'deliveryId must equal X-Rote-Request-Id',
      },
    ]);
  }
  if (parsed.instanceId !== params.instanceId) {
    throw new z.ZodError([
      { code: 'custom', path: ['instanceId'], message: 'instanceId does not match this Rote' },
    ]);
  }
  if (parsed.productId !== null && !params.productIds.includes(parsed.productId)) {
    throw new z.ZodError([
      { code: 'custom', path: ['productId'], message: 'productId is not enabled on this Rote' },
    ]);
  }
  if (
    params.requireCanonicalCapabilities &&
    parsed.status !== 'none' &&
    (parsed.capabilities.length !== BILLING_GRANT_CAPABILITY_KEYS.length ||
      BILLING_GRANT_CAPABILITY_KEYS.some(
        (capability, index) => parsed.capabilities[index] !== capability
      ))
  ) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['capabilities'],
        message: 'granting snapshots require the canonical v1 capability order',
      },
    ]);
  }
  if (
    parsed.leaseExpiresAt !== null &&
    Date.parse(parsed.leaseExpiresAt) > params.issuedAt.getTime() + BILLING_MAX_LEASE_SECONDS * 1000
  ) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['leaseExpiresAt'],
        message: 'leaseExpiresAt must not exceed the 24 hour lease horizon',
      },
    ]);
  }

  return {
    deliveryId: parsed.deliveryId,
    issuer: parsed.issuer,
    instanceId: parsed.instanceId,
    revision: BigInt(parsed.revision),
    planId: parsed.planId,
    status: parsed.status,
    productId: parsed.productId,
    entitlementExpiresAt: parsed.entitlementExpiresAt
      ? new Date(parsed.entitlementExpiresAt)
      : null,
    leaseExpiresAt: parsed.leaseExpiresAt ? new Date(parsed.leaseExpiresAt) : null,
    capabilities: [...parsed.capabilities].sort(),
    benefits: parsed.benefits
      ? {
          storage: {
            baseBytes: BigInt(parsed.benefits.storage.baseBytes),
            bonusBytes: BigInt(parsed.benefits.storage.bonusBytes),
            quotaBytes: BigInt(parsed.benefits.storage.quotaBytes),
          },
          openKey: parsed.benefits.openKey,
        }
      : null,
  };
}

export function parseBillingGrantDelivery(params: {
  value: unknown;
  requestId: string;
  instanceId: string;
  productIds: readonly BillingProductId[];
  issuedAt: Date;
}): BillingGrantDelivery {
  return parseBillingGrantSnapshot({
    value: params.value,
    instanceId: params.instanceId,
    productIds: params.productIds,
    issuedAt: params.issuedAt,
    expectedDeliveryId: params.requestId,
  });
}

export function canonicalizeBillingGrantSnapshot(snapshot: BillingGrantSnapshot): string {
  return JSON.stringify({
    issuer: snapshot.issuer,
    instanceId: snapshot.instanceId,
    revision: snapshot.revision.toString(),
    planId: snapshot.planId,
    status: snapshot.status,
    productId: snapshot.productId,
    entitlementExpiresAt: snapshot.entitlementExpiresAt?.toISOString() ?? null,
    leaseExpiresAt: snapshot.leaseExpiresAt?.toISOString() ?? null,
    capabilities: [...snapshot.capabilities].sort(),
    benefits: snapshot.benefits
      ? {
          storage: {
            baseBytes: snapshot.benefits.storage.baseBytes.toString(),
            bonusBytes: snapshot.benefits.storage.bonusBytes.toString(),
            quotaBytes: snapshot.benefits.storage.quotaBytes.toString(),
          },
          openKey: snapshot.benefits.openKey,
        }
      : null,
  });
}

export function hashBillingGrantSnapshot(snapshot: BillingGrantSnapshot): string {
  return sha256Hex(canonicalizeBillingGrantSnapshot(snapshot));
}
