import { and, eq, inArray, lte, or, sql } from 'drizzle-orm';
import { apnsDevices, pushDeliveries, pushEvents, pushPreferences } from '../drizzle/schema';
import { db, withDatabaseAdvisoryLock } from '../utils/drizzle';
import { sendApns } from './apns';
import {
  DELIVERY_BATCH_SIZE,
  DELIVERY_CLAIM_LEASE_MS,
  hasSafeDeliveryClaimLease,
  shouldInvalidateDeviceForApnsReason,
} from './deliveryPolicy';
import { createDueDailyReminderEvents } from './repository';

export { DELIVERY_BATCH_SIZE, DELIVERY_CLAIM_LEASE_MS, hasSafeDeliveryClaimLease };

export async function fanOutEvents(): Promise<void> {
  await db
    .update(pushEvents)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(and(eq(pushEvents.status, 'pending'), lte(pushEvents.expiresAt, new Date())));
  await db.execute(sql`
    WITH ready AS MATERIALIZED (
      SELECT e.*
      FROM push_events e
      WHERE e.status = 'pending' AND e."availableAt" <= now()
        AND (e."expiresAt" IS NULL OR e."expiresAt" > now())
      ORDER BY e."availableAt"
      LIMIT 500
      FOR UPDATE SKIP LOCKED
    ), created AS (
      INSERT INTO push_deliveries ("eventId", "deviceId", status, "nextAttemptAt", "createdAt", "updatedAt")
      SELECT e.id, d.id, 'pending', now(), now(), now()
      FROM ready e
    JOIN push_preferences p ON p.userid = e.userid
    JOIN apns_devices d ON d.userid = e.userid
      WHERE d.status = 'active' AND d."masterEnabled" = true
      AND (e.payload->>'targetInstallationId' IS NULL
        OR d."installationId"::text = e.payload->>'targetInstallationId')
      AND CASE e.category
        WHEN 'reactions' THEN p."reactionsEnabled"
        WHEN 'account' THEN p."accountEnabled"
        WHEN 'system' THEN p."systemEnabled"
        WHEN 'dailyReminder' THEN p."dailyReminderEnabled"
        ELSE false
      END
      ON CONFLICT ("eventId", "deviceId") DO NOTHING
      RETURNING "eventId"
    )
    UPDATE push_events e
    SET status = 'processed', "updatedAt" = now()
    FROM ready
    WHERE e.id = ready.id
  `);
}

export async function cancelIneligibleDeliveries(): Promise<void> {
  await db.execute(sql`
    UPDATE push_deliveries delivery
    SET status = 'cancelled', "updatedAt" = now()
    FROM push_events event, apns_devices device, push_preferences preference
    WHERE delivery."eventId" = event.id
      AND delivery."deviceId" = device.id
      AND preference.userid = event.userid
      AND delivery.status IN ('pending', 'retry', 'processing')
      AND (
        (event."expiresAt" IS NOT NULL AND event."expiresAt" <= now())
        OR device.userid <> event.userid
        OR device.status <> 'active'
        OR device."masterEnabled" = false
        OR NOT CASE event.category
          WHEN 'reactions' THEN preference."reactionsEnabled"
          WHEN 'account' THEN preference."accountEnabled"
          WHEN 'system' THEN preference."systemEnabled"
          WHEN 'dailyReminder' THEN preference."dailyReminderEnabled"
          ELSE false
        END
      )
  `);
}

