import { randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { apnsDevices, pushDeliveries, pushEvents, pushPreferences } from '../drizzle/schema';
import { db, withDatabaseAdvisoryLock } from '../utils/drizzle';
import type { ApnsEnvironment } from './config';
import { PushApiError } from './errors';
import { readPushPayloadMetadata, withPushPayloadMetadata } from './payload';
import {
  mergeReactionNotificationState,
  parseReactionNotificationState,
  reactionNoteLabel,
  reactionNotificationPresentation,
} from './reactionPresentation';

export type PushPreferencePatch = Partial<{
  reactionsEnabled: boolean;
  accountEnabled: boolean;
  systemEnabled: boolean;
  dailyReminderEnabled: boolean;
}>;

function scheduleNextReminderQuery(userid: string) {
  return sql`
    UPDATE push_preferences
    SET "nextReminderAt" = CASE
      WHEN (now() AT TIME ZONE "timeZone")::time < "dailyReminderTime"::time
        THEN (((now() AT TIME ZONE "timeZone")::date + "dailyReminderTime"::time) AT TIME ZONE "timeZone")
      ELSE ((((now() AT TIME ZONE "timeZone")::date + 1) + "dailyReminderTime"::time) AT TIME ZONE "timeZone")
    END,
    "updatedAt" = now()
    WHERE userid = ${userid}::uuid
  `;
}

export async function registerDevice(input: {
  userid: string;
  installationId: string;
  token: string;
  environment: ApnsEnvironment;
  masterEnabled?: boolean;
  timeZone: string;
}) {
  const normalizedToken = input.token.toLowerCase();
  const device = await db.transaction(async (transaction) => {
    // Serialize installation ownership, token ownership, and preference scheduling
    // even when their rows do not exist yet. A stable order avoids lock inversion.
    const lockKeys = [
      `push-device:${input.installationId}`,
      `push-token:${input.environment}:${normalizedToken}`,
      `push-preference:${input.userid}`,
    ].sort();
    for (const lockKey of lockKeys) {
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
    }

    let [existingInstallation] = await transaction
      .select({
        id: apnsDevices.id,
        userid: apnsDevices.userid,
        token: apnsDevices.token,
        masterEnabled: apnsDevices.masterEnabled,
        status: apnsDevices.status,
      })
      .from(apnsDevices)
      .where(eq(apnsDevices.installationId, input.installationId))
      .limit(1);
    let [existingToken] = await transaction
      .select({
        id: apnsDevices.id,
        userid: apnsDevices.userid,
        installationId: apnsDevices.installationId,
        token: apnsDevices.token,
        masterEnabled: apnsDevices.masterEnabled,
        status: apnsDevices.status,
      })
      .from(apnsDevices)
      .where(
        and(eq(apnsDevices.token, normalizedToken), eq(apnsDevices.environment, input.environment))
      )
      .limit(1);

    // A sender holds this lock from its final eligibility check until APNs and
    // the delivery update finish. Ownership changes wait here, so no old-account
    // payload can cross a committed transfer boundary.
    const activeDeviceIds = new Set(
      [existingInstallation?.id, existingToken?.id].filter((id): id is string => Boolean(id))
    );
    for (const deviceId of [...activeDeviceIds].sort()) {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`push-device-send:${deviceId}`}))`
      );
    }

    // The two stable input locks prevent new matches, while the send locks
    // serialize mutations of rows found by the initial lookup. Reload those
    // rows now so a concurrent refresh cannot be overwritten by this request's
    // pre-lock snapshot.
    [existingInstallation] = await transaction
      .select({
        id: apnsDevices.id,
        userid: apnsDevices.userid,
        token: apnsDevices.token,
        masterEnabled: apnsDevices.masterEnabled,
        status: apnsDevices.status,
      })
      .from(apnsDevices)
      .where(eq(apnsDevices.installationId, input.installationId))
      .limit(1);
    [existingToken] = await transaction
      .select({
        id: apnsDevices.id,
        userid: apnsDevices.userid,
        installationId: apnsDevices.installationId,
        token: apnsDevices.token,
        masterEnabled: apnsDevices.masterEnabled,
        status: apnsDevices.status,
      })
      .from(apnsDevices)
      .where(
        and(eq(apnsDevices.token, normalizedToken), eq(apnsDevices.environment, input.environment))
      )
      .limit(1);

    const reusableTokenDevice =
      existingToken &&
      existingToken.installationId !== input.installationId &&
      existingToken.userid === input.userid &&
      !existingInstallation
        ? existingToken
        : null;
    const retiringDeviceIds = new Set<string>();
    if (existingInstallation && existingInstallation.userid !== input.userid) {
      retiringDeviceIds.add(existingInstallation.id);
    }
    if (
      existingToken &&
      existingToken.installationId !== input.installationId &&
      !reusableTokenDevice
    ) {
      retiringDeviceIds.add(existingToken.id);
    }
    if (retiringDeviceIds.size > 0) {
      await transaction
        .update(pushDeliveries)
        .set({
          status: 'cancelled',
          lastError: 'device_owner_changed',
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(pushDeliveries.deviceId, [...retiringDeviceIds]),
            inArray(pushDeliveries.status, ['pending', 'retry', 'processing'])
          )
        );
    }

    const existingSameOwnerDevice =
      existingInstallation?.userid === input.userid
        ? existingInstallation
        : existingToken?.userid === input.userid
          ? existingToken
          : null;
    const reactivatingInvalidDevice =
      input.masterEnabled === undefined &&
      existingSameOwnerDevice?.status === 'invalid' &&
      existingSameOwnerDevice.token !== normalizedToken;
    const effectiveMasterEnabled =
      input.masterEnabled ??
      (reactivatingInvalidDevice ? true : existingSameOwnerDevice?.masterEnabled) ??
      true;
    const effectiveStatus = reactivatingInvalidDevice
      ? 'active'
      : input.masterEnabled === undefined && existingSameOwnerDevice
        ? existingSameOwnerDevice.status
        : effectiveMasterEnabled
          ? 'active'
          : 'disabled';
    const deviceValues = {
      userid: input.userid,
      token: normalizedToken,
      environment: input.environment,
      masterEnabled: effectiveMasterEnabled,
      timeZone: input.timeZone,
      status: effectiveStatus,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    };
    let registered;
    if (reusableTokenDevice) {
      // An app restore can retain its APNs token while generating a new
      // installation ID. Move the existing row so delivery history and queued
      // work keep their stable device foreign key.
      [registered] = await transaction
        .update(apnsDevices)
        .set({ ...deviceValues, installationId: input.installationId })
        .where(eq(apnsDevices.id, reusableTokenDevice.id))
        .returning();
    } else {
      if (existingToken && existingToken.installationId !== input.installationId) {
        // Preserve historical delivery rows while freeing the APNs token for its
        // current installation. Unsent work was cancelled above.
        await transaction
          .update(apnsDevices)
          .set({
            token: `retired:${existingToken.id}:${randomUUID()}`,
            status: 'disabled',
            masterEnabled: false,
            updatedAt: new Date(),
          })
          .where(eq(apnsDevices.id, existingToken.id));
      }
      [registered] = await transaction
        .insert(apnsDevices)
        .values({
          userid: input.userid,
          installationId: input.installationId,
          token: normalizedToken,
          environment: input.environment,
          masterEnabled: effectiveMasterEnabled,
          timeZone: input.timeZone,
          status: effectiveStatus,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: apnsDevices.installationId,
          set: deviceValues,
        })
        .returning();
    }

    const [existingPreference] = await transaction
      .select({ timeZone: pushPreferences.timeZone })
      .from(pushPreferences)
      .where(eq(pushPreferences.userid, input.userid))
      .limit(1);
    const timeZoneChanged = existingPreference?.timeZone !== input.timeZone;
    if (!existingPreference) {
      await transaction
        .insert(pushPreferences)
        .values({ userid: input.userid, timeZone: input.timeZone });
    } else if (timeZoneChanged) {
      await transaction
        .update(pushPreferences)
        .set({ timeZone: input.timeZone, updatedAt: new Date() })
        .where(eq(pushPreferences.userid, input.userid));
    }
    if (timeZoneChanged) {
      const staleDeliveries = await transaction.execute(sql`
        SELECT DISTINCT delivery."deviceId" AS "deviceId"
        FROM push_deliveries delivery
        JOIN push_events event ON event.id = delivery."eventId"
        WHERE event.userid = ${input.userid}::uuid
          AND event.type = 'habit.daily_record_reminder'
          AND delivery.status IN ('pending', 'retry', 'processing')
      `);
      const staleDeviceIds = staleDeliveries.map((row) => row.deviceId as string).sort();
      for (const deviceId of staleDeviceIds) {
        await transaction.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${`push-device-send:${deviceId}`}))`
        );
      }
      await transaction.execute(sql`
        WITH stale AS MATERIALIZED (
          SELECT event.id
          FROM push_events event
          WHERE event.userid = ${input.userid}::uuid
            AND event.type = 'habit.daily_record_reminder'
            AND (
              event.status = 'pending'
              OR EXISTS (
                SELECT 1 FROM push_deliveries delivery
                WHERE delivery."eventId" = event.id
                  AND delivery.status IN ('pending', 'retry', 'processing')
              )
            )
        ), cancelled_deliveries AS (
          UPDATE push_deliveries delivery
          SET status = 'cancelled', "lastError" = 'reminder_time_zone_changed', "updatedAt" = now()
          WHERE delivery."eventId" IN (SELECT id FROM stale)
            AND delivery.status IN ('pending', 'retry', 'processing')
        )
        UPDATE push_events event
        SET status = 'cancelled', "updatedAt" = now()
        WHERE event.id IN (SELECT id FROM stale)
      `);
      await transaction.execute(scheduleNextReminderQuery(input.userid));
    }
    return registered;
  });
  return device;
}

