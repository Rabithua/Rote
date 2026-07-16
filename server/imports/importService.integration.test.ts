import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

const runIntegration = process.env.ROTE_IMPORT_INTEGRATION === '1';
const integrationTest = runIntegration ? test : test.skip;
const userId = '10000000-0000-4000-8000-000000000001';
const secondUserId = '10000000-0000-4000-8000-000000000002';

describe('batched import service', () => {
  beforeAll(async () => {
    if (!runIntegration) return;
    const { users } = await import('../drizzle/schema');
    const { default: db } = await import('../utils/drizzle');
    await db
      .insert(users)
      .values([
        {
          id: userId,
          email: 'import-integration@example.com',
          username: 'import-integration',
        },
        {
          id: secondUserId,
          email: 'import-integration-2@example.com',
          username: 'import-integration-2',
        },
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    if (!runIntegration) return;
    const { users } = await import('../drizzle/schema');
    const { default: db } = await import('../utils/drizzle');
    const { inArray } = await import('drizzle-orm');
    await db.delete(users).where(inArray(users.id, [userId, secondUserId]));
  });

  integrationTest(
    'imports 2,500 notes idempotently and protects local edits',
    async () => {
      const { noteImportSources, rotes } = await import('../drizzle/schema');
      const { default: db } = await import('../utils/drizzle');
      const { importUserData } = await import('./importService');
      const { eq } = await import('drizzle-orm');
      const notes = Array.from({ length: 2_500 }, (_, index) => createNote(index));

      const startedAt = performance.now();
      const first = await importUserData(userId, v2Payload(notes));
      const firstDurationMs = performance.now() - startedAt;

      expect(first.notes.created).toBe(2_500);
      expect(firstDurationMs).toBeLessThan(30_000);

      const repeated = await importUserData(userId, v2Payload(notes));
      expect(repeated.notes.unchanged).toBe(2_500);
      expect(repeated.notes.updated).toBe(0);

      const changed = notes.map((note, index) =>
        index === 0
          ? {
              ...note,
              content: 'source edit',
              source: { ...note.source, sourceUpdatedAt: '2026-07-17T00:00:00.000Z' },
            }
          : note
      );
      const sourceUpdate = await importUserData(userId, v2Payload(changed));
      expect(sourceUpdate.notes.updated).toBe(1);
      expect(sourceUpdate.notes.unchanged).toBe(2_499);

      const [mapping] = await db
        .select({ roteId: noteImportSources.roteId })
        .from(noteImportSources)
        .where(eq(noteImportSources.externalId, notes[0].source.externalId))
        .limit(1);
      await db.update(rotes).set({ content: 'local edit' }).where(eq(rotes.id, mapping.roteId));

      const changedAgain = changed.map((note, index) =>
        index === 0
          ? {
              ...note,
              content: 'newer source edit',
              source: { ...note.source, sourceUpdatedAt: '2026-07-18T00:00:00.000Z' },
            }
          : note
      );
      const conflict = await importUserData(userId, v2Payload(changedAgain));
      expect(conflict.notes.conflicts).toBe(1);

      const overwrite = await importUserData(userId, {
        formatVersion: 2,
        notes: changedAgain,
        importOptions: { conflictStrategy: 'overwrite', visibilityStrategy: 'private' },
      });
      expect(overwrite.notes.updated).toBe(1);
      const [overwritten] = await db
        .select({ content: rotes.content })
        .from(rotes)
        .where(eq(rotes.id, mapping.roteId));
      expect(overwritten.content).toBe('newer source edit');

      const stale = await importUserData(userId, v2Payload(changed));
      expect(stale.notes.stale).toBe(1);

      const attachmentNote = {
        ...createNote(3_000),
        attachments: [
          {
            url: 'https://example.com/image.png',
            storage: 'REMOTE',
            details: { key: 'image.png', size: 10, mimetype: 'image/png' },
            source: {
              provider: 'memos',
              accountId: 'a:b',
              externalId: 'c',
            },
          },
          {
            url: 'https://example.com/image-2.png',
            storage: 'REMOTE',
            details: { key: 'image-2.png', size: 20, mimetype: 'image/png' },
            source: {
              provider: 'memos',
              accountId: 'a',
              externalId: 'b:c',
            },
          },
        ],
      };
      const attachmentImport = await importUserData(userId, v2Payload([attachmentNote]));
      expect(attachmentImport.attachments.created).toBe(2);
      const attachmentRepeat = await importUserData(userId, v2Payload([attachmentNote]));
      expect(attachmentRepeat.notes.unchanged).toBe(1);
      expect(attachmentRepeat.attachments.total).toBe(2);

      const { exportData } = await import('../utils/dbMethods/userData');
      const exported = await exportData(userId);
      const exportedSourceNote = exported.notes.find(
        (note: any) => note.source?.externalId === attachmentNote.source.externalId
      );
      expect(exported.formatVersion).toBe(2);
      expect(exportedSourceNote.source.provider).toBe('memos');
      expect(
        exportedSourceNote.attachments.map((attachment: any) => attachment.source)
      ).toContainEqual({ provider: 'memos', accountId: 'a:b', externalId: 'c' });
      expect(
        exportedSourceNote.attachments.map((attachment: any) => attachment.source)
      ).toContainEqual({ provider: 'memos', accountId: 'a', externalId: 'b:c' });

      const withoutAttachment = {
        ...attachmentNote,
        attachments: [],
        source: {
          ...attachmentNote.source,
          sourceUpdatedAt: '2026-07-17T00:00:00.000Z',
        },
      };
      const attachmentRemoval = await importUserData(userId, v2Payload([withoutAttachment]));
      expect(attachmentRemoval.attachments.deleted).toBe(2);

      const secondUserImport = await importUserData(secondUserId, v2Payload([attachmentNote]));
      expect(secondUserImport.notes.created).toBe(1);
      expect(secondUserImport.attachments.created).toBe(2);

      const concurrentNote = createNote(4_000);
      const concurrentResults = await Promise.all([
        importUserData(userId, v2Payload([concurrentNote])),
        importUserData(userId, v2Payload([concurrentNote])),
      ]);
      expect(concurrentResults.reduce((total, result) => total + result.notes.created, 0)).toBe(1);
      expect(concurrentResults.reduce((total, result) => total + result.notes.unchanged, 0)).toBe(
        1
      );
    },
    60_000
  );
});

function createNote(index: number) {
  const suffix = index.toString().padStart(12, '0');
  return {
    id: `20000000-0000-4000-8000-${suffix}`,
    content: `note ${index}`,
    title: '',
    tags: ['migration'],
    state: 'public',
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    source: {
      provider: 'memos',
      accountId: 'integration-account',
      externalId: `memo-${index}`,
      sourceUpdatedAt: '2026-07-16T00:00:00.000Z',
    },
  };
}

function v2Payload(notes: ReturnType<typeof createNote>[]) {
  return {
    formatVersion: 2 as const,
    notes,
    importOptions: {
      conflictStrategy: 'preserve' as const,
      visibilityStrategy: 'private' as const,
    },
  };
}
