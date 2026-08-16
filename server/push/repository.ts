import { and, eq, ne, sql } from 'drizzle-orm';
import { apnsDevices, pushEvents, pushPreferences } from '../drizzle/schema';
import { db, withDatabaseAdvisoryLock } from '../utils/drizzle';
import type { ApnsEnvironment } from './config';

export type PushPreferencePatch = Partial<{
  reactionsEnabled: boolean;
  accountEnabled: boolean;
  systemEnabled: boolean;
  dailyReminderEnabled: boolean;
}>;

async function scheduleNextReminder(userid: string): Promise<void> {
  await db.execute(sql`
    UPDATE push_preferences
    SET "nextReminderAt" = CASE
      WHEN (now() AT TIME ZONE "timeZone")::time < time '21:30'
        THEN (((now() AT TIME ZONE "timeZone")::date + time '21:30') AT TIME ZONE "timeZone")
      ELSE ((((now() AT TIME ZONE "timeZone")::date + 1) + time '21:30') AT TIME ZONE "timeZone")
    END,
    "updatedAt" = now()
    WHERE userid = ${userid}::uuid
  `);
}

export async function registerDevice(input: {
  userid: string;
  installationId: string;
  token: string;
  environment: ApnsEnvironment;
  masterEnabled: boolean;
  timeZone: string;
}) {
  const device = await db.transaction(async (transaction) => {
    // A restored installation may receive a token that was previously associated
    // with another installation identifier. Keep the APNs token single-owner.
    await transaction
      .delete(apnsDevices)
      .where(
        and(
          eq(apnsDevices.token, input.token),
          eq(apnsDevices.environment, input.environment),
          ne(apnsDevices.installationId, input.installationId)
        )
      );
    const [registered] = await transaction
      .insert(apnsDevices)
      .values({ ...input, status: 'active', lastSeenAt: new Date(), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: apnsDevices.installationId,
        set: {
          userid: input.userid,
          token: input.token,
          environment: input.environment,
          masterEnabled: input.masterEnabled,
          timeZone: input.timeZone,
          status: 'active',
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    return registered;
  });

  await db
    .insert(pushPreferences)
    .values({ userid: input.userid, timeZone: input.timeZone })
    .onConflictDoUpdate({
      target: pushPreferences.userid,
      set: { timeZone: input.timeZone, updatedAt: new Date() },
    });
  await scheduleNextReminder(input.userid);
  return device;
}

export async function disableDevice(userid: string, installationId: string) {
  const [device] = await db
    .update(apnsDevices)
    .set({ masterEnabled: false, status: 'disabled', updatedAt: new Date() })
    .where(and(eq(apnsDevices.userid, userid), eq(apnsDevices.installationId, installationId)))
    .returning();
  return device ?? null;
}

export async function getActiveDevice(userid: string, installationId: string) {
  return (
    (await db.query.apnsDevices.findFirst({
      where: and(
        eq(apnsDevices.userid, userid),
        eq(apnsDevices.installationId, installationId),
        eq(apnsDevices.status, 'active'),
        eq(apnsDevices.masterEnabled, true)
      ),
    })) ?? null
  );
}

export async function getPreferences(userid: string) {
  return (
    (await db.query.pushPreferences.findFirst({ where: eq(pushPreferences.userid, userid) })) ??
    null
  );
}

export async function updatePreferences(userid: string, patch: PushPreferencePatch) {
  const current = await getPreferences(userid);
  if (!current) throw new Error('Register a push device before updating preferences');
  const [updated] = await db
    .update(pushPreferences)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(pushPreferences.userid, userid))
    .returning();
  await scheduleNextReminder(userid);
  return updated;
}

export async function enqueuePushEvent(input: {
  userid: string;
  type: string;
  category: string;
  dedupeKey: string;
  title?: string;
  body?: string;
  titleLocKey?: string;
  bodyLocKey?: string;
  route?: string;
  payload?: Record<string, unknown>;
  availableAt?: Date;
  expiresAt?: Date;
}) {
  const [event] = await db
    .insert(pushEvents)
    .values(input)
    .onConflictDoNothing({ target: pushEvents.dedupeKey })
    .returning();
  return event ?? null;
}

export async function createDueDailyReminderEvents(): Promise<void> {
  await withDatabaseAdvisoryLock('push-daily-reminder-scheduler', async () => {
    await db.execute(sql`
      WITH due AS MATERIALIZED (
        SELECT p.userid, p."timeZone",
          (now() AT TIME ZONE p."timeZone")::date AS local_date,
          (((now() AT TIME ZONE p."timeZone")::date + 1)::timestamp AT TIME ZONE p."timeZone") AS expires_at,
          EXISTS (
            SELECT 1 FROM apns_devices d
            WHERE d.userid = p.userid AND d.status = 'active' AND d."masterEnabled" = true
          ) AS has_active_device
        FROM push_preferences p
        WHERE p."dailyReminderEnabled" = true
          AND p."nextReminderAt" <= now()
        ORDER BY p."nextReminderAt"
        LIMIT 500
      ), eligible AS (
        SELECT due.* FROM due
        WHERE due.has_active_device AND NOT EXISTS (
          SELECT 1 FROM rotes r
          WHERE r.authorid = due.userid
            AND r."createdAt" >= (due.local_date::timestamp AT TIME ZONE due."timeZone")
            AND r."createdAt" < due.expires_at
        )
      )
      ), inserted AS (
        INSERT INTO push_events
        (userid, type, category, "titleLocKey", "bodyLocKey", route, payload,
         "dedupeKey", status, "availableAt", "expiresAt", "createdAt", "updatedAt")
        SELECT userid, 'habit.daily_record_reminder', 'dailyReminder',
          'push.dailyReminder.title', 'push.dailyReminder.body', 'rote://new', '{}'::jsonb,
          'daily-reminder:' || userid::text || ':' || local_date::text,
          'pending', now(), expires_at, now(), now()
        FROM eligible
        ON CONFLICT ("dedupeKey") DO NOTHING
        RETURNING userid
      )
      UPDATE push_preferences p
      SET "nextReminderAt" = ((((now() AT TIME ZONE p."timeZone")::date + 1) + time '21:30') AT TIME ZONE p."timeZone"),
          "updatedAt" = now()
      FROM due
      WHERE p.userid = due.userid
    `);
  });
}
