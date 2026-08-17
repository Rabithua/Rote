import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env.PUSH_TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;

databaseDescribe('push repository integration', () => {
  let database: typeof import('../utils/drizzle').default;
  let schema: typeof import('../drizzle/schema');
  let repository: typeof import('./repository');
  let worker: typeof import('./worker');
  let admin: typeof import('../utils/dbMethods/admin');
  const userIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const installationIds = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];

  beforeAll(async () => {
    process.env.POSTGRESQL_URL = databaseUrl;
    ({ default: database } = await import('../utils/drizzle'));
    schema = await import('../drizzle/schema');
    repository = await import('./repository');
    worker = await import('./worker');
    admin = await import('../utils/dbMethods/admin');
    await database.insert(schema.users).values(
      userIds.map((id, index) => ({
        id,
        email: `push-${id}@example.test`,
        username: `push-${index}-${id}`,
      }))
    );
  });

  afterAll(async () => {
    const { inArray } = await import('drizzle-orm');
    await database.delete(schema.users).where(inArray(schema.users.id, userIds));
    const { closeDatabase } = await import('../utils/drizzle');
    await closeDatabase();
  });

  it('registers device, preferences, and first reminder atomically', async () => {
    const { eq } = await import('drizzle-orm');
    const device = await repository.registerDevice({
      userid: userIds[0],
      installationId: installationIds[0],
      token: 'a'.repeat(64),
      environment: 'production',
      masterEnabled: true,
      timeZone: 'UTC',
    });
    expect(device.installationId).toBe(installationIds[0]);
    const preference = await repository.getPreferences(userIds[0]);
    expect(preference?.timeZone).toBe('UTC');
    expect(preference?.nextReminderAt).toBeInstanceOf(Date);

    await repository.disableDevice(userIds[0], installationIds[0]);
    const refreshedDisabled = await repository.registerDevice({
      userid: userIds[0],
      installationId: installationIds[0],
      token: 'a'.repeat(64),
      environment: 'production',
      timeZone: 'UTC',
    });
    expect(refreshedDisabled.masterEnabled).toBe(false);
    expect(refreshedDisabled.status).toBe('disabled');
    const explicitlyEnabled = await repository.registerDevice({
      userid: userIds[0],
      installationId: installationIds[0],
      token: 'a'.repeat(64),
      environment: 'production',
      masterEnabled: true,
      timeZone: 'UTC',
    });
    expect(explicitlyEnabled.masterEnabled).toBe(true);
    expect(explicitlyEnabled.status).toBe('active');

    const invalidInstallationId = installationIds[4];
    await expect(
      repository.registerDevice({
        userid: userIds[2],
        installationId: invalidInstallationId,
        token: 'd'.repeat(64),
        environment: 'production',
        masterEnabled: true,
        timeZone: 'Invalid/TimeZone',
      })
    ).rejects.toThrow();

    expect(
      await database.query.apnsDevices.findFirst({
        where: eq(schema.apnsDevices.installationId, invalidInstallationId),
      })
    ).toBeUndefined();
    expect(await repository.getPreferences(userIds[2])).toBeNull();

    const invalidRefreshInstallationId = installationIds[3];
    await repository.registerDevice({
      userid: userIds[2],
      installationId: invalidRefreshInstallationId,
      token: 'd'.repeat(64),
      environment: 'production',
      masterEnabled: true,
      timeZone: 'UTC',
    });
    await database
      .update(schema.apnsDevices)
      .set({ status: 'invalid', masterEnabled: false })
      .where(eq(schema.apnsDevices.installationId, invalidRefreshInstallationId));
    const reactivated = await repository.registerDevice({
      userid: userIds[2],
      installationId: invalidRefreshInstallationId,
      token: 'f'.repeat(64),
      environment: 'production',
      timeZone: 'UTC',
    });
    expect(reactivated.masterEnabled).toBe(true);
    expect(reactivated.status).toBe('active');
  });

  it('preserves campaign history when its creator account is deleted', async () => {
    const { eq } = await import('drizzle-orm');
    const creatorId = randomUUID();
    const campaignId = randomUUID();
    await database.insert(schema.users).values({
      id: creatorId,
      email: `campaign-${creatorId}@example.test`,
      username: `campaign-${creatorId}`,
    });
    await database.insert(schema.pushCampaigns).values({
      id: campaignId,
      createdBy: creatorId,
      title: 'Historical campaign',
      body: 'Preserved after account deletion',
    });

    await database.delete(schema.users).where(eq(schema.users.id, creatorId));

    expect(
      await database.query.pushCampaigns.findFirst({
        where: eq(schema.pushCampaigns.id, campaignId),
      })
    ).toMatchObject({ createdBy: null });
    await database.delete(schema.pushCampaigns).where(eq(schema.pushCampaigns.id, campaignId));
  });

  it('canonicalizes APNs tokens before transferring ownership', async () => {
    const { and, eq, inArray } = await import('drizzle-orm');
    const firstUserId = randomUUID();
    const secondUserId = randomUUID();
    await database.insert(schema.users).values([
      {
        id: firstUserId,
        email: `token-a-${firstUserId}@example.test`,
        username: `token-a-${firstUserId}`,
      },
      {
        id: secondUserId,
        email: `token-b-${secondUserId}@example.test`,
        username: `token-b-${secondUserId}`,
      },
    ]);
    await repository.registerDevice({
      userid: firstUserId,
      installationId: randomUUID(),
      token: 'AB'.repeat(32),
      environment: 'production',
      timeZone: 'UTC',
    });
    const replacement = await repository.registerDevice({
      userid: secondUserId,
      installationId: randomUUID(),
      token: 'ab'.repeat(32),
      environment: 'production',
      timeZone: 'UTC',
    });

    expect(replacement.token).toBe('ab'.repeat(32));
    expect(replacement.userid).toBe(secondUserId);
    expect(
      await database
        .select()
        .from(schema.apnsDevices)
        .where(
          and(
            eq(schema.apnsDevices.token, 'ab'.repeat(32)),
            eq(schema.apnsDevices.environment, 'production')
          )
        )
    ).toHaveLength(1);
    await database
      .delete(schema.users)
      .where(inArray(schema.users.id, [firstUserId, secondUserId]));
  });

  it('schedules daily reminders with the stored time, deduplicates, and skips recorded users', async () => {
    const { and, eq, like } = await import('drizzle-orm');
    await repository.registerDevice({
      userid: userIds[1],
      installationId: installationIds[2],
      token: 'c'.repeat(64),
      environment: 'production',
      masterEnabled: true,
      timeZone: 'UTC',
    });
    const dueReminderAt = new Date(Date.now() - 60_000);
    await database
      .update(schema.pushPreferences)
      .set({ dailyReminderTime: '05:45', nextReminderAt: dueReminderAt })
      .where(eq(schema.pushPreferences.userid, userIds[0]));
    await database
      .update(schema.pushPreferences)
      .set({ dailyReminderTime: '06:15', nextReminderAt: new Date(Date.now() - 60_000) })
      .where(eq(schema.pushPreferences.userid, userIds[1]));
    await database.insert(schema.rotes).values({
      authorid: userIds[1],
      content: 'already recorded today',
    });

    await repository.registerDevice({
      userid: userIds[0],
      installationId: installationIds[0],
      token: 'a'.repeat(64),
      environment: 'production',
      masterEnabled: true,
      timeZone: 'UTC',
    });
    expect((await repository.getPreferences(userIds[0]))?.nextReminderAt?.getTime()).toBe(
      dueReminderAt.getTime()
    );

    await repository.updatePreferences(userIds[0], { reactionsEnabled: false });
    expect((await repository.getPreferences(userIds[0]))?.nextReminderAt?.getTime()).toBe(
      dueReminderAt.getTime()
    );
    await repository.updatePreferences(userIds[0], { dailyReminderEnabled: true });
    expect((await repository.getPreferences(userIds[0]))?.nextReminderAt?.getTime()).toBe(
      dueReminderAt.getTime()
    );
    await repository.updatePreferences(userIds[0], { reactionsEnabled: true });

    await repository.createDueDailyReminderEvents();
    await repository.createDueDailyReminderEvents();

    const reminderEvents = await database
      .select()
      .from(schema.pushEvents)
      .where(like(schema.pushEvents.dedupeKey, `daily-reminder:${userIds[0]}:%`));
    expect(reminderEvents).toHaveLength(1);
    const skippedEvents = await database
      .select()
      .from(schema.pushEvents)
      .where(like(schema.pushEvents.dedupeKey, `daily-reminder:${userIds[1]}:%`));
    expect(skippedEvents).toHaveLength(0);

    const [updatedPreference] = await database
      .select()
      .from(schema.pushPreferences)
      .where(and(eq(schema.pushPreferences.userid, userIds[0])));
    expect(updatedPreference.nextReminderAt?.getUTCHours()).toBe(5);
    expect(updatedPreference.nextReminderAt?.getUTCMinutes()).toBe(45);
    expect(updatedPreference.nextReminderAt?.getTime()).toBeGreaterThan(Date.now());
  });

  it('drops reminder occurrences missed before local midnight and schedules the next future time', async () => {
    const { eq, like } = await import('drizzle-orm');
    await repository.registerDevice({
      userid: userIds[3],
      installationId: installationIds[5],
      token: 'e'.repeat(64),
      environment: 'production',
      masterEnabled: true,
      timeZone: 'UTC',
    });
    await database
      .update(schema.pushPreferences)
      .set({
        dailyReminderTime: '21:30',
        nextReminderAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      })
      .where(eq(schema.pushPreferences.userid, userIds[3]));

    await repository.createDueDailyReminderEvents();

    expect(
      await database
        .select()
        .from(schema.pushEvents)
        .where(like(schema.pushEvents.dedupeKey, `daily-reminder:${userIds[3]}:%`))
    ).toHaveLength(0);
    const rescheduled = await repository.getPreferences(userIds[3]);
    expect(rescheduled?.nextReminderAt?.getTime()).toBeGreaterThan(Date.now());
    expect(rescheduled?.nextReminderAt?.getTime()).toBeLessThanOrEqual(
      Date.now() + 24 * 60 * 60 * 1000
    );
  });

  it('cancels reminders queued under the previous time zone', async () => {
    const { eq } = await import('drizzle-orm');
    const event = await repository.enqueuePushEvent({
      userid: userIds[0],
      type: 'habit.daily_record_reminder',
      category: 'dailyReminder',
      dedupeKey: `integration:old-zone:${randomUUID()}`,
    });
    await worker.fanOutEvents();
    const [delivery] = await database
      .select()
      .from(schema.pushDeliveries)
      .where(eq(schema.pushDeliveries.eventId, event!.id));
    expect(delivery.status).toBe('pending');

    await repository.registerDevice({
      userid: userIds[0],
      installationId: installationIds[0],
      token: 'a'.repeat(64),
      environment: 'production',
      timeZone: 'America/New_York',
    });
    const [cancelledEvent] = await database
      .select()
      .from(schema.pushEvents)
      .where(eq(schema.pushEvents.id, event!.id));
    const [cancelledDelivery] = await database
      .select()
      .from(schema.pushDeliveries)
      .where(eq(schema.pushDeliveries.id, delivery.id));
    expect(cancelledEvent.status).toBe('cancelled');
    expect(cancelledDelivery.status).toBe('cancelled');
    expect(cancelledDelivery.lastError).toBe('reminder_time_zone_changed');
  });

  it('fans out regular and targeted events and cancels expired or newly ineligible deliveries', async () => {
    const { and, eq, inArray } = await import('drizzle-orm');
    await repository.registerDevice({
      userid: userIds[0],
      installationId: installationIds[1],
      token: 'b'.repeat(64),
      environment: 'production',
      masterEnabled: true,
      timeZone: 'UTC',
    });
    const regular = await repository.enqueuePushEvent({
      userid: userIds[0],
      type: 'reaction.created',
      category: 'reactions',
      dedupeKey: `integration:regular:${randomUUID()}`,
      titleLocKey: 'push.reaction.title',
      bodyLocKey: 'push.reaction.body',
    });
    const targeted = await repository.enqueuePushEvent({
      userid: userIds[0],
      type: 'system.test',
      category: 'system',
      dedupeKey: `integration:targeted:${randomUUID()}`,
      payload: { targetInstallationId: installationIds[1] },
    });
    expect(regular).not.toBeNull();
    expect(targeted).not.toBeNull();

    await worker.fanOutEvents();
    const deliveries = await database
      .select()
      .from(schema.pushDeliveries)
      .where(inArray(schema.pushDeliveries.eventId, [regular!.id, targeted!.id]));
    expect(deliveries.filter((item) => item.eventId === regular!.id)).toHaveLength(2);
    expect(deliveries.filter((item) => item.eventId === targeted!.id)).toHaveLength(1);
    const targetedDelivery = deliveries.find((item) => item.eventId === targeted!.id);
    const targetedDevice = await database.query.apnsDevices.findFirst({
      where: and(
        eq(schema.apnsDevices.id, targetedDelivery!.deviceId),
        eq(schema.apnsDevices.installationId, installationIds[1])
      ),
    });
    expect(targetedDevice).not.toBeUndefined();

    await database
      .update(schema.pushEvents)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(schema.pushEvents.id, targeted!.id));
    await worker.cancelIneligibleDeliveries();
    const [expiredDelivery] = await database
      .select()
      .from(schema.pushDeliveries)
      .where(eq(schema.pushDeliveries.id, targetedDelivery!.id));
    expect(expiredDelivery.status).toBe('cancelled');
    const regularBeforeOptOut = await database
      .select()
      .from(schema.pushDeliveries)
      .where(eq(schema.pushDeliveries.eventId, regular!.id));
    expect(regularBeforeOptOut.every((item) => item.status === 'pending')).toBe(true);

    await repository.updatePreferences(userIds[0], { reactionsEnabled: false });
    const cancelledByOptOut = await database
      .select()
      .from(schema.pushDeliveries)
      .where(eq(schema.pushDeliveries.eventId, regular!.id));
    expect(cancelledByOptOut.every((item) => item.status === 'cancelled')).toBe(true);
    expect(cancelledByOptOut.every((item) => item.lastError === 'preference_disabled')).toBe(true);
    const deviceOptOutEvent = await repository.enqueuePushEvent({
      userid: userIds[0],
      type: 'system.device-opt-out',
      category: 'system',
      dedupeKey: `integration:device-opt-out:${randomUUID()}`,
      payload: { targetInstallationId: installationIds[1] },
    });
    await worker.fanOutEvents();
    const [deviceOptOutDelivery] = await database
      .select()
      .from(schema.pushDeliveries)
      .where(eq(schema.pushDeliveries.eventId, deviceOptOutEvent!.id));
    expect(deviceOptOutDelivery.status).toBe('pending');
    await repository.disableDevice(userIds[0], installationIds[1]);
    const [cancelledByDeviceDisable] = await database
      .select()
      .from(schema.pushDeliveries)
      .where(eq(schema.pushDeliveries.id, deviceOptOutDelivery.id));
    expect(cancelledByDeviceDisable).toMatchObject({
      status: 'cancelled',
      lastError: 'device_disabled',
    });
    await worker.cancelIneligibleDeliveries();

    const cancelled = await database
      .select()
      .from(schema.pushDeliveries)
      .where(
        inArray(
          schema.pushDeliveries.id,
          deliveries.map((item) => item.id)
        )
      );
    expect(cancelled.every((item) => item.status === 'cancelled')).toBe(true);
  });

  it('retires queued deliveries before transferring an installation to another account', async () => {
    const { and, eq } = await import('drizzle-orm');
    const event = await repository.enqueuePushEvent({
      userid: userIds[0],
      type: 'system.owner-transfer',
      category: 'system',
      dedupeKey: `integration:owner-transfer:${randomUUID()}`,
      payload: { targetInstallationId: installationIds[0] },
    });
    expect(event).not.toBeNull();

    await worker.fanOutEvents();
    const [queued] = await database
      .select()
      .from(schema.pushDeliveries)
      .where(eq(schema.pushDeliveries.eventId, event!.id));
    expect(queued.status).toBe('pending');

    const { withDatabaseAdvisoryLock } = await import('../utils/drizzle');
    let markSendLockHeld = () => {};
    const sendLockHeld = new Promise<void>((resolve) => {
      markSendLockHeld = resolve;
    });
    let releaseSendLock = () => {};
    const holdSendLock = new Promise<void>((resolve) => {
      releaseSendLock = resolve;
    });
    const simulatedSend = withDatabaseAdvisoryLock(
      `push-device-send:${queued.deviceId}`,
      async () => {
        markSendLockHeld();
        await holdSendLock;
      }
    );
    await sendLockHeld;
    let transferFinished = false;
    const transfer = repository
      .registerDevice({
        userid: userIds[1],
        installationId: installationIds[0],
        token: 'a'.repeat(64),
        environment: 'production',
        masterEnabled: true,
        timeZone: 'UTC',
      })
      .then((result) => {
        transferFinished = true;
        return result;
      });
    try {
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(transferFinished).toBe(false);
    } finally {
      releaseSendLock();
    }
    expect((await simulatedSend).acquired).toBe(true);
    const transferred = await transfer;
    expect(transferred.userid).toBe(userIds[1]);

    const [retired] = await database
      .select()
      .from(schema.pushDeliveries)
      .where(eq(schema.pushDeliveries.id, queued.id));
    expect(retired.status).toBe('cancelled');
    expect(retired.lastError).toBe('device_owner_changed');
    expect(
      await database.query.apnsDevices.findFirst({
        where: and(
          eq(schema.apnsDevices.installationId, installationIds[0]),
          eq(schema.apnsDevices.userid, userIds[1])
        ),
      })
    ).not.toBeUndefined();
  });

  it('preserves queued deliveries when a restored app keeps its token with a new installation ID', async () => {
    const { eq } = await import('drizzle-orm');
    const existingDevice = await database.query.apnsDevices.findFirst({
      where: eq(schema.apnsDevices.installationId, installationIds[0]),
    });
    expect(existingDevice?.userid).toBe(userIds[1]);
    const event = await repository.enqueuePushEvent({
      userid: userIds[1],
      type: 'system.app-restore',
      category: 'system',
      dedupeKey: `integration:app-restore:${randomUUID()}`,
      payload: { targetInstallationId: installationIds[0] },
    });
    await worker.fanOutEvents();
    const [queued] = await database
      .select()
      .from(schema.pushDeliveries)
      .where(eq(schema.pushDeliveries.eventId, event!.id));
    expect(queued.deviceId).toBe(existingDevice!.id);
    expect(queued.status).toBe('pending');

    const restored = await repository.registerDevice({
      userid: userIds[1],
      installationId: installationIds[4],
      token: 'a'.repeat(64),
      environment: 'production',
      masterEnabled: true,
      timeZone: 'UTC',
    });
    expect(restored.id).toBe(existingDevice!.id);
    expect(restored.installationId).toBe(installationIds[4]);
    const [preserved] = await database
      .select()
      .from(schema.pushDeliveries)
      .where(eq(schema.pushDeliveries.id, queued.id));
    expect(preserved.deviceId).toBe(existingDevice!.id);
    expect(preserved.status).toBe('pending');
  });

  it('anchors reaction aggregation to the first pending event', async () => {
    const { and, eq } = await import('drizzle-orm');
    const roteId = randomUUID();
    await Promise.all([
      repository.enqueueAggregatedReactionPushEvent({ userid: userIds[0], roteId }),
      repository.enqueueAggregatedReactionPushEvent({ userid: userIds[0], roteId }),
    ]);
    await repository.enqueueAggregatedReactionPushEvent({ userid: userIds[0], roteId });

    const aggregated = await database
      .select()
      .from(schema.pushEvents)
      .where(
        and(
          eq(schema.pushEvents.userid, userIds[0]),
          eq(schema.pushEvents.type, 'reaction.received')
        )
      );
    const matching = aggregated.filter((event) => event.payload.roteId === roteId);
    expect(matching).toHaveLength(1);

    await database
      .update(schema.pushEvents)
      .set({ availableAt: new Date(Date.now() - 1_000) })
      .where(eq(schema.pushEvents.id, matching[0].id));
    await repository.enqueueAggregatedReactionPushEvent({ userid: userIds[0], roteId });
    const nextWindow = await database
      .select()
      .from(schema.pushEvents)
      .where(
        and(
          eq(schema.pushEvents.userid, userIds[0]),
          eq(schema.pushEvents.type, 'reaction.received')
        )
      );
    expect(nextWindow.filter((event) => event.payload.roteId === roteId)).toHaveLength(2);
  });

  it('rolls back a reaction when its aggregated push event cannot be inserted', async () => {
    const { and, eq, sql } = await import('drizzle-orm');
    const { addReaction, removeReaction } = await import('../utils/dbMethods/reaction');
    const roteId = randomUUID();
    await database.insert(schema.rotes).values({
      id: roteId,
      authorid: userIds[0],
      content: 'reaction atomicity test',
    });
    await database.execute(sql`
      CREATE OR REPLACE FUNCTION fail_reaction_push_for_test()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.type = 'reaction.received' THEN
          RAISE EXCEPTION 'forced reaction push failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await database.execute(sql`
      CREATE TRIGGER fail_reaction_push_for_test
      BEFORE INSERT ON push_events
      FOR EACH ROW EXECUTE FUNCTION fail_reaction_push_for_test()
    `);
    const reactionInput = { type: 'heart', roteid: roteId, userid: userIds[1] };
    const previousPushEnabled = process.env.PUSH_NOTIFICATIONS_ENABLED;
    process.env.PUSH_NOTIFICATIONS_ENABLED = 'true';
    try {
      try {
        await expect(addReaction(reactionInput)).rejects.toThrow();
        expect(
          await database
            .select()
            .from(schema.reactions)
            .where(
              and(eq(schema.reactions.roteid, roteId), eq(schema.reactions.userid, userIds[1]))
            )
        ).toHaveLength(0);
      } finally {
        await database.execute(sql`
          DROP TRIGGER IF EXISTS fail_reaction_push_for_test ON push_events
        `);
        await database.execute(sql`DROP FUNCTION IF EXISTS fail_reaction_push_for_test()`);
      }

      await addReaction(reactionInput);
      expect(
        await database
          .select()
          .from(schema.reactions)
          .where(and(eq(schema.reactions.roteid, roteId), eq(schema.reactions.userid, userIds[1])))
      ).toHaveLength(1);
      await database
        .update(schema.pushEvents)
        .set({ availableAt: new Date(Date.now() - 1_000) })
        .where(
          and(
            eq(schema.pushEvents.userid, userIds[0]),
            eq(schema.pushEvents.type, 'reaction.received'),
            sql`${schema.pushEvents.payload}->>'roteId' = ${roteId}`
          )
        );
      await addReaction(reactionInput);
      expect(
        await database
          .select()
          .from(schema.pushEvents)
          .where(
            and(
              eq(schema.pushEvents.userid, userIds[0]),
              eq(schema.pushEvents.type, 'reaction.received'),
              sql`${schema.pushEvents.payload}->>'roteId' = ${roteId}`
            )
          )
      ).toHaveLength(1);

      let markLockHeld = () => {};
      const lockHeld = new Promise<void>((resolve) => {
        markLockHeld = resolve;
      });
      let releaseLock = () => {};
      const holdLock = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      const blocker = database.transaction(async (transaction) => {
        await transaction.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${`reaction:${roteId}:heart:user:${userIds[1]}`}))`
        );
        markLockHeld();
        await holdLock;
      });
      await lockHeld;
      let removalFinished = false;
      const removal = removeReaction(reactionInput).then((result) => {
        removalFinished = true;
        return result;
      });
      try {
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(removalFinished).toBe(false);
      } finally {
        releaseLock();
      }
      await blocker;
      expect((await removal).count).toBe(1);
    } finally {
      if (previousPushEnabled === undefined) {
        delete process.env.PUSH_NOTIFICATIONS_ENABLED;
      } else {
        process.env.PUSH_NOTIFICATIONS_ENABLED = previousPushEnabled;
      }
    }
  });

  it('rolls back certification when its push event cannot be inserted', async () => {
    const { eq, sql } = await import('drizzle-orm');
    await database.execute(sql`
      CREATE OR REPLACE FUNCTION fail_certification_push_for_test()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.type = 'account.certification.enabled' THEN
          RAISE EXCEPTION 'forced certification push failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await database.execute(sql`
      CREATE TRIGGER fail_certification_push_for_test
      BEFORE INSERT ON push_events
      FOR EACH ROW EXECUTE FUNCTION fail_certification_push_for_test()
    `);
    try {
      await expect(admin.certifyUser(userIds[2], true)).rejects.toThrow();
      const user = await database.query.users.findFirst({
        where: eq(schema.users.id, userIds[2]),
      });
      expect(user?.emailVerified).toBe(false);
    } finally {
      await database.execute(sql`
        DROP TRIGGER IF EXISTS fail_certification_push_for_test ON push_events
      `);
      await database.execute(sql`DROP FUNCTION IF EXISTS fail_certification_push_for_test()`);
    }
  });

  it('reports and enqueues only one certification transition under concurrent updates', async () => {
    const { and, eq } = await import('drizzle-orm');
    const certified = await Promise.all([
      admin.certifyUser(userIds[2], true),
      admin.certifyUser(userIds[2], true),
      admin.certifyUser(userIds[2], true),
    ]);
    expect(certified.filter((result) => result.changed)).toHaveLength(1);
    expect(certified.every((result) => result.user?.certified === true)).toBe(true);
    expect(
      await database
        .select()
        .from(schema.pushEvents)
        .where(
          and(
            eq(schema.pushEvents.userid, userIds[2]),
            eq(schema.pushEvents.type, 'account.certification.enabled')
          )
        )
    ).toHaveLength(1);

    const uncertified = await Promise.all([
      admin.uncertifyUser(userIds[2], true),
      admin.uncertifyUser(userIds[2], true),
      admin.uncertifyUser(userIds[2], true),
    ]);
    expect(uncertified.filter((result) => result.changed)).toHaveLength(1);
    expect(uncertified.every((result) => result.user?.certified === false)).toBe(true);
    expect(
      await database
        .select()
        .from(schema.pushEvents)
        .where(
          and(
            eq(schema.pushEvents.userid, userIds[2]),
            eq(schema.pushEvents.type, 'account.certification.disabled')
          )
        )
    ).toHaveLength(1);
  });

  it('preserves APNs devices, preferences, events, and deliveries during account merge', async () => {
    const { and, eq } = await import('drizzle-orm');
    const { mergeUserAccounts } = await import('../utils/dbMethods/userAccount');
    await database
      .update(schema.pushPreferences)
      .set({ reactionsEnabled: false })
      .where(eq(schema.pushPreferences.userid, userIds[3]));
    const event = await repository.enqueuePushEvent({
      userid: userIds[3],
      type: 'system.merge-preservation',
      category: 'system',
      dedupeKey: `integration:merge:${randomUUID()}`,
      payload: { targetInstallationId: installationIds[5] },
    });
    await worker.fanOutEvents();
    const [delivery] = await database
      .select()
      .from(schema.pushDeliveries)
      .where(eq(schema.pushDeliveries.eventId, event!.id));
    expect(delivery).not.toBeUndefined();
    const campaignId = randomUUID();
    await database.insert(schema.pushCampaigns).values({
      id: campaignId,
      createdBy: userIds[3],
      title: 'Merge campaign',
      body: 'Campaign body',
    });
    const sourceCampaign = await repository.enqueuePushEvent({
      userid: userIds[3],
      type: 'system.campaign',
      category: 'system',
      dedupeKey: `campaign:${campaignId}:${userIds[3]}`,
      payload: { campaignId },
    });
    const targetCampaign = await repository.enqueuePushEvent({
      userid: userIds[4],
      type: 'system.campaign',
      category: 'system',
      dedupeKey: `campaign:${campaignId}:${userIds[4]}`,
      payload: { campaignId },
    });
    await worker.fanOutEvents();
    const reminderDate = '2099-01-01';
    const sourceReminder = await repository.enqueuePushEvent({
      userid: userIds[3],
      type: 'habit.daily_record_reminder',
      category: 'dailyReminder',
      dedupeKey: `daily-reminder:${userIds[3]}:${reminderDate}`,
    });
    const targetReminder = await repository.enqueuePushEvent({
      userid: userIds[4],
      type: 'habit.daily_record_reminder',
      category: 'dailyReminder',
      dedupeKey: `daily-reminder:${userIds[4]}:${reminderDate}`,
    });

    const merged = await mergeUserAccounts(userIds[3], userIds[4]);
    expect(merged.success).toBe(true);
    expect(merged.mergedData.apnsDevices).toBe(1);
    expect(merged.mergedData.pushEvents).toBeGreaterThanOrEqual(1);
    expect(
      await database.query.users.findFirst({ where: eq(schema.users.id, userIds[3]) })
    ).toBeUndefined();
    const migratedDevice = await database.query.apnsDevices.findFirst({
      where: eq(schema.apnsDevices.installationId, installationIds[5]),
    });
    expect(migratedDevice?.userid).toBe(userIds[4]);
    const migratedPreferences = await repository.getPreferences(userIds[4]);
    expect(migratedPreferences?.reactionsEnabled).toBe(false);
    const migratedEvent = await database.query.pushEvents.findFirst({
      where: eq(schema.pushEvents.id, event!.id),
    });
    expect(migratedEvent?.userid).toBe(userIds[4]);
    const migratedSourceCampaign = await database.query.pushEvents.findFirst({
      where: eq(schema.pushEvents.id, sourceCampaign!.id),
    });
    const retainedTargetCampaign = await database.query.pushEvents.findFirst({
      where: eq(schema.pushEvents.id, targetCampaign!.id),
    });
    expect(migratedSourceCampaign?.userid).toBe(userIds[4]);
    expect(migratedSourceCampaign?.status).toBe('cancelled');
    expect(retainedTargetCampaign?.status).toBe('pending');
    expect(
      await database.query.pushDeliveries.findFirst({
        where: eq(schema.pushDeliveries.eventId, sourceCampaign!.id),
      })
    ).toMatchObject({ status: 'cancelled' });
    expect(
      await database.query.pushEvents.findFirst({
        where: eq(schema.pushEvents.id, sourceReminder!.id),
      })
    ).toMatchObject({ status: 'cancelled' });
    expect(
      await database.query.pushEvents.findFirst({
        where: eq(schema.pushEvents.id, targetReminder!.id),
      })
    ).toMatchObject({ status: 'pending' });
    await worker.fanOutEvents();
    expect(
      await database.query.pushDeliveries.findFirst({
        where: and(
          eq(schema.pushDeliveries.eventId, targetCampaign!.id),
          eq(schema.pushDeliveries.deviceId, migratedDevice!.id)
        ),
      })
    ).toMatchObject({ status: 'pending' });
    expect(
      await database.query.pushCampaigns.findFirst({
        where: eq(schema.pushCampaigns.id, campaignId),
      })
    ).toMatchObject({ createdBy: userIds[4] });
    expect(
      await database.query.pushDeliveries.findFirst({
        where: eq(schema.pushDeliveries.id, delivery.id),
      })
    ).not.toBeUndefined();
  });
});
