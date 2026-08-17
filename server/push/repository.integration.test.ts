import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env.PUSH_TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;

databaseDescribe('push repository integration', () => {
  let database: typeof import('../utils/drizzle').default;
  let schema: typeof import('../drizzle/schema');
  let repository: typeof import('./repository');
  let worker: typeof import('./worker');
  const userIds = [randomUUID(), randomUUID(), randomUUID()];
  const installationIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];

  beforeAll(async () => {
    process.env.POSTGRESQL_URL = databaseUrl;
    ({ default: database } = await import('../utils/drizzle'));
    schema = await import('../drizzle/schema');
    repository = await import('./repository');
    worker = await import('./worker');
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
    await database
      .update(schema.pushPreferences)
      .set({ dailyReminderTime: '05:45', nextReminderAt: new Date(Date.now() - 60_000) })
      .where(eq(schema.pushPreferences.userid, userIds[0]));
    await database
      .update(schema.pushPreferences)
      .set({ dailyReminderTime: '06:15', nextReminderAt: new Date(Date.now() - 60_000) })
      .where(eq(schema.pushPreferences.userid, userIds[1]));
    await database.insert(schema.rotes).values({
      authorid: userIds[1],
      content: 'already recorded today',
    });

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

  it('fans out regular and installation-targeted events and cancels newly ineligible deliveries', async () => {
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
      .update(schema.pushPreferences)
      .set({ reactionsEnabled: false })
      .where(eq(schema.pushPreferences.userid, userIds[0]));
    await repository.disableDevice(userIds[0], installationIds[1]);
    await worker.deliverBatch();

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
});
