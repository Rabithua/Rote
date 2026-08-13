import { Hono, type MiddlewareHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import type { BillingGrant } from '../drizzle/schema';
import type { HonoContext, HonoVariables } from '../types/hono';
import { BILLING_GRANT_CAPABILITY_KEYS, type BillingGrantCapability } from './grantSnapshot';
import {
  BILLING_ALLOWED_PRODUCT_IDS,
  BILLING_OFFICIAL_INSTANCE_ID,
  BILLING_OFFICIAL_ORIGIN,
  type BillingConfig,
} from './config';
import {
  billingHttpResponse,
  type BillingGrantProjectionStore,
  type BillingHttpResponse,
} from './delivery';
import { PaidBillingApiError, type PaidBillingProvider } from './paidClient';
import { BillingBodyTooLargeError, readBillingRequestBody } from './requestBody';

export const BILLING_SESSION_BODY_LIMIT_BYTES = 1024;
export const BILLING_ACTIVATION_BODY_LIMIT_BYTES = 32 * 1024;

const emptyObjectSchema = z.object({}).strict();
const activationBodySchema = z.object({ signedTransactionInfo: z.string().min(1) }).strict();

function jsonResponse(c: HonoContext, response: BillingHttpResponse) {
  return c.json(response.body, response.status as ContentfulStatusCode);
}

function invalidRequest(c: HonoContext, status: 400 | 413 = 400) {
  return jsonResponse(c, billingHttpResponse(status, 'billing_invalid_request'));
}

function isOfficialBillingRequest(c: HonoContext, config: BillingConfig): boolean {
  if (!config.enabled) return false;
  if (
    config.instanceId !== BILLING_OFFICIAL_INSTANCE_ID ||
    config.officialOrigin !== BILLING_OFFICIAL_ORIGIN
  ) {
    return false;
  }
  try {
    const externallyResolvedUrl = c.get('dynamicApiUrl');
    return new URL(externallyResolvedUrl ?? c.req.url).origin === config.officialOrigin;
  } catch {
    return false;
  }
}

function billingUnavailable(c: HonoContext) {
  return jsonResponse(c, billingHttpResponse(503, 'billing_provider_unavailable'));
}

function publicBillingConfig(enabled: boolean, purchaseAvailable = false) {
  return {
    enabled,
    purchaseAvailable: enabled && purchaseAvailable,
    officialOrigin: BILLING_OFFICIAL_ORIGIN,
    products: [...BILLING_ALLOWED_PRODUCT_IDS],
    features: { offerCode: true, promotedPurchases: false },
  };
}

function normalizeCapabilities(capabilities: string[]): BillingGrantCapability[] {
  return BILLING_GRANT_CAPABILITY_KEYS.filter((capability) => capabilities.includes(capability));
}

function localBillingState(grant: BillingGrant | null, now: Date) {
  if (!grant) {
    return {
      planId: null,
      status: 'none' as const,
      productId: null,
      entitlementExpiresAt: null,
      leaseExpiresAt: null,
      capabilities: [] as BillingGrantCapability[],
      benefits: null,
    };
  }

  const common = {
    planId: grant.planId,
    productId: grant.productId,
    entitlementExpiresAt: grant.entitlementExpiresAt?.toISOString() ?? null,
    leaseExpiresAt: grant.leaseExpiresAt?.toISOString() ?? null,
  };
  if (grant.status === 'none') {
    return {
      ...common,
      status: 'none' as const,
      capabilities: [] as BillingGrantCapability[],
      benefits: null,
    };
  }
  if (!grant.leaseExpiresAt || now.getTime() >= grant.leaseExpiresAt.getTime()) {
    return {
      ...common,
      status: 'unavailable' as const,
      capabilities: [] as BillingGrantCapability[],
      benefits: null,
    };
  }
  return {
    ...common,
    status: grant.status,
    capabilities: normalizeCapabilities(grant.capabilities),
    benefits: grant.benefits,
  };
}

async function parseLimitedJsonBody(
  request: Request,
  maxBytes: number
): Promise<{ ok: true; value: unknown } | { ok: false; tooLarge: boolean }> {
  try {
    const body = await readBillingRequestBody(request, maxBytes);
    if (body.byteLength === 0) return { ok: true, value: {} };
    return {
      ok: true,
      value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)),
    };
  } catch (error) {
    return { ok: false, tooLarge: error instanceof BillingBodyTooLargeError };
  }
}

