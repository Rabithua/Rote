import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { Hono } from 'hono';
import type { HonoVariables } from '../types/hono';
import fixture from './fixtures/rich-history.json';
import type { AiConversation } from './types';

const databaseUrl = process.env.AI_CONVERSATIONS_TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;

databaseDescribe('AI conversation HTTP contract with actual JWT and PostgreSQL', () => {
  const ownerId = randomUUID();
  const otherOwnerId = randomUUID();
  let app: Hono<{ Variables: HonoVariables }>;
  let database: typeof import('../utils/drizzle').default;
  let schema: typeof import('../drizzle/schema');
  let operators: typeof import('drizzle-orm');
  let authorization: string;
  let otherAuthorization: string;
  const transcriptId = `http-${randomUUID()}`;
  const write = {
    baseRevision: null,
    createdAt: fixture.createdAt,
    agentConversationId: fixture.agentConversationId,
    messages: fixture.messages,
  };

  beforeAll(async () => {
    if (!databaseUrl || new URL(databaseUrl).pathname !== '/rote_ai_conversation_test') {
      throw new Error('Use the isolated rote_ai_conversation_test database');
    }
    process.env.POSTGRESQL_URL = databaseUrl;
    const [hono, routes, config, jwt, importedSchema, importedOperators, db] = await Promise.all([
      import('hono'),
      import('./routes'),
      import('../utils/config'),
      import('../utils/jwt'),
      import('../drizzle/schema'),
      import('drizzle-orm'),
      import('../utils/drizzle'),
    ]);
    database = db.default;
    schema = importedSchema;
    operators = importedOperators;
    await database.insert(schema.users).values(
      [ownerId, otherOwnerId].map((id) => ({
        id,
        email: `conversation-http-${id}@example.test`,
        username: `conversation-http-${id}`,
        emailVerified: false,
      }))
    );
    await config.setConfig('security', {
      jwtSecret: 'conversation-http-isolated-test-secret',
      jwtRefreshSecret: 'conversation-http-isolated-refresh-secret',
      jwtAccessExpiry: '1h',
      jwtRefreshExpiry: '1h',
      sessionSecret: 'conversation-http-isolated-session-secret',
    });
    await config.initializeConfig();
    authorization = `Bearer ${await jwt.generateAccessToken({ userId: ownerId, username: 'owner' })}`;
    otherAuthorization = `Bearer ${await jwt.generateAccessToken({ userId: otherOwnerId, username: 'other' })}`;
    app = new hono.Hono<{ Variables: HonoVariables }>();
    app.route('/v2/api/ai/conversations', routes.default);
  });

  afterAll(async () => {
    if (database) {
      await database
        .delete(schema.users)
        .where(operators.inArray(schema.users.id, [ownerId, otherOwnerId]));
      const { closeDatabase } = await import('../utils/drizzle');
      await closeDatabase();
    }
  });

  function request(path = '', init: RequestInit = {}, token = authorization) {
    return app.request(`/v2/api/ai/conversations${path}`, {
      ...init,
      headers: { authorization: token, 'content-type': 'application/json', ...init.headers },
    });
  }

  async function save(id: string, body: unknown = write, token = authorization) {
    return request(
      `/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(body) },
      token
    );
  }

  it('requires current valid JWT for every operation', async () => {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      for (const token of ['', 'Bearer invalid-token']) {
        const response = await request('/private?baseRevision=1', { method }, token);
        expect(response.status).toBe(401);
      }
    }
  });

  it('stores and reads the rich fixture without AI setup or a verified email', async () => {
    const response = await save(transcriptId);
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: { conversation: AiConversation } };
    expect(data.conversation.messages).toEqual(fixture.messages);
    expect(data.conversation).toMatchObject({
      id: transcriptId,
      revision: 1,
      createdAt: fixture.createdAt,
      agentConversationId: fixture.agentConversationId,
      deletedAt: null,
    });
    const read = await request(`/${transcriptId}`);
    expect((await read.json()).data.conversation).toEqual(data.conversation);
    const listing = await request('?limit=20');
    expect((await listing.json()).data).toEqual({
      conversations: [data.conversation],
      nextCursor: null,
    });
  });

  it('cannot read, mutate or delete another owner through IDs or metadata', async () => {
    expect((await request(`/${transcriptId}`, {}, otherAuthorization)).status).toBe(404);
    expect(
      (await save(transcriptId, { ...write, baseRevision: 1 }, otherAuthorization)).status
    ).toBe(404);
    expect(
      (await request(`/${transcriptId}?baseRevision=1`, { method: 'DELETE' }, otherAuthorization))
        .status
    ).toBe(404);
    expect((await request('', {}, otherAuthorization)).status).toBe(200);
    const listing = await request('', {}, otherAuthorization);
    expect((await listing.json()).data.conversations).toEqual([]);
    const [{ owner }] = await database
      .select({ owner: schema.aiConversations.ownerId })
      .from(schema.aiConversations)
      .where(operators.eq(schema.aiConversations.id, transcriptId));
    expect(owner).toBe(ownerId);
  });

  it('returns current history on conflicts and keeps tombstones after late saves/imports', async () => {
    const conflict = await save(transcriptId);
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).data.conversation.revision).toBe(1);
    const changed = { ...write, baseRevision: 1, messages: fixture.messages.slice(0, 2) };
    const saved = await save(transcriptId, changed);
    expect(saved.status).toBe(200);
    expect((await saved.json()).data.conversation.revision).toBe(2);
    expect((await save(transcriptId, { ...write, baseRevision: 1 })).status).toBe(409);
    expect((await request(`/${transcriptId}?baseRevision=1`, { method: 'DELETE' })).status).toBe(
      409
    );
    const deleted = await request(`/${transcriptId}?baseRevision=2`, { method: 'DELETE' });
    expect(deleted.status).toBe(200);
    const tombstone = (await deleted.json()).data.conversation;
    expect(tombstone.messages).toEqual([]);
    expect(tombstone.agentConversationId).toBeUndefined();
    expect(tombstone.deletedAt).toBeString();
    expect((await save(transcriptId, { ...write, baseRevision: 2 })).status).toBe(409);
    expect((await save(transcriptId)).status).toBe(409);
    const repeat = await request(`/${transcriptId}?baseRevision=1`, { method: 'DELETE' });
    expect((await repeat.json()).data.conversation).toEqual(tombstone);
    const listing = await request();
    expect((await listing.json()).data.conversations).toEqual([tombstone]);
  });

  it('rejects malformed dates, roles, duplicate IDs and transient stream state before mutation', async () => {
    const message = fixture.messages[0];
    for (const messages of [
      [{ ...message, role: 'system' }],
      [{ ...message, createdAt: '2026-02-30T04:00:00.000Z' }],
      [message, message],
      [{ ...message, isStreaming: true }],
    ]) {
      expect((await save('invalid-snapshot', { ...write, messages })).status).toBe(400);
    }
    expect((await save('invalid-snapshot', { ...write, createdAt: 'not-a-date' })).status).toBe(
      400
    );
    expect((await request('/invalid-snapshot')).status).toBe(404);
  });

  it('validates pagination, deletion revisions and generous request bounds', async () => {
    for (const query of ['?limit=51', '?limit=0', '?limit=no', '?cursor=invalid']) {
      expect((await request(query)).status).toBe(400);
    }
    for (const revision of ['', 'null', '0', '-1', '1.5', '9007199254740992']) {
      expect(
        (await request(`/${transcriptId}?baseRevision=${revision}`, { method: 'DELETE' })).status
      ).toBe(400);
    }
    expect(
      (
        await save('too-large', {
          ...write,
          messages: [{ ...fixture.messages[0], content: 'a'.repeat(8 * 1024 * 1024) }],
        })
      ).status
    ).toBe(413);
  });
});
