import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env.SYNC_TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;

databaseDescribe('committed sync journal', () => {
  const owners: string[] = [];
  let db: typeof import('../utils/drizzle').default;
  let schema: typeof import('../drizzle/schema');
  let journal: typeof import('./journal');
  let repository: typeof import('./repository');
  let actions: typeof import('../notes/actions');
  let operators: typeof import('drizzle-orm');

  beforeAll(async () => {
    process.env.POSTGRESQL_URL = databaseUrl;
    [{ default: db }, schema, journal, repository, actions, operators] = await Promise.all([
      import('../utils/drizzle'),
      import('../drizzle/schema'),
      import('./journal'),
      import('./repository'),
      import('../notes/actions'),
      import('drizzle-orm'),
    ]);
  });

  afterAll(async () => {
    if (owners.length) {
      await db
        .delete(schema.roteChanges)
        .where(operators.inArray(schema.roteChanges.userid, owners));
      await db.delete(schema.users).where(operators.inArray(schema.users.id, owners));
    }
    const { closeDatabase } = await import('../utils/drizzle');
    await closeDatabase();
  });

  async function makeOwner() {
    const id = randomUUID();
    owners.push(id);
    await db.insert(schema.users).values({ id, email: `${id}@example.test`, username: id });
    return id;
  }

  async function createNote(owner: string, content = 'sync test') {
    return actions.createUserNote(owner, { content });
  }

  it('rolls back data, change rows and the revision together', async () => {
    const owner = await makeOwner();
    const start = await repository.readSyncSnapshot(owner);
    const id = randomUUID();
    await expect(
      db.transaction(async (tx) => {
        await journal.lockSyncOwner(tx, owner);
        await tx.insert(schema.rotes).values({ id, authorid: owner, content: 'rolled back' });
        await journal.recordRoteChanges(tx, owner, [{ originid: id, action: 'CREATE' }]);
        throw new Error('abort');
      })
    ).rejects.toThrow('abort');
    expect(await repository.readSyncSnapshot(owner)).toEqual(start);
    expect((await repository.readSyncChanges(owner, start.cursor)).changes).toEqual([]);
    await createNote(owner);
    expect(
      (await repository.readSyncChanges(owner, start.cursor)).changes.map((c) => c.revision)
    ).toEqual(['1']);
  });

  it('never advances past an uncommitted earlier write', async () => {
    const owner = await makeOwner();
    const start = await repository.readSyncSnapshot(owner);
    const firstId = randomUUID();
    let release!: () => void;
    let ready!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const allocated = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const first = db.transaction(async (tx) => {
      await journal.lockSyncOwner(tx, owner);
      await tx.insert(schema.rotes).values({ id: firstId, authorid: owner, content: 'first' });
      await journal.recordRoteChanges(tx, owner, [{ originid: firstId, action: 'CREATE' }]);
      ready();
      await held;
    });
    await allocated;
    const second = createNote(owner, 'second');
    try {
      const during = await repository.readSyncSnapshot(owner);
      expect(during).toEqual(start);
      expect((await repository.readSyncChanges(owner, start.cursor)).changes).toEqual([]);
    } finally {
      release();
      await Promise.all([first, second]);
    }
    const page = await repository.readSyncChanges(owner, start.cursor);
    expect(page.changes.map((c) => c.revision)).toEqual(['1', '2']);
    expect(page.changes[0].originid).toBe(firstId);
  });

  it('fixes the pagination boundary while subsequent writes continue', async () => {
    const owner = await makeOwner();
    const start = await repository.readSyncSnapshot(owner);
    await createNote(owner);
    await createNote(owner);
    await createNote(owner);
    const first = await repository.readSyncChanges(owner, start.cursor, 1);
    expect(first.hasMore).toBe(true);
    const late = await createNote(owner, 'after boundary');
    const second = await repository.readSyncChanges(owner, first.nextCursor, 1);
    const third = await repository.readSyncChanges(owner, second.nextCursor, 1);
    expect([...first.changes, ...second.changes, ...third.changes].map((c) => c.revision)).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(third.hasMore).toBe(false);
    const next = await repository.readSyncChanges(owner, third.nextCursor, 1);
    expect(next.changes.map((c) => c.originid)).toEqual([late.id]);
  });

  it('keeps delete tombstones after the note foreign key is cleared', async () => {
    const owner = await makeOwner();
    const note = await createNote(owner);
    const start = await repository.readSyncSnapshot(owner);
    await actions.deleteUserNote(owner, note.id);
    const page = await repository.readSyncChanges(owner, start.cursor);
    expect(page.changes.map((c) => [c.action, c.originid])).toEqual([['DELETE', note.id]]);
    const [row] = await db
      .select()
      .from(schema.roteChanges)
      .where(operators.eq(schema.roteChanges.id, page.changes[0].id));
    expect(row.roteid).toBeNull();
    expect((await repository.readSyncSnapshot(owner)).noteIds).toEqual([]);
  });

  it('publishes article, reaction and attachment changes in the same journal', async () => {
    const owner = await makeOwner();
    const note = await createNote(owner);
    const start = await repository.readSyncSnapshot(owner);
    const articleMethods = await import('../utils/dbMethods/article');
    const reactionMethods = await import('../utils/dbMethods/reaction');
    const attachmentMethods = await import('../utils/dbMethods/attachment');
    const article = await articleMethods.createArticle({ authorId: owner, content: 'article' });
    await articleMethods.setNoteArticleId(note.id, article.id, owner);
    await articleMethods.updateArticle({
      id: article.id,
      authorId: owner,
      content: 'edited article',
    });
    await articleMethods.deleteArticle({ id: article.id, authorId: owner });
    await reactionMethods.addReaction({ roteid: note.id, userid: owner, type: '👍' });
    await reactionMethods.removeReaction({ roteid: note.id, userid: owner, type: '👍' });
    const attachmentId = randomUUID();
    await db.insert(schema.attachments).values({
      id: attachmentId,
      userid: owner,
      roteid: note.id,
      url: 'https://example.test/image.png',
      storage: 'R2',
      details: { mimetype: 'image/png' },
    });
    await attachmentMethods.updateAttachmentsSortOrder(owner, note.id, [attachmentId]);
    const page = await repository.readSyncChanges(owner, start.cursor);
    expect(page.changes.map((c) => c.action)).toEqual(Array(6).fill('UPDATE'));
    expect(new Set(page.changes.map((c) => c.originid))).toEqual(new Set([note.id]));
    await db.delete(schema.attachments).where(operators.eq(schema.attachments.id, attachmentId));
  });

  it('rejects future cursors and invalid page sizes, and isolates accounts', async () => {
    const owner = await makeOwner();
    const other = await makeOwner();
    const { encodeSyncCursor } = await import('./cursor');
    const start = await repository.readSyncSnapshot(owner);
    await createNote(other);
    expect((await repository.readSyncChanges(owner, start.cursor)).changes).toEqual([]);
    await expect(repository.readSyncChanges(owner, encodeSyncCursor(owner, 1n))).rejects.toThrow(
      'sync_cursor_ahead'
    );
    for (const limit of [0, 101, 1.5, NaN]) {
      await expect(repository.readSyncChanges(owner, start.cursor, limit)).rejects.toThrow(
        'invalid_sync_limit'
      );
    }
  });

  it('assigns fresh target-account revisions to merged notes', async () => {
    const source = await makeOwner();
    const target = await makeOwner();
    await createNote(target, 'target note');
    const incoming = await createNote(source, 'source note');
    const start = await repository.readSyncSnapshot(target);
    const { mergeUserAccounts } = await import('../utils/dbMethods/userAccount');
    await mergeUserAccounts(source, target);
    const page = await repository.readSyncChanges(target, start.cursor);
    expect(page.changes.map((c) => [c.originid, c.action, c.revision])).toEqual([
      [incoming.id, 'CREATE', '2'],
    ]);
    expect((await repository.readSyncSnapshot(target)).noteIds).toContain(incoming.id);
  });

  it('journals standalone attachment upserts without duplicate entries per batch', async () => {
    const owner = await makeOwner();
    const note = await createNote(owner);
    const start = await repository.readSyncSnapshot(owner);
    const { upsertAttachmentsByOriginalKey } = await import('../utils/dbMethods/attachment');
    const finalized = await upsertAttachmentsByOriginalKey(
      owner,
      note.id,
      [0, 1].map((index) => ({
        url: `https://example.test/${owner}/${index}.png`,
        details: { key: `users/${owner}/uploads/${index}.png`, mimetype: 'image/png' },
      }))
    );
    const page = await repository.readSyncChanges(owner, start.cursor);
    expect(page.changes.map((c) => [c.originid, c.action])).toEqual([[note.id, 'UPDATE']]);
    await db.delete(schema.attachments).where(
      operators.inArray(
        schema.attachments.id,
        finalized.map((a) => a.id)
      )
    );
  });

  it('serves authenticated JSON endpoints and rejects invalid cursor requests', async () => {
    const owner = await makeOwner();
    await db
      .insert(schema.settings)
      .values({
        group: 'security',
        config: {
          jwtSecret: 'sync-integration-test-only',
          jwtRefreshSecret: 'sync-refresh-test-only',
          jwtAccessExpiry: '5m',
        },
      })
      .onConflictDoUpdate({
        target: schema.settings.group,
        set: {
          config: {
            jwtSecret: 'sync-integration-test-only',
            jwtRefreshSecret: 'sync-refresh-test-only',
            jwtAccessExpiry: '5m',
          },
        },
      });
    const { configManager } = await import('../utils/config');
    await configManager.initialize();
    const { generateAccessToken } = await import('../utils/jwt');
    const { default: router } = await import('./routes');
    const headers = {
      Authorization: `Bearer ${await generateAccessToken({ userId: owner, username: owner })}`,
    };
    expect((await router.request('/snapshot')).status).toBe(401);
    const snapshotResponse = await router.request('/snapshot', { headers });
    expect(snapshotResponse.status).toBe(200);
    const snapshot = (await snapshotResponse.json()).data;
    expect(snapshot.noteIds).toEqual([]);
    const note = await createNote(owner);
    const response = await router.request(`/changes?cursor=${snapshot.cursor}`, { headers });
    expect(response.status).toBe(200);
    const page = (await response.json()).data;
    expect(
      page.changes.map((c: { originid: string; revision: string }) => [c.originid, c.revision])
    ).toEqual([[note.id, '1']]);
    expect(page.hasMore).toBe(false);
    expect((await router.request('/changes?cursor=bad', { headers })).status).toBe(400);
    expect(
      (await router.request(`/changes?cursor=${snapshot.cursor}&limit=101`, { headers })).status
    ).toBe(400);
    const { encodeSyncCursor } = await import('./cursor');
    expect(
      (await router.request(`/changes?cursor=${encodeSyncCursor(owner, 99n)}`, { headers })).status
    ).toBe(409);
    await db.delete(schema.settings).where(operators.eq(schema.settings.group, 'security'));
  });
});