export function createPublicBillingRouter(params: {
  config: BillingConfig;
  grantStore: BillingGrantProjectionStore;
  provider: PaidBillingProvider | null;
  authenticate: MiddlewareHandler<{ Variables: HonoVariables }>;
  now?: () => Date;
}) {
  const router = new Hono<{ Variables: HonoVariables }>();
  const now = params.now ?? (() => new Date());

  router.get('/config', (c: HonoContext) => {
    if (!isOfficialBillingRequest(c, params.config)) {
      return jsonResponse(c, billingHttpResponse(200, 'success', publicBillingConfig(false)));
    }
    if (!params.config.enabled) {
      return jsonResponse(c, billingHttpResponse(200, 'success', publicBillingConfig(false)));
    }
    return jsonResponse(
      c,
      billingHttpResponse(200, 'success', {
        ...publicBillingConfig(true, params.config.purchaseAvailable),
        products: params.config.productIds,
      })
    );
  });

  router.get('/me', params.authenticate, async (c: HonoContext) => {
    if (!isOfficialBillingRequest(c, params.config)) {
      return jsonResponse(c, billingHttpResponse(403, 'billing_not_configured'));
    }
    const user = c.get('user');
    if (!user) return jsonResponse(c, billingHttpResponse(401, 'Authentication required'));
    const grant = await params.grantStore.findGrantForUser(user.id);
    return jsonResponse(c, billingHttpResponse(200, 'success', localBillingState(grant, now())));
  });

  router.post('/app-store/session', params.authenticate, async (c: HonoContext) => {
    if (!isOfficialBillingRequest(c, params.config)) {
      return jsonResponse(c, billingHttpResponse(403, 'billing_not_configured'));
    }
    const user = c.get('user');
    if (!user) return jsonResponse(c, billingHttpResponse(401, 'Authentication required'));
    const parsedBody = await parseLimitedJsonBody(c.req.raw, BILLING_SESSION_BODY_LIMIT_BYTES);
    if (!parsedBody.ok) return invalidRequest(c, parsedBody.tooLarge ? 413 : 400);
    if (!emptyObjectSchema.safeParse(parsedBody.value).success) return invalidRequest(c);
    if (!params.provider || !params.config.enabled || !params.config.purchaseAvailable)
      return billingUnavailable(c);

    try {
      const session = await params.provider.createSession(user.id);
      return jsonResponse(
        c,
        billingHttpResponse(200, 'success', {
          appAccountToken: session.appAccountToken,
          products: params.config.productIds,
        })
      );
    } catch (error) {
      if (error instanceof PaidBillingApiError) {
        return jsonResponse(c, billingHttpResponse(error.status, error.billingMessage));
      }
      return billingUnavailable(c);
    }
  });

  router.post('/app-store/activate', params.authenticate, async (c: HonoContext) => {
    if (!isOfficialBillingRequest(c, params.config)) {
      return jsonResponse(c, billingHttpResponse(403, 'billing_not_configured'));
    }
    const user = c.get('user');
    if (!user) return jsonResponse(c, billingHttpResponse(401, 'Authentication required'));
    const parsedBody = await parseLimitedJsonBody(c.req.raw, BILLING_ACTIVATION_BODY_LIMIT_BYTES);
    if (!parsedBody.ok) return invalidRequest(c, parsedBody.tooLarge ? 413 : 400);
    const activation = activationBodySchema.safeParse(parsedBody.value);
    if (!activation.success) return invalidRequest(c);
    if (!params.provider || !params.config.enabled) return billingUnavailable(c);

    try {
      const snapshot = await params.provider.activate(
        user.id,
        activation.data.signedTransactionInfo
      );
      const localResponse = await params.grantStore.applyGrantSnapshot(user.id, snapshot);
      if (localResponse.status !== 200) return billingUnavailable(c);
      const currentGrant = await params.grantStore.findGrantForUser(user.id);
      if (!currentGrant) return billingUnavailable(c);
      return jsonResponse(
        c,
        billingHttpResponse(200, 'success', localBillingState(currentGrant, now()))
      );
    } catch (error) {
      if (error instanceof PaidBillingApiError) {
        return jsonResponse(c, billingHttpResponse(error.status, error.billingMessage));
      }
      return billingUnavailable(c);
    }
  });

  return router;
}
