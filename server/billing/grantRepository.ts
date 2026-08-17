import { and, eq } from 'drizzle-orm';
import {
  billingGrants,
  billingInboundDeliveries,
  pushEvents,
  users,
  type BillingGrant,
  type NewBillingGrant,
} from '../drizzle/schema';
import { isPushNotificationsEnabled } from '../push/config';
import db from '../utils/drizzle';
import {
  billingHttpResponse,
  classifyGrantRevision,
  type AuthenticatedInboundDelivery,
  type BillingGrantProjectionStore,
  type BillingGrantStore,
  type BillingHttpResponse,
} from './delivery';
import { hashBillingGrantSnapshot, type BillingGrantDelivery } from './grantSnapshot';

export class BillingGrantRepository implements BillingGrantStore, BillingGrantProjectionStore {
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
          requestTarget: delivery.requestTarget,
          bodyHash: delivery.bodyHash,
        })
        .onConflictDoNothing({
          target: [billingInboundDeliveries.direction, billingInboundDeliveries.deliveryId],
        })
        .returning({ deliveryId: billingInboundDeliveries.deliveryId });

      if (!inserted) {
        const [existingDelivery] = await transaction
          .select({
            requestTarget: billingInboundDeliveries.requestTarget,
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
        if (
          existingDelivery.requestTarget !== delivery.requestTarget ||
          existingDelivery.bodyHash !== delivery.bodyHash
        ) {
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

  async applyGrantSnapshot(
    userId: string,
    grant: BillingGrantDelivery
  ): Promise<BillingHttpResponse> {
    return db.transaction((transaction) =>
      this.applyGrant(transaction, {
        kind: 'grant',
        userId,
        grant,
        snapshotHash: hashBillingGrantSnapshot(grant),
      })
    );
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
        planId: billingGrants.planId,
        status: billingGrants.status,
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
      benefits: input.grant.benefits
        ? {
            storage: {
              baseBytes: input.grant.benefits.storage.baseBytes.toString(),
              bonusBytes: input.grant.benefits.storage.bonusBytes.toString(),
              quotaBytes: input.grant.benefits.storage.quotaBytes.toString(),
            },
            openKey: input.grant.benefits.openKey,
          }
        : null,
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
            benefits: grantValues.benefits,
            snapshotHash: grantValues.snapshotHash,
            updatedAt: grantValues.updatedAt,
          },
        });

      const wasEntitled =
        existingGrant?.status === 'active' || existingGrant?.status === 'grace_period';
      const isEntitled = grantValues.status === 'active' || grantValues.status === 'grace_period';
      const entitlementChanged = existingGrant ? wasEntitled !== isEntitled : isEntitled;
      if (isPushNotificationsEnabled() && entitlementChanged) {
        await transaction
          .insert(pushEvents)
          .values({
            userid: input.userId,
            type: isEntitled ? 'account.pro.active' : 'account.pro.inactive',
            category: 'account',
            titleLocKey: isEntitled ? 'push.pro.active.title' : 'push.pro.inactive.title',
            bodyLocKey: isEntitled ? 'push.pro.active.body' : 'push.pro.inactive.body',
            route: 'rote://profile',
            payload: { status: grantValues.status, planId: grantValues.planId },
            dedupeKey: `pro:${input.userId}:${grantValues.revision.toString()}`,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          })
          .onConflictDoNothing({ target: pushEvents.dedupeKey });
      }
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
