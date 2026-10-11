import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { Hono } from 'hono';
import type { HonoVariables } from '../types/hono';

const databaseUrl = process.env.SYNC_TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;
const signingKey = 'note-content-isolated-test-only';

databaseDescribe('synchronized note content', () => {
  const owners: string[] = [];
  let db: typeof import('../utils/drizzle').default;
  let schema: typeof import('../drizzle/schema');
  let operators: typeof import('drizzle-orm');
  let actions: typeof import('../notes/actions');
  let previews: typeof import('../utils/dbMethods/linkPreview');
  let repository: typeof import('./repository');
  let app: Hono<{ Variables: HonoVariables }>;

  beforeAll(async () => {
    process.env.POSTGRESQL_URL = databaseUrl;
    [{ default: db }, schema, operators, actions, previews, repository] = await Promise.all([
      import('../utils/drizzle'),
      import('../drizzle/schema'),
      import('drizzle-orm'),
      import('../notes/actions'),
      import('../utils/dbMethods/linkPreview'),
      import('./repository'),
    ]);
    await db
      .insert(schema.settings)
      .values({
        group: 'security',
        config: { jwtSecret: signingKey, jwtRefreshSecret: signingKey, jwtAccessExpiry: '5m' },
      })
      .onConflictDoUpdate({
        target: schema.settings.group,
        set: {
          config: { jwtSecret: signingKey, jwtRefreshSecret: signingKey, jwtAccessExpiry: '5m' },
        },
      });
    const { configManager } = await import('../utils/config');
    await configManager.initialize();
    const [{ Hono }, { default: notesRouter }, { default: syncRouter }] = await Promise.all([
      import('hono'),
      import('../route/v2/note'),
      import('./routes'),
    ]);
    app = new Hono<{ Variables: HonoVariables }>();
    app.route('/notes', notesRouter);
    app.route('/sync', syncRouter);
  });

  afterAll(async () => {
    if (owners.length) {
      await db
        .delete(schema.roteChanges)
        .where(operators.inArray(schema.roteChanges.userid, owners));
      await db.delete(schema.users).where(operators.inArray(schema.users.id, owners));
    }
    await db.delete(schema.settings).where(operators.eq(schema.settings.group, 'security'));
    const { closeDatabase } = await import('../utils/drizzle');
    await closeDatabase();
  });

  async function makeOwner() {
    const id = randomUUID();
    owners.push(id);
    await db.insert(schema.users).values({ id, email: `${id}@example.test`, username: id });
    return id;
  }

  async function token(owner: string, expiration = '5m') {
    const { SignJWT } = await import('jose');
    return new SignJWT({ userId: owner, username: owner })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('rote-app')
      .setExpirationTime(expiration)
      .sign(new TextEncoder().encode(signingKey));
  }

  function batch(ids: string[], accessToken?: string) {
    return app.request('/notes/batch', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(accessToken !== undefined ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ ids }),
    });
  }

  it('returns 401 when authentication expires between the change feed and note bodies', async () => {
    const owner = await makeOwner();
    const checkpoint = await repository.readSyncSnapshot(owner);
    const note = await actions.createUserNote(owner, {
      content: 'private update',
      state: 'private',
    });
    const authorization = `Bearer ${await token(owner)}`;
    const readPage = () =>
      app.request(`/sync/changes?cursor=${checkpoint.cursor}`, {
        headers: { authorization },
      });
    const page = (await (await readPage()).json()).data;
    expect(page.changes.map((change: { originid: string }) => change.originid)).toEqual([note.id]);
    const failed = await batch([note.id], await token(owner, '0s'));
    expect(failed.status).toBe(401);
    expect(await failed.json()).toMatchObject({ code: 401 });
    // Retrying the old checkpoint still returns the missed note after credentials recover.
    expect((await (await readPage()).json()).data).toEqual(page);
    const recovered = await batch([note.id], await token(owner));
    expect(recovered.status).toBe(200);
    expect((await recovered.json()).data.map((item: { id: string }) => item.id)).toEqual([note.id]);
  });

  it('preserves anonymous public reads and authenticated owner/foreign-note filtering', async () => {
    const owner = await makeOwner();
    const other = await makeOwner();
    const privateNote = await actions.createUserNote(owner, {
      content: 'private',
      state: 'private',
    });
    const publicNote = await actions.createUserNote(owner, { content: 'public', state: 'public' });
    const ids = [privateNote.id, publicNote.id];
    for (const credentials of [undefined, await token(other)]) {
      const response = await batch(ids, credentials);
      expect(response.status).toBe(200);
      expect((await response.json()).data.map((note: { id: string }) => note.id)).toEqual([
        publicNote.id,
      ]);
    }
    const response = await batch(ids, await token(owner));
    expect((await response.json()).data.map((note: { id: string }) => note.id)).toEqual(ids);
    for (const credentials of [await token(owner, '0s'), 'invalid-token', '']) {
      expect((await batch(ids, credentials)).status).toBe(401);
    }
  });

  it('publishes preview creation, replacement and removal at unchanged note content', async () => {
    const owner = await makeOwner();
    const note = await actions.createUserNote(owner, { content: 'preview source' });
    const start = await repository.readSyncSnapshot(owner);
    const url = 'https://example.test/article';
    await previews.upsertRoteLinkPreview({ roteid: note.id, url, title: 'first' }, note.content);
    const first = await repository.readSyncChanges(owner, start.cursor);
    expect(first.changes.map((change) => [change.originid, change.action])).toEqual([
      [note.id, 'UPDATE'],
    ]);
    let body = (await (await batch([note.id], await token(owner))).json()).data[0];
    expect(body.content).toBe(note.content);
    expect(body.linkPreviews.map((preview: { title: string }) => preview.title)).toEqual(['first']);
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(note.updatedAt.getTime());
    await previews.upsertRoteLinkPreview(
      { roteid: note.id, url, title: 'replacement' },
      note.content
    );
    const second = await repository.readSyncChanges(owner, first.nextCursor);
    expect(second.changes).toHaveLength(1);
    body = (await (await batch([note.id], await token(owner))).json()).data[0];
    expect(body.linkPreviews.map((preview: { title: string }) => preview.title)).toEqual([
      'replacement',
    ]);
    await previews.deleteRoteLinkPreviewsByRoteId(note.id, note.content);
    const third = await repository.readSyncChanges(owner, second.nextCursor);
    expect(third.changes).toHaveLength(1);
    body = (await (await batch([note.id], await token(owner))).json()).data[0];
    expect(body.linkPreviews).toEqual([]);
    await previews.deleteRoteLinkPreviewsByRoteId(note.id, note.content);
    expect((await repository.readSyncChanges(owner, third.nextCursor)).changes).toEqual([]);
  });

  it('does not let a previous content job overwrite or clear current previews', async () => {
    const owner = await makeOwner();
    const note = await actions.createUserNote(owner, { content: 'old source' });
    await db
      .update(schema.rotes)
      .set({ content: 'new source' })
      .where(operators.eq(schema.rotes.id, note.id));
    const url = 'https://example.test/new';
    await previews.upsertRoteLinkPreview({ roteid: note.id, url, title: 'current' }, 'new source');
    const checkpoint = await repository.readSyncSnapshot(owner);
    await previews.upsertRoteLinkPreview({ roteid: note.id, url, title: 'stale' }, note.content);
    await previews.deleteRoteLinkPreviewsByRoteId(note.id, note.content);
    expect(
      (await previews.findRoteLinkPreviewsByRoteId(note.id)).map((preview) => preview.title)
    ).toEqual(['current']);
    expect(await repository.readSyncSnapshot(owner)).toEqual(checkpoint);
  });

  it('rolls back preview data and parent timestamp when journaling fails', async () => {
    const owner = await makeOwner();
    const note = await actions.createUserNote(owner, { content: 'rollback source' });
    await db
      .update(schema.roteSyncStates)
      .set({ revision: 9223372036854775807n })
      .where(operators.eq(schema.roteSyncStates.userid, owner));
    const checkpoint = await repository.readSyncSnapshot(owner);
    await expect(
      previews.upsertRoteLinkPreview(
        {
          roteid: note.id,
          url: 'https://example.test/rollback',
          title: 'must roll back',
        },
        note.content
      )
    ).rejects.toThrow();
    expect(await previews.findRoteLinkPreviewsByRoteId(note.id)).toEqual([]);
    const [stored] = await db
      .select()
      .from(schema.rotes)
      .where(operators.eq(schema.rotes.id, note.id));
    expect(stored.updatedAt).toEqual(note.updatedAt);
    expect(await repository.readSyncSnapshot(owner)).toEqual(checkpoint);
  });

  it('ignores preview jobs after note deletion or article binding', async () => {
    const owner = await makeOwner();
    const removed = await actions.createUserNote(owner, { content: 'deleted source' });
    await actions.deleteUserNote(owner, removed.id);
    const checkpoint = await repository.readSyncSnapshot(owner);
    await previews.upsertRoteLinkPreview(
      { roteid: removed.id, url: 'https://example.test/deleted' },
      removed.content
    );
    await previews.deleteRoteLinkPreviewsByRoteId(removed.id, removed.content);
    expect(await repository.readSyncSnapshot(owner)).toEqual(checkpoint);
    const [article] = await db
      .insert(schema.articles)
      .values({ authorId: owner, content: 'article' })
      .returning();
    const bound = await actions.createUserNote(owner, {
      content: 'bound source',
      articleId: article.id,
    });
    const boundCheckpoint = await repository.readSyncSnapshot(owner);
    await previews.upsertRoteLinkPreview(
      { roteid: bound.id, url: 'https://example.test/bound' },
      bound.content
    );
    expect(await previews.findRoteLinkPreviewsByRoteId(bound.id)).toEqual([]);
    expect(await repository.readSyncSnapshot(owner)).toEqual(boundCheckpoint);
  });
});