async function stillEligibleForDailyReminder(userid: string, timeZone: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT NOT EXISTS (
      SELECT 1 FROM rotes
      WHERE authorid = ${userid}::uuid
        AND "createdAt" >= (((now() AT TIME ZONE ${timeZone})::date)::timestamp AT TIME ZONE ${timeZone})
        AND "createdAt" < ((((now() AT TIME ZONE ${timeZone})::date + 1)::timestamp) AT TIME ZONE ${timeZone})
    ) AS eligible
  `);
  return result[0]?.eligible === true;
}

type ClaimedDelivery = {
  delivery: typeof pushDeliveries.$inferSelect;
  event: typeof pushEvents.$inferSelect;
  device: typeof apnsDevices.$inferSelect;
  preference: typeof pushPreferences.$inferSelect;
};

async function reloadEligibleDelivery(deliveryId: string): Promise<ClaimedDelivery | null> {
  const [current] = await db
    .select({
      delivery: pushDeliveries,
      event: pushEvents,
      device: apnsDevices,
      preference: pushPreferences,
    })
    .from(pushDeliveries)
    .innerJoin(pushEvents, eq(pushDeliveries.eventId, pushEvents.id))
    .innerJoin(apnsDevices, eq(pushDeliveries.deviceId, apnsDevices.id))
    .innerJoin(pushPreferences, eq(pushEvents.userid, pushPreferences.userid))
    .where(
      and(
        eq(pushDeliveries.id, deliveryId),
        eq(pushDeliveries.status, 'processing'),
        eq(apnsDevices.userid, pushEvents.userid),
        eq(apnsDevices.status, 'active'),
        eq(apnsDevices.masterEnabled, true),
        or(sql`${pushEvents.expiresAt} IS NULL`, sql`${pushEvents.expiresAt} > now()`),
        sql`CASE ${pushEvents.category}
          WHEN 'reactions' THEN ${pushPreferences.reactionsEnabled}
          WHEN 'account' THEN ${pushPreferences.accountEnabled}
          WHEN 'system' THEN ${pushPreferences.systemEnabled}
          WHEN 'dailyReminder' THEN ${pushPreferences.dailyReminderEnabled}
          ELSE false
        END`
      )
    )
    .limit(1);
  return current ?? null;
}

async function deliverClaimedItem(item: ClaimedDelivery): Promise<void> {
  // The registration path uses the same advisory lock. Reload after acquiring
  // it so a claim can never send or invalidate a token snapshot that was
  // replaced while the worker waited for the lock.
  const current = await reloadEligibleDelivery(item.delivery.id);
  if (!current) {
    await db
      .update(pushDeliveries)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(pushDeliveries.id, item.delivery.id));
    return;
  }
  item = current;
  if (
    item.event.category === 'dailyReminder' &&
    !(await stillEligibleForDailyReminder(item.event.userid, item.preference.timeZone))
  ) {
    await db
      .update(pushDeliveries)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(pushDeliveries.id, item.delivery.id));
    return;
  }
  try {
    const response = await sendApns({
      token: item.device.token,
      environment: item.device.environment as 'sandbox' | 'production',
      title: item.event.title,
      body: item.event.body,
      titleLocKey: item.event.titleLocKey,
      bodyLocKey: item.event.bodyLocKey,
      route: item.event.route,
      payload: item.event.payload,
      expiration: item.event.expiresAt,
      collapseId: item.event.dedupeKey.slice(0, 64),
    });
    await db
      .update(pushDeliveries)
      .set({
        status: 'sent',
        sentAt: new Date(),
        apnsId: response.apnsId,
        attemptCount: item.delivery.attemptCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(pushDeliveries.id, item.delivery.id));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const permanent = shouldInvalidateDeviceForApnsReason(reason);
    const attempts = item.delivery.attemptCount + 1;
    if (permanent) {
      await db
        .update(apnsDevices)
        .set({ status: 'invalid', masterEnabled: false, updatedAt: new Date() })
        .where(eq(apnsDevices.id, item.device.id));
    }
    await db
      .update(pushDeliveries)
      .set({
        status: permanent || attempts >= 6 ? 'failed' : 'retry',
        attemptCount: attempts,
        nextAttemptAt: new Date(Date.now() + Math.min(3600, 2 ** attempts * 30) * 1000),
        lastError: reason,
        updatedAt: new Date(),
      })
      .where(eq(pushDeliveries.id, item.delivery.id));
  }
}

export async function deliverBatch(): Promise<number> {
  await cancelIneligibleDeliveries();
  const deliveries = await db.transaction(async (transaction) => {
    const claimed = await transaction
      .select({
        delivery: pushDeliveries,
        event: pushEvents,
        device: apnsDevices,
        preference: pushPreferences,
      })
      .from(pushDeliveries)
      .innerJoin(pushEvents, eq(pushDeliveries.eventId, pushEvents.id))
      .innerJoin(apnsDevices, eq(pushDeliveries.deviceId, apnsDevices.id))
      .innerJoin(pushPreferences, eq(pushEvents.userid, pushPreferences.userid))
      .where(
        and(
          inArray(pushDeliveries.status, ['pending', 'retry', 'processing']),
          lte(pushDeliveries.nextAttemptAt, new Date()),
          or(sql`${pushEvents.expiresAt} IS NULL`, sql`${pushEvents.expiresAt} > now()`),
          eq(apnsDevices.userid, pushEvents.userid),
          eq(apnsDevices.status, 'active'),
          eq(apnsDevices.masterEnabled, true),
          sql`CASE ${pushEvents.category}
            WHEN 'reactions' THEN ${pushPreferences.reactionsEnabled}
            WHEN 'account' THEN ${pushPreferences.accountEnabled}
            WHEN 'system' THEN ${pushPreferences.systemEnabled}
            WHEN 'dailyReminder' THEN ${pushPreferences.dailyReminderEnabled}
            ELSE false
          END`
        )
      )
      .limit(DELIVERY_BATCH_SIZE)
      .for('update', { of: pushDeliveries, skipLocked: true });
    if (claimed.length > 0) {
      await transaction
        .update(pushDeliveries)
        .set({
          status: 'processing',
          nextAttemptAt: new Date(Date.now() + DELIVERY_CLAIM_LEASE_MS),
          updatedAt: new Date(),
        })
        .where(
          inArray(
            pushDeliveries.id,
            claimed.map((item) => item.delivery.id)
          )
        );
    }
    return claimed;
  });

  for (const item of deliveries) {
    const lockResult = await withDatabaseAdvisoryLock(`push-device-send:${item.device.id}`, () =>
      deliverClaimedItem(item)
    );
    if (!lockResult.acquired) {
      await db
        .update(pushDeliveries)
        .set({
          status: 'retry',
          nextAttemptAt: new Date(Date.now() + 1_000),
          updatedAt: new Date(),
        })
        .where(
          and(eq(pushDeliveries.id, item.delivery.id), eq(pushDeliveries.status, 'processing'))
        );
    }
  }
  return deliveries.length;
}

export async function runPushWorkerIteration(): Promise<number> {
  await createDueDailyReminderEvents();
  await fanOutEvents();
  return await deliverBatch();
}
