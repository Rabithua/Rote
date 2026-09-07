import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { HonoVariables } from '../types/hono';

const databaseUrl = process.env.NOTE_SHARES_TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;

databaseDescribe('anonymous note sharing against a migrated, isolated database', () => {
  let db: typeof import('../utils/drizzle').default;
  let schema: typeof import('../drizzle/schema');
  let eq: typeof import('drizzle-orm').eq;
  let app: Hono<{ Variables: HonoVariables }>;
  let ownerToken: string;
  let otherToken: string;
  const ownerId = randomUUID();
  const otherId = randomUUID();
  const allowedOpenKeyId = randomUUID();
  const deniedOpenKeyId = randomUUID();
  const otherOpenKeyId = randomUUID();
  const articleId = randomUUID();
  const noteId = randomUUID();
  const openKeyRequestCounts = new Map<string, number>();

  beforeAll(async () => {
    process.env.POSTGRESQL_URL = databaseUrl;
    ({ default: db } = await import('../utils/drizzle'));
    schema = await import('../drizzle/schema');
    ({ eq } = await import('drizzle-orm'));
    const { setConfig } = await import('../utils/config');
    expect(
      await setConfig('security', {
        jwtSecret: 'isolated-note-share-access-signing-key',
        jwtRefreshSecret: 'isolated-note-share-refresh-signing-key',
        jwtAccessExpiry: '1h',
        jwtRefreshExpiry: '1h',
        sessionSecret: 'isolated-test-session',
      })
    ).toBe(true);
    await db.insert(schema.users).values([
      {
        id: ownerId,
        username: `shares-${ownerId.slice(0, 8)}`,
        email: `${ownerId}@example.test`,
        nickname: 'Owner',
      },
      { id: otherId, username: `shares-${otherId.slice(0, 8)}`, email: `${otherId}@example.test` },
    ]);
    await db.insert(schema.userOpenKeys).values([
      { id: allowedOpenKeyId, userid: ownerId, permissions: ['SHAREROTE'] },
      { id: deniedOpenKeyId, userid: ownerId, permissions: ['GETROTE'] },
      { id: otherOpenKeyId, userid: otherId, permissions: ['SHAREROTE'] },
    ]);
    await db
      .insert(schema.articles)
      .values({ id: articleId, authorId: ownerId, content: '# Shared article' });
    await db.insert(schema.rotes).values({
      id: noteId,
      authorid: ownerId,
      content: 'Private original',
      state: 'private',
      archived: true,
      articleId,
      tags: ['family'],
    });
    await db.insert(schema.attachments).values({
      roteid: noteId,
      userid: ownerId,
      url: 'https://example.test/photo.heic',
      compressUrl: 'https://example.test/still.jpg',
      storage: 'secret-backend',
      details: {
        mimetype: 'image/heic',
        mediaKind: 'livePhoto',
        pairedVideoUrl: 'https://example.test/motion.mov',
        key: 'internal-key',
        bucket: 'secret-bucket',
        metadata: { secret: 'hidden' },
      },
    });
    await db.insert(schema.reactions).values({
      roteid: noteId,
      type: 'like',
      visitorId: 'hidden-visitor',
      visitorInfo: { ip: 'private-ip' },
    });
    const { generateAccessToken } = await import('../utils/jwt');
    ownerToken = await generateAccessToken({
      userId: ownerId,
      username: `shares-${ownerId.slice(0, 8)}`,
    });
    otherToken = await generateAccessToken({
      userId: otherId,
      username: `shares-${otherId.slice(0, 8)}`,
    });
    const { default: router } = await import('../route/v2');
    const { errorHandler } = await import('../utils/handlers');
    const { recorderIpAndTime } = await import('../middleware/recorder');
    app = new Hono<{ Variables: HonoVariables }>();
    app.use('*', recorderIpAndTime);
    app.route('/v2/api', router);
    app.onError(errorHandler);
  });

  afterAll(async () => {
    if (!db) return;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const logs = await db
        .select()
        .from(schema.openKeyUsageLogs)
        .where(eq(schema.openKeyUsageLogs.openKeyId, allowedOpenKeyId));
      const deniedLogs = await db
        .select()
        .from(schema.openKeyUsageLogs)
        .where(eq(schema.openKeyUsageLogs.openKeyId, deniedOpenKeyId));
      const otherLogs = await db
        .select()
        .from(schema.openKeyUsageLogs)
        .where(eq(schema.openKeyUsageLogs.openKeyId, otherOpenKeyId));
      const expectedLogCount = Array.from(openKeyRequestCounts.values()).reduce(
        (total, count) => total + count,
        0
      );
      if (logs.length + deniedLogs.length + otherLogs.length >= expectedLogCount) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await db.delete(schema.attachments).where(eq(schema.attachments.userid, ownerId));
    await db.delete(schema.users).where(eq(schema.users.id, ownerId));
    await db.delete(schema.users).where(eq(schema.users.id, otherId));
    const { closeDatabase } = await import('../utils/drizzle');
    await closeDatabase();
  });

  function manage(method: string, token = ownerToken, id = noteId) {
    return app.request(`/v2/api/notes/${id}/share`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }
  function manageOpenKey(key: string, method: string, id = noteId) {
    openKeyRequestCounts.set(key, (openKeyRequestCounts.get(key) ?? 0) + 1);
    return app.request(
      `/v2/api/openkey/notes/${encodeURIComponent(id)}/share?openkey=${encodeURIComponent(key)}`,
      { method }
    );
  }
  async function createShare(id = noteId) {
    const response = await manage('PUT', ownerToken, id);
    expect(response.status).toBe(200);
    return (await response.json()).data as { token: string; createdAt: string };
  }
  const read = (token: string) =>
    app.request(`/v2/api/shares/${token}`, {
      headers: { Authorization: 'Bearer expired-session' },
    });

  it('only lets the author manage a link, and opening settings creates nothing', async () => {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      expect((await manage(method, '')).status).toBe(401);
      expect((await manage(method, otherToken)).status).toBe(404);
      expect((await manage(method, ownerToken, randomUUID())).status).toBe(404);
    }
    const response = await manage('GET');
    expect((await response.json()).data).toBeNull();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(
      await db.select().from(schema.noteShareLinks).where(eq(schema.noteShareLinks.noteId, noteId))
    ).toHaveLength(0);
  });

  it('requires SHAREROTE and applies author-only not-found behavior', async () => {
    const denied = await manageOpenKey(deniedOpenKeyId, 'PUT');
    expect(denied.status).toBe(403);
    expect(denied.headers.get('Cache-Control')).toBe('no-store');
    expect(
      await db.select().from(schema.noteShareLinks).where(eq(schema.noteShareLinks.noteId, noteId))
    ).toHaveLength(0);

    expect((await manageOpenKey(allowedOpenKeyId, 'GET', 'invalid-id')).status).toBe(404);
    expect((await manageOpenKey(otherOpenKeyId, 'PUT')).status).toBe(404);
  });

  it('manages private archived-note links through OpenKey without logging tokens', async () => {
    const initial = await manageOpenKey(allowedOpenKeyId, 'GET');
    expect(initial.status).toBe(200);
    expect((await initial.json()).data).toBeNull();
    expect(initial.headers.get('Cache-Control')).toBe('no-store');

    const firstResponse = await manageOpenKey(allowedOpenKeyId, 'PUT');
    const first = (await firstResponse.json()).data as { token: string; createdAt: string };
    const second = (await (await manageOpenKey(allowedOpenKeyId, 'PUT')).json()).data as {
      token: string;
    };
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second.token).toBe(first.token);
    expect((await read(first.token)).status).toBe(200);

    expect((await manageOpenKey(allowedOpenKeyId, 'DELETE')).status).toBe(200);
    expect((await manageOpenKey(allowedOpenKeyId, 'DELETE')).status).toBe(200);
    expect((await read(first.token)).status).toBe(404);
    const recreated = (await (await manageOpenKey(allowedOpenKeyId, 'PUT')).json()).data as {
      token: string;
    };
    expect(recreated.token).not.toBe(first.token);

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const logs = await db
        .select()
        .from(schema.openKeyUsageLogs)
        .where(eq(schema.openKeyUsageLogs.openKeyId, allowedOpenKeyId));
      if (logs.length >= (openKeyRequestCounts.get(allowedOpenKeyId) ?? 0)) {
        expect(JSON.stringify(logs)).not.toContain(first.token);
        expect(JSON.stringify(logs)).not.toContain(recreated.token);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('OpenKey share usage logs were not persisted');
  });

  it('serializes concurrent creation and keeps private state and normal APIs private', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => createShare()));
    expect(new Set(results.map((share) => share.token)).size).toBe(1);
    expect(results[0].token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(
      await db.select().from(schema.noteShareLinks).where(eq(schema.noteShareLinks.noteId, noteId))
    ).toHaveLength(1);
    const [note] = await db.select().from(schema.rotes).where(eq(schema.rotes.id, noteId));
    expect(note.state).toBe('private');
    const normal = await app.request(`/v2/api/notes/${noteId}`);
    expect(normal.status).not.toBe(200);
    expect((await normal.text()).includes('Private original')).toBe(false);
    expect((await app.request(`/v2/api/articles/${articleId}`)).status).not.toBe(200);
    const batch = await app.request('/v2/api/notes/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [noteId] }),
    });
    expect((await batch.json()).data).toEqual([]);
    const owned = await app.request(`/v2/api/notes/${noteId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(await owned.text()).not.toContain(results[0].token);
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const response = await app.request(`/v2/api/notes/${noteId}`, {
        method,
        headers: { Authorization: `Bearer ${results[0].token}` },
      });
      expect(response.status).not.toBe(200);
      expect(await response.text()).not.toContain('Private original');
    }
  });

  it('serves a minimal live view without account, reaction or storage metadata', async () => {
    const share = await createShare();
    const response = await read(share.token);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
    const { data } = await response.json();
    expect(data.content).toBe('Private original');
    expect(data.article.content).toBe('# Shared article');
    expect(data.attachments[0].details).toEqual({
      mediaKind: 'livePhoto',
      mimetype: 'image/heic',
      pairedVideoUrl: 'https://example.test/motion.mov',
    });
    expect(Object.keys(data).sort()).toEqual([
      'article',
      'attachments',
      'author',
      'content',
      'createdAt',
      'linkPreviews',
      'tags',
      'title',
      'updatedAt',
    ]);
    const serialized = JSON.stringify(data);
    for (const value of [
      ownerId,
      otherId,
      noteId,
      articleId,
      share.token,
      'private-ip',
      'secret-backend',
      'secret-bucket',
      'internal-key',
      '@example.test',
    ])
      expect(serialized).not.toContain(value);

    await db
      .update(schema.rotes)
      .set({ content: 'Edited later', archived: true, state: 'public' })
      .where(eq(schema.rotes.id, noteId));
    await db
      .update(schema.articles)
      .set({ content: '# Edited article' })
      .where(eq(schema.articles.id, articleId));
    const updated = (await (await read(share.token)).json()).data;
    expect(updated.content).toBe('Edited later');
    expect(updated.article.content).toBe('# Edited article');
    await db.update(schema.rotes).set({ state: 'private' }).where(eq(schema.rotes.id, noteId));
    expect((await read(share.token)).status).toBe(200);
    await db.update(schema.rotes).set({ articleId: null }).where(eq(schema.rotes.id, noteId));
    expect((await (await read(share.token)).json()).data.article).toBeNull();
  });

  it('revokes immediately, regenerates a different link, and cascades on note deletion', async () => {
    const previous = await createShare();
    expect((await manage('DELETE')).status).toBe(200);
    expect((await manage('DELETE')).status).toBe(200);
    for (const token of [previous.token, 'invalid', 'a'.repeat(43)]) {
      const response = await read(token);
      expect(response.status).toBe(404);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect((await response.json()).message).toBe('share_not_found');
    }
    const current = await createShare();
    expect(current.token).not.toBe(previous.token);
    expect((await read(current.token)).status).toBe(200);
    const anotherId = randomUUID();
    await db
      .insert(schema.rotes)
      .values({ id: anotherId, authorid: ownerId, content: 'To delete' });
    const another = await createShare(anotherId);
    await db.delete(schema.rotes).where(eq(schema.rotes.id, anotherId));
    expect((await read(another.token)).status).toBe(404);
  });

  it('orders concurrent revocation/creation and leaves no link after a final revoke', async () => {
    await Promise.all(
      Array.from({ length: 8 }, (_, index) => manage(index % 2 ? 'PUT' : 'DELETE'))
    );
    await manage('DELETE');
    expect((await (await manage('GET')).json()).data).toBeNull();
  });

  it('redacts bearer paths and does not change unrelated route headers', async () => {
    const share = await createShare();
    const messages: string[] = [];
    const log = spyOn(console, 'log').mockImplementation((...args) => {
      messages.push(args.join(' '));
    });
    try {
      await read(share.token);
    } finally {
      log.mockRestore();
    }
    expect(messages.join('\n')).toContain('/v2/api/shares/:token');
    expect(messages.join('\n')).not.toContain(share.token);
    expect((await app.request('/v2/api/health')).headers.get('Cache-Control')).toBeNull();
    expect((await app.request(`/v2/api/shares/${share.token}`, { method: 'PUT' })).status).toBe(
      404
    );
  });

  it('keeps query parameters out of unexpected error logs and responses', async () => {
    const share = await createShare();
    const query = spyOn(db.query.rotes, 'findFirst').mockRejectedValueOnce(
      new Error(`database query failed with parameter ${share.token}`)
    );
    const messages: string[] = [];
    const stderr = spyOn(process.stderr, 'write').mockImplementation((message) => {
      messages.push(String(message));
      return true;
    });
    try {
      const response = await read(share.token);
      expect(response.status).toBe(500);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(await response.text()).not.toContain(share.token);
      expect(messages.join('\n')).toContain('note_share_request_failed');
      expect(messages.join('\n')).not.toContain(share.token);
    } finally {
      query.mockRestore();
      stderr.mockRestore();
    }
  });
});
