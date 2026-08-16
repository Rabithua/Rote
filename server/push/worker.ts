import { and, eq, inArray, lte, or, sql } from 'drizzle-orm';
import { apnsDevices, pushDeliveries, pushEvents, pushPreferences } from '../drizzle/schema';
import { db } from '../utils/drizzle';
import { sendApns } from './apns';
import { createDueDailyReminderEvents } from './repository';

const permanentReasons = new Set(['BadDeviceToken', 'DeviceTokenNotForTopic', 'Unregistered']);

async function fanOutEvents(): Promise<void> {
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
        OR d."installationId" = e.payload->>'targetInstallationId')
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

async function deliverBatch(): Promise<void> {
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
          or(sql`${pushEvents.expiresAt} IS NULL`, sql`${pushEvents.expiresAt} > now()`)
        )
      )
      .limit(100)
      .for('update', { of: pushDeliveries, skipLocked: true });
    if (claimed.length > 0) {
      await transaction
        .update(pushDeliveries)
        .set({
          status: 'processing',
          nextAttemptAt: new Date(Date.now() + 5 * 60 * 1000),
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
    if (
      item.event.category === 'dailyReminder' &&
      !(await stillEligibleForDailyReminder(item.event.userid, item.preference.timeZone))
    ) {
      await db
        .update(pushDeliveries)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(pushDeliveries.id, item.delivery.id));
      continue;
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
      const permanent = permanentReasons.has(reason);
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
}

export async function runPushWorkerIteration(): Promise<void> {
  await createDueDailyReminderEvents();
  await fanOutEvents();
  await deliverBatch();
}