export async function disableDevice(userid: string, installationId: string) {
  return await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`push-device:${installationId}`}))`
    );
    const [current] = await transaction
      .select({ id: apnsDevices.id })
      .from(apnsDevices)
      .where(and(eq(apnsDevices.userid, userid), eq(apnsDevices.installationId, installationId)))
      .limit(1);
    if (!current) return null;
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`push-device-send:${current.id}`}))`
    );
    await transaction
      .update(pushDeliveries)
      .set({
        status: 'cancelled',
        lastError: 'device_disabled',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pushDeliveries.deviceId, current.id),
          inArray(pushDeliveries.status, ['pending', 'retry', 'processing'])
        )
      );
    const [device] = await transaction
      .update(apnsDevices)
      .set({ masterEnabled: false, status: 'disabled', updatedAt: new Date() })
      .where(eq(apnsDevices.id, current.id))
      .returning();
    return device ?? null;
  });
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
  return await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`push-preference:${userid}`}))`
    );
    const [current] = await transaction
      .select()
      .from(pushPreferences)
      .where(eq(pushPreferences.userid, userid))
      .limit(1);
    if (!current) throw new PushApiError('push_device_registration_required', 409);
    const deviceIds = await transaction
      .select({ id: apnsDevices.id })
      .from(apnsDevices)
      .where(eq(apnsDevices.userid, userid));
    for (const deviceId of deviceIds.map((device) => device.id).sort()) {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`push-device-send:${deviceId}`}))`
      );
    }
    const dailyReminderChanged =
      patch.dailyReminderEnabled !== undefined &&
      patch.dailyReminderEnabled !== current.dailyReminderEnabled;
    const disabledCategories = [
      patch.reactionsEnabled === false && current.reactionsEnabled ? 'reactions' : null,
      patch.accountEnabled === false && current.accountEnabled ? 'account' : null,
      patch.systemEnabled === false && current.systemEnabled ? 'system' : null,
      patch.dailyReminderEnabled === false && current.dailyReminderEnabled ? 'dailyReminder' : null,
    ].filter((category): category is string => category !== null);
    if (disabledCategories.length > 0) {
      await transaction
        .update(pushDeliveries)
        .set({
          status: 'cancelled',
          lastError: 'preference_disabled',
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(pushDeliveries.status, ['pending', 'retry', 'processing']),
            inArray(
              pushDeliveries.eventId,
              transaction
                .select({ id: pushEvents.id })
                .from(pushEvents)
                .where(
                  and(
                    eq(pushEvents.userid, userid),
                    inArray(pushEvents.category, disabledCategories)
                  )
                )
            )
          )
        );
    }
    const [updated] = await transaction
      .update(pushPreferences)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(pushPreferences.userid, userid))
      .returning();
    if (dailyReminderChanged) {
      await transaction.execute(scheduleNextReminderQuery(userid));
    }
    return updated;
  });
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

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function enqueueAggregatedReactionPushEventInTransaction(
  transaction: DatabaseTransaction,
  input: {
    userid: string;
    roteId: string;
    reactionType?: string;
    actorKey?: string;
    actorName?: string;
    noteTitle?: string | null;
    noteContent?: string;
  }
): Promise<void> {
  const now = new Date();
  await transaction.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`push-reaction:${input.userid}:${input.roteId}`}))`
  );
  const [pending] = await transaction
    .select({ id: pushEvents.id, payload: pushEvents.payload })
    .from(pushEvents)
    .where(
      and(
        eq(pushEvents.userid, input.userid),
        eq(pushEvents.type, 'reaction.received'),
        eq(pushEvents.status, 'pending'),
        sql`${pushEvents.availableAt} > now()`,
        sql`${pushEvents.payload}->>'roteId' = ${input.roteId}`
      )
    )
    .limit(1);

  const hasDetailedContext =
    input.reactionType !== undefined &&
    input.actorKey !== undefined &&
    input.noteContent !== undefined;
  if (pending && !hasDetailedContext) return;

  let presentation:
    | {
        titleLocKey: string;
        bodyLocKey: string;
        titleLocArgs: string[];
        bodyLocArgs: string[];
        state: ReturnType<typeof mergeReactionNotificationState>;
      }
    | undefined;
  if (hasDetailedContext) {
    const currentMetadata = readPushPayloadMetadata(pending?.payload);
    const state = mergeReactionNotificationState(
      parseReactionNotificationState(currentMetadata.reaction),
      {
        actorKey: input.actorKey!,
        actorName: input.actorName,
        reactionType: input.reactionType!,
        noteLabel: reactionNoteLabel(input.noteTitle, input.noteContent!),
      }
    );
    presentation = { ...reactionNotificationPresentation(state), state };
  }

  if (pending && presentation) {
    const currentMetadata = readPushPayloadMetadata(pending.payload);
    await transaction
      .update(pushEvents)
      .set({
        titleLocKey: presentation.titleLocKey,
        bodyLocKey: presentation.bodyLocKey,
        payload: withPushPayloadMetadata(
          { ...pending.payload, roteId: input.roteId },
          {
            ...currentMetadata,
            titleLocArgs: presentation.titleLocArgs,
            bodyLocArgs: presentation.bodyLocArgs,
            reaction: presentation.state,
          }
        ),
        updatedAt: new Date(),
      })
      .where(eq(pushEvents.id, pending.id));
    return;
  }

  const payload = presentation
    ? withPushPayloadMetadata(
        { roteId: input.roteId },
        {
          titleLocArgs: presentation.titleLocArgs,
          bodyLocArgs: presentation.bodyLocArgs,
          reaction: presentation.state,
        }
      )
    : { roteId: input.roteId };

  await transaction.insert(pushEvents).values({
    userid: input.userid,
    type: 'reaction.received',
    category: 'reactions',
    dedupeKey: `reaction:${input.roteId}:${randomUUID()}`,
    titleLocKey: presentation?.titleLocKey ?? 'push.reaction.title',
    bodyLocKey: presentation?.bodyLocKey ?? 'push.reaction.body',
    route: `rote://detail?id=${input.roteId}`,
    payload,
    availableAt: new Date(now.getTime() + 30_000),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  });
}

