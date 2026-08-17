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
  const userIds = [randomUUID(), randomUUID(), randomUUID()];
  const installationIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];

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

    const invalidInstallationId = installationIds[3];
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

    const { eq } = await import('drizzle-orm');
    expect(
      await database.query.apnsDevices.findFirst({
        where: eq(schema.apnsDevices.installationId, invalidInstallationId),
      })
    ).toBeUndefined();
    expect(await repository.getPreferences(userIds[2])).toBeNull();
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

    await database
      .update(schema.pushPreferences)
      .set({ reactionsEnabled: false })
      .where(eq(schema.pushPreferences.userid, userIds[0]));
    await repository.disableDevice(userIds[0], installationIds[1]);
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

    const transferred = await repository.registerDevice({
      userid: userIds[1],
      installationId: installationIds[0],
      token: 'a'.repeat(64),
      environment: 'production',
      masterEnabled: true,
      timeZone: 'UTC',
    });
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
});
