import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { BillingGrantProjectionStore, BillingGrantStore } from './delivery';
import { PAID_TO_ROTE_DIRECTION } from './delivery';
import fixture from './fixtures/provisional-v1.json';
import {
  hashBillingGrantSnapshot,
  parseBillingGrantDelivery,
  type BillingGrantDelivery,
} from './grantSnapshot';

const databaseUrl = process.env.BILLING_TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;

databaseDescribe('billing grant repository integration', () => {
  let store: BillingGrantStore & BillingGrantProjectionStore;
  let database: typeof import('../utils/drizzle').default;
  let schema: typeof import('../drizzle/schema');
  const userId = randomUUID();
  const activationUserId = randomUUID();
  const entitlementUserId = randomUUID();
  const initialNoneUserId = randomUUID();
  const originalPushEnabled = process.env.PUSH_NOTIFICATIONS_ENABLED;
  const deliveryIds = [
    '018f3f5a-7b2c-7d4e-8a91-2b3c4d5e6f80',
    '018f3f5a-7b2c-7d4e-8a91-2b3c4d5e6f81',
    '018f3f5a-7b2c-7d4e-8a91-2b3c4d5e6f82',
    '018f3f5a-7b2c-7d4e-8a91-2b3c4d5e6f83',
    '018f3f5a-7b2c-7d4e-8a91-2b3c4d5e6f84',
    '018f3f5a-7b2c-7d4e-8a91-2b3c4d5e6f85',
  ];

  beforeAll(async () => {
    process.env.POSTGRESQL_URL = databaseUrl;
    process.env.PUSH_NOTIFICATIONS_ENABLED = 'true';
    ({ default: database } = await import('../utils/drizzle'));
    schema = await import('../drizzle/schema');
    const { BillingGrantRepository } = await import('./grantRepository');
    store = new BillingGrantRepository();
    await database.insert(schema.users).values({
      id: userId,
      email: `billing-${userId}@example.test`,
      username: `billing-${userId}`,
    });
    await database.insert(schema.users).values({
      id: activationUserId,
      email: `billing-${activationUserId}@example.test`,
      username: `billing-${activationUserId}`,
    });
    await database.insert(schema.users).values([
      {
        id: entitlementUserId,
        email: `billing-${entitlementUserId}@example.test`,
        username: `billing-${entitlementUserId}`,
      },
      {
        id: initialNoneUserId,
        email: `billing-${initialNoneUserId}@example.test`,
        username: `billing-${initialNoneUserId}`,
      },
    ]);
  });

  afterAll(async () => {
    const { and, eq, inArray } = await import('drizzle-orm');
    await database
      .delete(schema.billingInboundDeliveries)
      .where(
        and(
          eq(schema.billingInboundDeliveries.direction, PAID_TO_ROTE_DIRECTION),
          inArray(schema.billingInboundDeliveries.deliveryId, deliveryIds)
        )
      );
    await database
      .delete(schema.users)
      .where(
        inArray(schema.users.id, [userId, activationUserId, entitlementUserId, initialNoneUserId])
      );
    if (originalPushEnabled === undefined) delete process.env.PUSH_NOTIFICATIONS_ENABLED;
    else process.env.PUSH_NOTIFICATIONS_ENABLED = originalPushEnabled;
    const { closeDatabase } = await import('../utils/drizzle');
    await closeDatabase();
  });

  function grant(revision: number, productId = 'ink.rote.pro.yearly'): BillingGrantDelivery {
    const value = {
      ...JSON.parse(fixture.hmacCase.body),
      deliveryId: deliveryIds[revision - 1] ?? deliveryIds[0],
      revision: revision.toString(),
      productId,
    };
    return parseBillingGrantDelivery({
      value,
      requestId: value.deliveryId,
      instanceId: 'rote-official',
      productIds: ['ink.rote.pro.monthly', 'ink.rote.pro.yearly'],
      issuedAt: new Date(Number(fixture.hmacCase.timestamp) * 1000),
    });
  }

  function inbound(
    deliveryId: string,
    bodyHash: string,
    snapshot: BillingGrantDelivery,
    targetUserId = userId
  ) {
    return {
      direction: PAID_TO_ROTE_DIRECTION,
      deliveryId,
      keyId: 'paid-active',
      requestTarget: `/internal/billing/grants/${targetUserId}`,
      bodyHash,
      outcome: {
        kind: 'grant' as const,
        userId: targetUserId,
        grant: snapshot,
        snapshotHash: hashBillingGrantSnapshot(snapshot),
      },
    };
  }

  function revokedGrant(): BillingGrantDelivery {
    const value = JSON.parse(fixture.grantCases[1].body);
    return parseBillingGrantDelivery({
      value,
      requestId: value.deliveryId,
      instanceId: 'rote-official',
      productIds: ['ink.rote.pro.monthly', 'ink.rote.pro.yearly'],
      issuedAt: new Date(Number(fixture.hmacCase.timestamp) * 1000),
    });
  }

  it('atomically applies, ignores, deduplicates, and rejects revision conflicts', async () => {
    const revisionTwo = grant(2);
    expect(
      (await store.processInboundDelivery(inbound(deliveryIds[0], 'a'.repeat(64), revisionTwo)))
        .body.data
    ).toEqual({ result: 'applied', revision: '2' });

    const revisionOne = grant(1);
    expect(
      (await store.processInboundDelivery(inbound(deliveryIds[1], 'b'.repeat(64), revisionOne)))
        .body.data
    ).toEqual({ result: 'ignored', revision: '2' });

    expect(
      (await store.processInboundDelivery(inbound(deliveryIds[2], 'c'.repeat(64), revisionTwo)))
        .body.data
    ).toEqual({ result: 'duplicate', revision: '2' });

    const conflicting = grant(2, 'ink.rote.pro.monthly');
    expect(
      (await store.processInboundDelivery(inbound(deliveryIds[3], 'd'.repeat(64), conflicting)))
        .status
    ).toBe(409);
  });

  it('replays the saved response across key rotation and rejects body reuse', async () => {
    const snapshot = grant(2);
    const original = inbound(deliveryIds[2], 'c'.repeat(64), snapshot);
    const replay = await store.processInboundDelivery({ ...original, keyId: 'paid-previous' });
    expect(replay.body.data).toEqual({ result: 'duplicate', revision: '2' });

    const conflict = await store.processInboundDelivery({
      ...original,
      keyId: 'paid-previous',
      bodyHash: 'e'.repeat(64),
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.message).toBe('billing_delivery_conflict');

    const crossTargetReplay = await store.processInboundDelivery({
      ...original,
      keyId: 'paid-previous',
      requestTarget: `/internal/billing/grants/${activationUserId}`,
      outcome: { ...original.outcome, userId: activationUserId },
    });
    expect(crossTargetReplay.status).toBe(409);
    expect(crossTargetReplay.body.message).toBe('billing_delivery_conflict');
  });

  it('atomically applies activation snapshots with the same revision semantics', async () => {
    const revisionTwo = grant(2);
    expect((await store.applyGrantSnapshot(activationUserId, revisionTwo)).body.data).toEqual({
      result: 'applied',
      revision: '2',
    });
    expect((await store.applyGrantSnapshot(activationUserId, revisionTwo)).body.data).toEqual({
      result: 'duplicate',
      revision: '2',
    });
    expect((await store.applyGrantSnapshot(activationUserId, grant(1))).body.data).toEqual({
      result: 'ignored',
      revision: '2',
    });
    expect(
      (await store.applyGrantSnapshot(activationUserId, grant(2, 'ink.rote.pro.monthly'))).status
    ).toBe(409);
  });

  it('emits Pro notifications only when crossing the entitlement boundary', async () => {
    const { asc, eq } = await import('drizzle-orm');
    const active = { ...grant(1), revision: 1n };
    const grace = { ...grant(2), revision: 2n, status: 'grace_period' as const };
    const activeAgain = { ...grant(3), revision: 3n };
    const none = {
      ...grant(4),
      revision: 4n,
      status: 'none' as const,
      productId: null,
      entitlementExpiresAt: null,
      leaseExpiresAt: null,
      capabilities: [],
      benefits: null,
    };

    await store.applyGrantSnapshot(entitlementUserId, active);
    await store.applyGrantSnapshot(entitlementUserId, grace);
    await store.applyGrantSnapshot(entitlementUserId, activeAgain);
    await store.applyGrantSnapshot(entitlementUserId, none);

    const events = await database
      .select({ type: schema.pushEvents.type })
      .from(schema.pushEvents)
      .where(eq(schema.pushEvents.userid, entitlementUserId))
      .orderBy(asc(schema.pushEvents.createdAt));
    expect(events).toEqual([{ type: 'account.pro.active' }, { type: 'account.pro.inactive' }]);

    await store.applyGrantSnapshot(initialNoneUserId, { ...none, revision: 1n });
    const initialNoneEvents = await database
      .select()
      .from(schema.pushEvents)
      .where(eq(schema.pushEvents.userid, initialNoneUserId));
    expect(initialNoneEvents).toHaveLength(0);
  });

  it('returns a stable missing-user 404 and cascades grants on user deletion', async () => {
    const { eq } = await import('drizzle-orm');
    const missing = await store.processInboundDelivery(
      inbound(deliveryIds[4], 'f'.repeat(64), revokedGrant(), randomUUID())
    );
    expect(missing).toEqual({
      status: 404,
      body: { code: 404, message: 'billing_grant_user_not_found', data: null },
    });

    expect(await store.findGrantForUser(userId)).not.toBeNull();
    await database.delete(schema.users).where(eq(schema.users.id, userId));
    expect(await store.findGrantForUser(userId)).toBeNull();

    const callbackAfterDelete = await store.processInboundDelivery(
      inbound(deliveryIds[5], '0'.repeat(64), grant(3))
    );
    expect(callbackAfterDelete.body.message).toBe('billing_grant_user_not_found');
  });
});