export async function enqueueAggregatedReactionPushEvent(input: {
  userid: string;
  roteId: string;
  reactionType?: string;
  actorKey?: string;
  actorName?: string;
  noteTitle?: string | null;
  noteContent?: string;
}): Promise<void> {
  await db.transaction(async (transaction) => {
    await enqueueAggregatedReactionPushEventInTransaction(transaction, input);
  });
}

export async function createDueDailyReminderEvents(): Promise<void> {
  await withDatabaseAdvisoryLock('push-daily-reminder-scheduler', async () => {
    await db.execute(sql`
      WITH due AS MATERIALIZED (
        SELECT p.userid, p."timeZone",
          (p."nextReminderAt" AT TIME ZONE p."timeZone")::date AS scheduled_local_date,
          (now() AT TIME ZONE p."timeZone")::date AS current_local_date,
          ((((p."nextReminderAt" AT TIME ZONE p."timeZone")::date + 1)::timestamp) AT TIME ZONE p."timeZone") AS expires_at,
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
        WHERE due.has_active_device
          AND due.scheduled_local_date = due.current_local_date
          AND due.expires_at > now()
          AND NOT EXISTS (
          SELECT 1 FROM rotes r
          WHERE r.authorid = due.userid
            AND r."createdAt" >= (due.scheduled_local_date::timestamp AT TIME ZONE due."timeZone")
            AND r."createdAt" < due.expires_at
        )
      ), inserted AS (
        INSERT INTO push_events
        (userid, type, category, "titleLocKey", "bodyLocKey", route, payload,
         "dedupeKey", status, "availableAt", "expiresAt", "createdAt", "updatedAt")
        SELECT userid, 'habit.daily_record_reminder', 'dailyReminder',
          'push.dailyReminder.title', 'push.dailyReminder.body', 'rote://new', '{}'::jsonb,
          'daily-reminder:' || userid::text || ':' || scheduled_local_date::text,
          'pending', now(), expires_at, now(), now()
        FROM eligible
        ON CONFLICT ("dedupeKey") DO NOTHING
        RETURNING userid
      )
      UPDATE push_preferences p
      SET "nextReminderAt" = CASE
            WHEN (now() AT TIME ZONE p."timeZone")::time < p."dailyReminderTime"::time
              THEN (((now() AT TIME ZONE p."timeZone")::date + p."dailyReminderTime"::time) AT TIME ZONE p."timeZone")
            ELSE ((((now() AT TIME ZONE p."timeZone")::date + 1) + p."dailyReminderTime"::time) AT TIME ZONE p."timeZone")
          END,
          "updatedAt" = now()
      FROM due
      WHERE p.userid = due.userid
    `);
  });
}
