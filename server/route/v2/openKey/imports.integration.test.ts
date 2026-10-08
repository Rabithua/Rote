import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { Hono } from 'hono';
import type { HonoVariables } from '../../../types/hono';

const databaseUrl = process.env.OPENKEY_IMPORT_TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration('OpenKey formal imports with PostgreSQL', () => {
  const userId = randomUUID();
  const otherUserId = randomUUID();
  const keyId = randomUUID();
  const externalId = randomUUID();
  let app: Hono<{ Variables: HonoVariables }>;
  let database: typeof import('../../../utils/drizzle').default;
  let schema: typeof import('../../../drizzle/schema');
  let eq: typeof import('drizzle-orm').eq;
  const note = {
    id: randomUUID(),
    title: 'Historical title',
    content: 'Historical content',
    createdAt: '2020-01-01T00:00:00.000Z',
    state: 'public',
    source: { provider: 'dinox', accountId: randomUUID(), externalId },
  };
  let targetId: string;

  async function post(path: string, body: unknown) {
    return app.request(`http://localhost/v2/api/openkey${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${keyId}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  async function permissions(values: string[]) {
    await database
      .update(schema.userOpenKeys)
      .set({ permissions: values })
      .where(eq(schema.userOpenKeys.id, keyId));
  }
  beforeAll(async () => {
    process.env.POSTGRESQL_URL = databaseUrl;
    const [
      { Hono },
      { default: router },
      { default: attachmentsRouter },
      handlers,
      importedSchema,
      operators,
      db,
      config,
    ] = await Promise.all([
      import('hono'),
      import('../openKeyRouter'),
      import('../openKeyAttachment'),
      import('../../../utils/handlers'),
      import('../../../drizzle/schema'),
      import('drizzle-orm'),
      import('../../../utils/drizzle'),
      import('../../../utils/config'),
    ]);
    schema = importedSchema;
    eq = operators.eq;
    database = db.default;
    await database.insert(schema.users).values(
      [userId, otherUserId].map((id) => ({
        id,
        username: `direct-import-${id}`,
        email: `direct-import-${id}@example.test`,
      }))
    );
    await database.insert(schema.userOpenKeys).values({
      id: keyId,
      userid: userId,
      permissions: ['GETROTE', 'SENDROTE', 'UPLOADATTACHMENT'],
    });
    await config.initializeConfig();
    app = new Hono<{ Variables: HonoVariables }>();
    app.route('/v2/api/openkey', attachmentsRouter);
    app.route('/v2/api/openkey', router);
    app.onError(handlers.errorHandler);
  });
  afterAll(async () => {
    const { inArray } = await import('drizzle-orm');
    await database.delete(schema.users).where(inArray(schema.users.id, [userId, otherUserId]));
    const { closeDatabase } = await import('../../../utils/drizzle');
    await closeDatabase();
  });
  test('permissions preserves the existing contract and adds import capabilities without requiring profile edit', async () => {
    const connection = await app.request('http://localhost/v2/api/openkey/permissions', {
      headers: { Authorization: `Bearer ${keyId}` },
    });
    expect(connection.status).toBe(200);
    expect(connection.headers.get('Cache-Control')).toBe('no-store');
    expect(await connection.json()).toMatchObject({
      data: {
        permissions: ['GETROTE', 'SENDROTE', 'UPLOADATTACHMENT'],
        ownerId: userId,
        owner: { id: userId },
        protocolVersion: 1,
        capabilities: {
          noteCreateIdempotency: 1,
          formalImport: 2,
          batchSize: 50,
          cleanupUnbound: true,
        },
      },
    });
    expect((await post('/imports/connect', {})).status).toBe(404);
    await permissions(['SENDROTE']);
    const limited = await app.request('http://localhost/v2/api/openkey/permissions', {
      headers: { Authorization: `Bearer ${keyId}` },
    });
    expect(limited.status).toBe(200);
    const limitedBody = await limited.json();
    expect(limitedBody).toMatchObject({
      data: {
        ownerId: userId,
        permissions: ['SENDROTE'],
        capabilities: { formalImport: 2, attachments: false, video: false },
      },
    });
    expect(limitedBody.data.capabilities).not.toHaveProperty('noteCreateIdempotency');
    expect((await post('/imports/plan', { notes: [note] })).status).toBe(403);
    expect((await post('/imports', { notes: [note] })).status).toBe(403);
    await permissions(['GETROTE']);
    const readOnly = await app.request('http://localhost/v2/api/openkey/permissions', {
      headers: { Authorization: `Bearer ${keyId}` },
    });
    expect(readOnly.status).toBe(200);
    expect(await readOnly.json()).toMatchObject({
      data: {
        ownerId: userId,
        permissions: ['GETROTE'],
        capabilities: { noteCreateIdempotency: 1 },
      },
    });
    expect((await post('/imports', { notes: [note] })).status).toBe(403);
    await permissions(['GETROTE', 'SENDROTE', 'UPLOADATTACHMENT']);
  });
  test('commit enforces video permission and effective account capabilities including stored attachment metadata', async () => {
    const id = randomUUID();
    const attachment = {
      id,
      url: `https://fixture.test/${id}.mp4`,
      storage: 'REMOTE',
      details: { mimetype: 'video/mp4', mediaKind: 'video', size: 100 },
    };
    const incoming = {
      ...note,
      source: { ...note.source, externalId: randomUUID() },
      attachments: [attachment],
    };
    expect((await post('/imports', { notes: [incoming] })).status).toBe(403);
    await database
      .insert(schema.attachments)
      .values({ ...attachment, userid: userId, roteid: null });
    const disguised = {
      ...incoming,
      attachments: [{ ...attachment, details: { mimetype: 'image/png' } }],
    };
    expect((await post('/imports', { notes: [disguised] })).status).toBe(403);
    await permissions(['GETROTE', 'SENDROTE', 'UPLOADATTACHMENT', 'UPLOADVIDEO']);
    const denied = await post('/imports', { notes: [incoming] });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({
      message: 'capability_required:attachment.video.upload',
    });
    await database
      .insert(schema.userPermissionOverrides)
      .values({ userid: userId, permission: 'attachment.video.upload', effect: 'allow' });
    expect((await post('/imports', { notes: [incoming] })).status).toBe(200);
    await database
      .update(schema.userPermissionOverrides)
      .set({ effect: 'deny' })
      .where(eq(schema.userPermissionOverrides.userid, userId));
    const revoked = await post('/imports', {
      notes: [{ ...disguised, source: { ...note.source, externalId: randomUUID() } }],
    });
    expect(revoked.status).toBe(403);
    await database
      .insert(schema.userPermissionOverrides)
      .values({ userid: userId, permission: 'attachment.upload', effect: 'deny' });
    const image = {
      ...note,
      source: { ...note.source, externalId: randomUUID() },
      attachments: [
        {
          url: 'https://fixture.test/image.png',
          storage: 'REMOTE',
          details: { mimetype: 'image/png' },
        },
      ],
    };
    const blockedImage = await post('/imports', { notes: [image] });
    expect(blockedImage.status).toBe(403);
    expect(await blockedImage.json()).toMatchObject({
      message: 'capability_required:attachment.upload',
    });
    await database
      .delete(schema.userPermissionOverrides)
      .where(eq(schema.userPermissionOverrides.userid, userId));
    await permissions(['GETROTE', 'SENDROTE', 'UPLOADATTACHMENT']);
  });
  test('formal plan and import keep historical creation, privacy and stable source mapping', async () => {
    expect(
      await (await post('/imports/plan', { formatVersion: 2, notes: [note] })).json()
    ).toMatchObject({ data: { noteIndexes: [0] } });
    const imported = await post('/imports', { formatVersion: 2, notes: [note] });
    expect(imported.status).toBe(200);
    const result = (await imported.json()) as {
      data: { results: Array<{ id: string; status: string; index: number }> };
    };
    expect(result.data.results[0].status).toBe('created');
    targetId = result.data.results[0].id;
    const [stored] = await database
      .select()
      .from(schema.rotes)
      .where(eq(schema.rotes.id, targetId));
    expect(stored.createdAt.toISOString()).toBe(note.createdAt);
    expect(stored.state).toBe('private');
    expect(
      await (await post('/imports/plan', { notes: [{ ...note, id: randomUUID() }] })).json()
    ).toMatchObject({ data: { noteIndexes: [] } });
    expect(await (await post('/imports', { notes: [note] })).json()).toMatchObject({
      data: { unchanged: 1, results: [{ index: 0, status: 'skipped', id: targetId }] },
    });
  });
  test('overwrite requires explicit EDITROTE and the 50 record boundary is enforced', async () => {
    const payload = {
      notes: [{ ...note, content: 'Updated' }],
      importOptions: { existingStrategy: 'overwrite' },
    };
    expect((await post('/imports/plan', payload)).status).toBe(403);
    expect((await post('/imports', payload)).status).toBe(403);
    await permissions(['GETROTE', 'SENDROTE', 'EDITROTE', 'UPLOADATTACHMENT']);
    expect(await (await post('/imports', payload)).json()).toMatchObject({
      data: { updated: 1, results: [{ index: 0, id: targetId, status: 'updated' }] },
    });
    const notes = Array.from({ length: 51 }, () => ({
      ...note,
      source: { ...note.source, externalId: randomUUID() },
    }));
    expect((await post('/imports', { notes })).status).toBe(422);
  });
  test('binds current-owner unbound attachments in order and cleanup protects bound/foreign resources', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    await database.insert(schema.attachments).values(
      ids.map((id, index) => ({
        id,
        userid: index === 3 ? otherUserId : userId,
        roteid: null,
        url: `https://fixture.test/${id}.png`,
        compressUrl: `https://fixture.test/${id}.webp`,
        storage: 'REMOTE',
        details: { size: 100, mimetype: 'image/png' },
        sortIndex: 0,
      }))
    );
    const incoming = {
      ...note,
      source: { ...note.source, externalId: randomUUID() },
      attachments: ids.slice(0, 2).map((id, sortIndex) => ({
        id,
        url: 'caller-value-is-canonicalized',
        storage: 'REMOTE',
        details: { mimetype: 'image/png' },
        sortIndex,
      })),
    };
    expect((await post('/imports', { notes: [incoming] })).status).toBe(200);
    const bound = await database
      .select()
      .from(schema.attachments)
      .where(eq(schema.attachments.id, ids[1]));
    expect(bound[0].roteid).not.toBeNull();
    expect(bound[0].sortIndex).toBe(1);
    expect(bound[0].url).toBe(`https://fixture.test/${ids[1]}.png`);
    const cleaned = await post('/imports/attachments/cleanup', { ids });
    expect(await cleaned.json()).toMatchObject({ data: { deleted: 1 } });
    expect(
      await database.select().from(schema.attachments).where(eq(schema.attachments.id, ids[3]))
    ).toHaveLength(1);
    expect(
      await database.select().from(schema.attachments).where(eq(schema.attachments.id, ids[0]))
    ).toHaveLength(1);
  });
  test('cleans unknown ids after a lost finalize response through the completed reservation', async () => {
    const id = randomUUID();
    const reservationId = randomUUID();
    await database.insert(schema.attachments).values({
      id,
      userid: userId,
      roteid: null,
      url: `https://fixture.test/${id}.png`,
      storage: 'REMOTE',
      details: { mimetype: 'image/png', size: 100 },
    });
    await database.insert(schema.resourceUploadReservations).values({
      id: reservationId,
      userId,
      manifest: [],
      reservedBytes: BigInt(0),
      status: 'completed',
      result: [{ id }],
      expiresAt: new Date(Date.now() + 60000),
    });
    const cleanup = await app.request(
      `http://localhost/v2/api/openkey/imports/reservations/${reservationId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${keyId}` },
      }
    );
    expect(cleanup.status).toBe(200);
    expect(
      await database.select().from(schema.attachments).where(eq(schema.attachments.id, id))
    ).toHaveLength(0);
  });
  test('duplicate import cleanup preserves avatar and cover while deleting ordinary unbound attachments', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const rows = ids.map((id) => ({
      id,
      userid: userId,
      roteid: null,
      url: `https://fixture.test/${id}.png`,
      compressUrl: `https://fixture.test/${id}.webp`,
      storage: 'REMOTE',
      details: { mimetype: 'image/png', size: 100 },
    }));
    await database.insert(schema.attachments).values(rows);
    await database
      .update(schema.users)
      .set({ avatar: rows[0].url, cover: rows[1].compressUrl })
      .where(eq(schema.users.id, userId));
    const duplicate = await post('/imports', { notes: [{ ...note, attachments: rows }] });
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toMatchObject({
      data: { unchanged: 1, attachments: { deleted: 1 } },
    });
    for (const id of ids.slice(0, 2)) {
      expect(
        await database.select().from(schema.attachments).where(eq(schema.attachments.id, id))
      ).toHaveLength(1);
    }
    expect(
      await database.select().from(schema.attachments).where(eq(schema.attachments.id, ids[2]))
    ).toHaveLength(0);
    await database
      .update(schema.users)
      .set({ avatar: null, cover: null })
      .where(eq(schema.users.id, userId));
  });
});
