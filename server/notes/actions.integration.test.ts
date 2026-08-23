import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env.NOTE_ACTIONS_TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;

databaseDescribe('note write transactions', () => {
  const ownerId = randomUUID();
  const otherUserId = randomUUID();
  const ownedArticleId = randomUUID();
  const otherArticleId = randomUUID();
  const outboxKeys: string[] = [];
  let database: typeof import('../utils/drizzle').default;
  let schema: typeof import('../drizzle/schema');
  let actions: typeof import('./actions');
  let operators: typeof import('drizzle-orm');

  beforeAll(async () => {
    process.env.POSTGRESQL_URL = databaseUrl;
    [schema, actions, operators, { default: database }] = await Promise.all([
      import('../drizzle/schema'),
      import('./actions'),
      import('drizzle-orm'),
      import('../utils/drizzle'),
    ]);
    await database.insert(schema.users).values([
      {
        id: ownerId,
        email: `note-actions-${ownerId}@example.test`,
        username: `note-actions-${ownerId}`,
      },
      {
        id: otherUserId,
        email: `note-actions-${otherUserId}@example.test`,
        username: `note-actions-${otherUserId}`,
      },
    ]);
    await database.insert(schema.articles).values([
      { id: ownedArticleId, authorId: ownerId, content: 'owned article' },
      { id: otherArticleId, authorId: otherUserId, content: 'other article' },
    ]);
  });

  afterAll(async () => {
    const { inArray } = operators;
    await database
      .delete(schema.attachments)
      .where(inArray(schema.attachments.userid, [ownerId, otherUserId]));
    await database
      .delete(schema.roteChanges)
      .where(inArray(schema.roteChanges.userid, [ownerId, otherUserId]));
    await database
      .delete(schema.resourceStorageObjects)
      .where(inArray(schema.resourceStorageObjects.ownerId, [ownerId, otherUserId]));
    if (outboxKeys.length > 0) {
      await database
        .delete(schema.resourceCleanupOutbox)
        .where(inArray(schema.resourceCleanupOutbox.objectKey, outboxKeys));
    }
    await database.delete(schema.users).where(inArray(schema.users.id, [ownerId, otherUserId]));
    const { closeDatabase } = await import('../utils/drizzle');
    await closeDatabase();
  });

  it('rolls back creation when the article is not owned by the author', async () => {
    const attachmentId = randomUUID();
    const content = `invalid-article-${randomUUID()}`;
    await database.insert(schema.attachments).values({
      id: attachmentId,
      userid: ownerId,
      roteid: null,
      storage: 'R2',
      url: 'https://example.test/image.png',
      details: {
        key: `users/${ownerId}/uploads/${attachmentId}.png`,
        mimetype: 'image/png',
      },
    });

    await expect(
      actions.createUserNote(ownerId, {
        content,
        attachmentIds: [attachmentId],
        articleId: otherArticleId,
      })
    ).rejects.toThrow('Article not found');

    const [note] = await database
      .select()
      .from(schema.rotes)
      .where(operators.eq(schema.rotes.content, content));
    const [attachment] = await database
      .select({ roteid: schema.attachments.roteid })
      .from(schema.attachments)
      .where(operators.eq(schema.attachments.id, attachmentId));
    expect(note).toBeUndefined();
    expect(attachment?.roteid).toBeNull();
  });

  it('rolls back creation when an attachment is not owned by the author', async () => {
    const attachmentId = randomUUID();
    const content = `invalid-attachment-${randomUUID()}`;
    await database.insert(schema.attachments).values({
      id: attachmentId,
      userid: otherUserId,
      roteid: null,
      storage: 'R2',
      url: 'https://example.test/foreign.png',
      details: {
        key: `users/${otherUserId}/uploads/${attachmentId}.png`,
        mimetype: 'image/png',
      },
    });

    await expect(
      actions.createUserNote(ownerId, { content, attachmentIds: [attachmentId] })
    ).rejects.toThrow('Some attachments not found');

    const [note] = await database
      .select()
      .from(schema.rotes)
      .where(operators.eq(schema.rotes.content, content));
    expect(note).toBeUndefined();
  });

  it('creates the note, attachment binding, article binding, and one change together', async () => {
    const attachmentId = randomUUID();
    await database.insert(schema.attachments).values({
      id: attachmentId,
      userid: ownerId,
      roteid: null,
      storage: 'R2',
      url: 'https://example.test/bound.png',
      details: {
        key: `users/${ownerId}/uploads/${attachmentId}.png`,
        mimetype: 'image/png',
      },
    });

    const note = await actions.createUserNote(ownerId, {
      content: `atomic-create-${randomUUID()}`,
      attachmentIds: [attachmentId],
      articleId: ownedArticleId,
    });
    const [attachment] = await database
      .select({ roteid: schema.attachments.roteid })
      .from(schema.attachments)
      .where(operators.eq(schema.attachments.id, attachmentId));
    const changes = await database
      .select()
      .from(schema.roteChanges)
      .where(operators.eq(schema.roteChanges.originid, note.id));

    expect(note.articleId).toBe(ownedArticleId);
    expect(attachment?.roteid).toBe(note.id);
    expect(changes.map(({ action }) => action)).toEqual(['CREATE']);
  });

  it('rolls back note fields when an update references another users article', async () => {
    const noteId = randomUUID();
    await database.insert(schema.rotes).values({
      id: noteId,
      authorid: ownerId,
      content: 'original content',
      title: 'original title',
    });

    await expect(
      actions.updateUserNote(ownerId, noteId, {
        title: 'must not persist',
        articleId: otherArticleId,
      })
    ).rejects.toThrow('Article not found');

    const [note] = await database
      .select({ articleId: schema.rotes.articleId, title: schema.rotes.title })
      .from(schema.rotes)
      .where(operators.eq(schema.rotes.id, noteId));
    const changes = await database
      .select()
      .from(schema.roteChanges)
      .where(
        operators.and(
          operators.eq(schema.roteChanges.originid, noteId),
          operators.eq(schema.roteChanges.action, 'UPDATE')
        )
      );
    expect(note).toEqual({ articleId: null, title: 'original title' });
    expect(changes).toHaveLength(0);
  });

  it('deletes note data and persists cleanup jobs and the delete change atomically', async () => {
    const noteId = randomUUID();
    const attachmentId = randomUUID();
    const trackedKey = `users/${ownerId}/uploads/${randomUUID()}.png`;
    const legacyKey = `users/${ownerId}/compressed/${randomUUID()}.webp`;
    outboxKeys.push(trackedKey, legacyKey);

    await database.insert(schema.resourceStorageAccounts).values({
      userId: ownerId,
      usedBytes: 10n,
    });
    await database.insert(schema.resourceStorageObjects).values({
      ownerId,
      storageIdentity: 'primary',
      objectKey: trackedKey,
      role: 'original',
      actualBytes: 10n,
      billable: true,
    });
    await database.insert(schema.rotes).values({
      id: noteId,
      authorid: ownerId,
      content: 'delete me',
    });
    await database.insert(schema.attachments).values({
      id: attachmentId,
      userid: ownerId,
      roteid: noteId,
      storage: 'R2',
      url: 'https://example.test/delete.png',
      compressUrl: 'https://example.test/delete.webp',
      details: {
        key: trackedKey,
        compressKey: legacyKey,
        mimetype: 'image/png',
      },
    });

    const deleted = await actions.deleteUserNote(ownerId, noteId);

    const [note] = await database
      .select()
      .from(schema.rotes)
      .where(operators.eq(schema.rotes.id, noteId));
    const [attachment] = await database
      .select()
      .from(schema.attachments)
      .where(operators.eq(schema.attachments.id, attachmentId));
    const [change] = await database
      .select()
      .from(schema.roteChanges)
      .where(
        operators.and(
          operators.eq(schema.roteChanges.originid, noteId),
          operators.eq(schema.roteChanges.action, 'DELETE')
        )
      );
    const jobs = await database
      .select({ objectKey: schema.resourceCleanupOutbox.objectKey })
      .from(schema.resourceCleanupOutbox)
      .where(operators.inArray(schema.resourceCleanupOutbox.objectKey, [trackedKey, legacyKey]));

    expect(deleted.id).toBe(noteId);
    expect(note).toBeUndefined();
    expect(attachment).toBeUndefined();
    expect(change?.roteid).toBeNull();
    expect(jobs.map(({ objectKey }) => objectKey).sort()).toEqual([legacyKey, trackedKey].sort());
  });

  it('does not report success for a missing note', async () => {
    await expect(actions.deleteUserNote(ownerId, randomUUID())).rejects.toThrow('Note not found');
  });
});
