import { and, eq } from 'drizzle-orm';
import {
  billingGrants,
  billingInboundDeliveries,
  users,
  type BillingGrant,
  type NewBillingGrant,
} from '../drizzle/schema';
import db from '../utils/drizzle';
import {
  billingHttpResponse,
  classifyGrantRevision,
  type AuthenticatedInboundDelivery,
  type BillingGrantStore,
  type BillingHttpResponse,
} from './delivery';

export class BillingGrantRepository implements BillingGrantStore {
  async findGrantForUser(userId: string): Promise<BillingGrant | null> {
    const [grant] = await db
      .select()
      .from(billingGrants)
      .where(eq(billingGrants.userId, userId))
      .limit(1);
    return grant ?? null;
  }

  async processInboundDelivery(
    delivery: AuthenticatedInboundDelivery
  ): Promise<BillingHttpResponse> {
    return db.transaction(async (transaction) => {
      const [inserted] = await transaction
        .insert(billingInboundDeliveries)
        .values({
          direction: delivery.direction,
          deliveryId: delivery.deliveryId,
          keyId: delivery.keyId,
          bodyHash: delivery.bodyHash,
        })
        .onConflictDoNothing({
          target: [billingInboundDeliveries.direction, billingInboundDeliveries.deliveryId],
        })
        .returning({ deliveryId: billingInboundDeliveries.deliveryId });

      if (!inserted) {
        const [existingDelivery] = await transaction
          .select({
            bodyHash: billingInboundDeliveries.bodyHash,
            responseStatus: billingInboundDeliveries.responseStatus,
            responseBody: billingInboundDeliveries.responseBody,
          })
          .from(billingInboundDeliveries)
          .where(
            and(
              eq(billingInboundDeliveries.direction, delivery.direction),
              eq(billingInboundDeliveries.deliveryId, delivery.deliveryId)
            )
          )
          .limit(1);

        if (!existingDelivery) {
          throw new Error('Billing delivery disappeared during replay lookup');
        }
        if (existingDelivery.bodyHash !== delivery.bodyHash) {
          return billingHttpResponse(409, 'billing_delivery_conflict');
        }
        if (existingDelivery.responseStatus === null || existingDelivery.responseBody === null) {
          throw new Error('Billing delivery has no completed response');
        }
        return {
          status: existingDelivery.responseStatus,
          body: existingDelivery.responseBody,
        };
      }

      const response =
        delivery.outcome.kind === 'response'
          ? delivery.outcome.response
          : await this.applyGrant(transaction, delivery.outcome);

      await transaction
        .update(billingInboundDeliveries)
        .set({
          responseStatus: response.status,
          responseBody: response.body,
          completedAt: new Date(),
        })
        .where(
          and(
            eq(billingInboundDeliveries.direction, delivery.direction),
            eq(billingInboundDeliveries.deliveryId, delivery.deliveryId)
          )
        );

      return response;
    });
  }

  private async applyGrant(
    transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
    input: Extract<AuthenticatedInboundDelivery['outcome'], { kind: 'grant' }>
  ): Promise<BillingHttpResponse> {
    const [user] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)
      .for('update');
    if (!user) return billingHttpResponse(404, 'billing_grant_user_not_found');

    const [existingGrant] = await transaction
      .select({
        revision: billingGrants.revision,
        snapshotHash: billingGrants.snapshotHash,
      })
      .from(billingGrants)
      .where(eq(billingGrants.userId, input.userId))
      .limit(1)
      .for('update');

    const grantValues: NewBillingGrant = {
      userId: input.userId,
      issuer: input.grant.issuer,
      instanceId: input.grant.instanceId,
      revision: input.grant.revision,
      planId: input.grant.planId,
      status: input.grant.status,
      productId: input.grant.productId,
      entitlementExpiresAt: input.grant.entitlementExpiresAt,
      leaseExpiresAt: input.grant.leaseExpiresAt,
      capabilities: input.grant.capabilities,
      snapshotHash: input.snapshotHash,
      updatedAt: new Date(),
    };
    const decision = classifyGrantRevision(existingGrant ?? null, grantValues);

    if (decision === 'conflict') {
      // This is a protocol-integrity alert and intentionally excludes delivery or user identifiers.
      // eslint-disable-next-line no-console
      console.warn('[billing] grant revision reused with a different snapshot hash');
      return billingHttpResponse(409, 'billing_grant_revision_conflict');
    }
    if (decision === 'applied') {
      await transaction
        .insert(billingGrants)
        .values(grantValues)
        .onConflictDoUpdate({
          target: billingGrants.userId,
          set: {
            issuer: grantValues.issuer,
            instanceId: grantValues.instanceId,
            revision: grantValues.revision,
            planId: grantValues.planId,
            status: grantValues.status,
            productId: grantValues.productId,
            entitlementExpiresAt: grantValues.entitlementExpiresAt,
            leaseExpiresAt: grantValues.leaseExpiresAt,
            capabilities: grantValues.capabilities,
            snapshotHash: grantValues.snapshotHash,
            updatedAt: grantValues.updatedAt,
          },
        });
    }

    const responseRevision =
      decision === 'ignored' && existingGrant
        ? existingGrant.revision.toString()
        : input.grant.revision.toString();
    return billingHttpResponse(200, 'success', {
      result: decision,
      revision: responseRevision,
    });
  }
}

export const billingGrantRepository = new BillingGrantRepository();
