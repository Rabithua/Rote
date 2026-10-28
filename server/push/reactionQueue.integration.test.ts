import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { serializeApnsPayload } from './apns';
import { prepareApnsPayload } from './payload';

const databaseUrl = process.env.PUSH_TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;

databaseDescribe('reaction queue avatar contract', () => {
  let database: typeof import('../utils/drizzle').default;
  let schema: typeof import('../drizzle/schema');
  let addReaction: typeof import('../utils/dbMethods/reaction').addReaction;
  const userIds = [randomUUID(), randomUUID(), randomUUID()];
  const roteId = randomUUID();
  const previousPushEnabled = process.env.PUSH_NOTIFICATIONS_ENABLED;

  beforeAll(async () => {
    process.env.POSTGRESQL_URL = databaseUrl;
    process.env.PUSH_NOTIFICATIONS_ENABLED = 'true';
    ({ default: database } = await import('../utils/drizzle'));
    schema = await import('../drizzle/schema');
    ({ addReaction } = await import('../utils/dbMethods/reaction'));
    await database.insert(schema.users).values(
      userIds.map((id, index) => ({
        id,
        email: `reaction-avatar-${id}@example.test`,
        username: `reaction-avatar-${index}-${id}`,
        nickname: ['Owner', 'Alice', 'Bob'][index],
        avatar: index === 1 ? 'https://example.test/alice.png' : null,
      }))
    );
    await database.insert(schema.rotes).values({
      id: roteId,
      authorid: userIds[0],
      content: 'A note preview',
    });
  });

  afterAll(async () => {
    const { inArray } = await import('drizzle-orm');
    await database.delete(schema.users).where(inArray(schema.users.id, userIds));
    if (previousPushEnabled === undefined) delete process.env.PUSH_NOTIFICATIONS_ENABLED;
    else process.env.PUSH_NOTIFICATIONS_ENABLED = previousPushEnabled;
    const { closeDatabase } = await import('../utils/drizzle');
    await closeDatabase();
  });

  it('keeps a single sender snapshot, then removes attribution when another user joins', async () => {
    const { and, eq, sql } = await import('drizzle-orm');
    const matchingEvents = () =>
      database
        .select()
        .from(schema.pushEvents)
        .where(
          and(
            eq(schema.pushEvents.userid, userIds[0]),
            eq(schema.pushEvents.type, 'reaction.received'),
            sql`${schema.pushEvents.payload}->>'roteId' = ${roteId}`
          )
        );

    await addReaction({ type: '❤️', roteid: roteId, userid: userIds[1] });
    const [single] = await matchingEvents();
    const sender = {
      id: userIds[1],
      displayName: 'Alice',
      avatarURL: 'https://example.test/alice.png',
    };
    expect(prepareApnsPayload(single.payload).payload).toEqual({
      roteId,
      eventType: 'reaction.received',
      recipientId: userIds[0],
      sender,
    });

    await database
      .update(schema.users)
      .set({ nickname: 'Renamed', avatar: null })
      .where(eq(schema.users.id, userIds[1]));
    const [queued] = await matchingEvents();
    const serialized = JSON.parse(
      serializeApnsPayload({
        ...prepareApnsPayload(queued.payload),
        titleLocKey: queued.titleLocKey,
        bodyLocKey: queued.bodyLocKey,
        route: queued.route,
      })
    );
    expect(serialized.sender).toEqual(sender);
    expect(serialized.aps.alert['title-loc-args']).toEqual(['Alice']);
    expect(serialized.aps['mutable-content']).toBe(1);
    expect(serialized._push).toBeUndefined();

    await addReaction({ type: '👍', roteid: roteId, userid: userIds[2] });
    const mixed = await matchingEvents();
    expect(mixed).toHaveLength(1);
    expect(prepareApnsPayload(mixed[0].payload)).toEqual({
      payload: { roteId },
      titleLocArgs: ['Alice', '1'],
      bodyLocArgs: ['❤️ 👍', 'A note preview'],
    });
    const mixedSerialized = JSON.parse(
      serializeApnsPayload({
        ...prepareApnsPayload(mixed[0].payload),
        titleLocKey: mixed[0].titleLocKey,
        bodyLocKey: mixed[0].bodyLocKey,
        route: mixed[0].route,
      })
    );
    expect(mixedSerialized.sender).toBeUndefined();
    expect(mixedSerialized.aps['mutable-content']).toBeUndefined();
  });
});
