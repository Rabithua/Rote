import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import type { HonoContext, HonoVariables } from '../types/hono';
import type { BillingConfig } from './config';
import {
  billingHttpResponse,
  PAID_TO_ROTE_DIRECTION,
  type BillingGrantStore,
  type BillingHttpResponse,
} from './delivery';
import { hashBillingGrantSnapshot, parseBillingGrantDelivery } from './grantSnapshot';
import {
  BILLING_SIGNATURE_HEADERS,
  BillingSignatureError,
  verifyBillingRequest,
} from './signature';

const MAX_GRANT_BODY_BYTES = 64 * 1024;

function jsonResponse(c: HonoContext, response: BillingHttpResponse) {
  return c.json(response.body, response.status as ContentfulStatusCode);
}

export function createInternalBillingRouter(params: {
  config: BillingConfig;
  grantStore: BillingGrantStore;
  now?: () => Date;
}) {
  const router = new Hono<{ Variables: HonoVariables }>();

  router.put('/grants/:userId', async (c: HonoContext) => {
    if (!params.config.enabled) {
      return jsonResponse(c, billingHttpResponse(403, 'billing_not_configured'));
    }

    const rawBody = new Uint8Array(await c.req.arrayBuffer());
    if (rawBody.byteLength > MAX_GRANT_BODY_BYTES) {
      return jsonResponse(c, billingHttpResponse(413, 'billing_invalid_grant'));
    }

    let verified;
    try {
      verified = verifyBillingRequest({
        keys: params.config.paidToRote,
        method: c.req.method,
        pathAndQuery: c.req.url,
        body: rawBody,
        headers: {
          keyId: c.req.header(BILLING_SIGNATURE_HEADERS.keyId),
          timestamp: c.req.header(BILLING_SIGNATURE_HEADERS.timestamp),
          requestId: c.req.header(BILLING_SIGNATURE_HEADERS.requestId),
          signature: c.req.header(BILLING_SIGNATURE_HEADERS.signature),
        },
        now: params.now?.(),
      });
    } catch (error) {
      if (error instanceof BillingSignatureError) {
        return jsonResponse(c, billingHttpResponse(401, error.code));
      }
      throw error;
    }

    let outcome: Parameters<BillingGrantStore['processInboundDelivery']>[0]['outcome'];
    try {
      const userId = z.uuid().parse(c.req.param('userId'));
      const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody));
      const grant = parseBillingGrantDelivery({
        value,
        requestId: verified.requestId,
        instanceId: params.config.instanceId,
        productIds: params.config.productIds,
        issuedAt: new Date(Number(verified.timestamp) * 1000),
      });
      outcome = {
        kind: 'grant',
        userId,
        grant,
        snapshotHash: hashBillingGrantSnapshot(grant),
      };
    } catch {
      outcome = {
        kind: 'response',
        response: billingHttpResponse(400, 'billing_invalid_grant'),
      };
    }

    const response = await params.grantStore.processInboundDelivery({
      direction: PAID_TO_ROTE_DIRECTION,
      deliveryId: verified.requestId,
      keyId: verified.keyId,
      bodyHash: verified.bodyHash,
      outcome,
    });
    return jsonResponse(c, response);
  });

  return router;
}
