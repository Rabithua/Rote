import { createHash, randomUUID } from 'crypto';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import {
  articles,
  attachments,
  noteImportSources,
  roteChanges,
  rotes,
  type NewAttachment,
  type NewNoteImportSource,
  type NewRote,
} from '../drizzle/schema';
import db from '../utils/drizzle';
import { trackBackgroundTask } from '../utils/backgroundTask';
import { enqueueEmbeddingJobs } from '../utils/dbMethods/ai';
import { DatabaseError } from '../utils/dbMethods/common';
import { validateRoteAttachmentDetails } from '../utils/fileValidation';
import { r2deletehandler } from '../utils/r2';
import {
  parseImportPayload,
  type ImportAttachment,
  type ImportNote,
  type ImportPayload,
  type ImportSource,
} from './importSchema';

const IMPORT_CHUNK_SIZE = 200;

type AttachmentMap = Record<string, string>;

interface ImportCounts {
  created: number;
  updated: number;
  unchanged: number;
}

export interface ImportResult {
  count: number;
  created: number;
  updated: number;
  unchanged: number;
  notes: ImportCounts & { total: number };
  articles: { total: number; created: number; updated: number };
  attachments: { total: number; created: number; updated: number; deleted: number };
  formatVersion: number;
}

export async function importUserData(userId: string, rawData: unknown): Promise<ImportResult> {
  const parsedPayload = parseImportPayload(rawData);
  parsedPayload.notes.forEach((note) => validateRoteAttachmentDetails(note.attachments ?? []));
  const payload = parsedPayload;
  const articleResult = await importArticles(userId, payload);
  const ownedArticleIds = await getOwnedArticleIds(userId, payload.notes);
  const counts: ImportCounts = { created: 0, updated: 0, unchanged: 0 };
  const attachmentCounts = {
    total: payload.notes.reduce((total, note) => total + (note.attachments?.length ?? 0), 0),
    created: 0,
    updated: 0,
    deleted: 0,
  };
  const changedNoteIds: string[] = [];

  try {
    for (let offset = 0; offset < payload.notes.length; offset += IMPORT_CHUNK_SIZE) {
      const chunk = payload.notes.slice(offset, offset + IMPORT_CHUNK_SIZE);
      const objectKeysToDelete: string[] = [];

      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`import:${userId}`}))`);
        const sourceNotes = chunk.filter(hasImportSource);
        const sourceConditions = sourceNotes.map((note) =>
          and(
            eq(noteImportSources.provider, note.source.provider),
            eq(noteImportSources.accountId, note.source.accountId),
            eq(noteImportSources.externalId, note.source.externalId)
          )
        );
        const mappings =
          sourceConditions.length > 0
            ? await tx
                .select()
                .from(noteImportSources)
                .where(and(eq(noteImportSources.ownerId, userId), or(...sourceConditions)))
            : [];
        const mappingsBySource = new Map(mappings.map((row) => [sourceKey(row), row]));
        const existingIds = new Set<string>();
        mappings.forEach((row) => existingIds.add(row.roteId));
        chunk.filter((note) => !note.source).forEach((note) => existingIds.add(note.id));
        const existingNotes =
          existingIds.size > 0
            ? await tx
                .select()
                .from(rotes)
                .where(inArray(rotes.id, [...existingIds]))
            : [];
        const existingById = new Map(existingNotes.map((note) => [note.id, note]));
        const incomingAttachmentIds = chunk.flatMap((note) =>
          (note.attachments ?? []).flatMap((attachment) => (attachment.id ? [attachment.id] : []))
        );
        const incomingAttachmentRows =
          incomingAttachmentIds.length > 0
            ? await tx
                .select()
                .from(attachments)
                .where(inArray(attachments.id, incomingAttachmentIds))
            : [];
        const incomingAttachmentsById = new Map(
          incomingAttachmentRows.map((attachment) => [attachment.id, attachment])
        );

        const noteRows: NewRote[] = [];
        const mappingRows: NewNoteImportSource[] = [];
        const attachmentRows: NewAttachment[] = [];
        const managedAttachmentIdsToDelete = new Set<string>();
        const changes: Array<{ id: string; action: 'CREATE' | 'UPDATE' }> = [];

        for (const note of chunk) {
          const mapping = note.source ? mappingsBySource.get(sourceKey(note.source)) : undefined;
          const targetId = mapping?.roteId ?? (note.source ? randomUUID() : note.id);
          const existing = existingById.get(targetId);

          if (existing && existing.authorid !== userId) {
            throw new Error(`Security violation: Cannot update note ${targetId}`);
          }

          if (existing && payload.importOptions.existingStrategy === 'skip') {
            counts.unchanged += 1;
            (note.attachments ?? []).forEach((attachment) => {
              const pending = attachment.id
                ? incomingAttachmentsById.get(attachment.id)
                : undefined;
              if (pending?.userid === userId && !pending.roteid) {
                managedAttachmentIdsToDelete.add(pending.id);
              }
            });
            continue;
          }

          const noteData = buildNoteData(note, targetId, userId, ownedArticleIds, payload);
          noteRows.push(noteData);
          changes.push({ id: targetId, action: existing ? 'UPDATE' : 'CREATE' });
          changedNoteIds.push(targetId);
          if (existing) counts.updated += 1;
          else counts.created += 1;

          const attachmentMap = mapping ? readAttachmentMap(mapping.attachmentMap) : {};
          const nextAttachmentMap: AttachmentMap = {};
          const incomingAttachments = note.attachments ?? [];
          incomingAttachments.forEach((attachment, index) => {
            const attachmentSource =
              attachment.source ??
              (note.source
                ? {
                    provider: note.source.provider,
                    accountId: note.source.accountId,
                    externalId: fallbackAttachmentExternalId(attachment, index),
                  }
                : undefined);
            const attachmentKey = attachmentSource
              ? sourceKey(attachmentSource)
              : fallbackAttachmentExternalId(attachment, index);
            const pendingAttachment = attachment.id
              ? incomingAttachmentsById.get(attachment.id)
              : undefined;
            if (
              pendingAttachment &&
              (pendingAttachment.userid !== userId ||
                (pendingAttachment.roteid && pendingAttachment.roteid !== targetId))
            ) {
              throw new Error(`Security violation: Cannot bind attachment ${attachment.id}`);
            }
            const attachmentId = pendingAttachment
              ? pendingAttachment.id
              : (attachmentMap[attachmentKey] ??
                (note.source ? randomUUID() : (attachment.id ?? randomUUID())));
            const replacedAttachmentId = attachmentMap[attachmentKey];
            if (replacedAttachmentId && replacedAttachmentId !== attachmentId) {
              managedAttachmentIdsToDelete.add(replacedAttachmentId);
            }
            nextAttachmentMap[attachmentKey] = attachmentId;
            const canonicalAttachment = pendingAttachment
              ? {
                  ...attachment,
                  url: pendingAttachment.url,
                  compressUrl: pendingAttachment.compressUrl ?? '',
                  posterUrl: pendingAttachment.posterUrl ?? '',
                  storage: pendingAttachment.storage,
                  details: pendingAttachment.details as Record<string, unknown>,
                  createdAt: pendingAttachment.createdAt.toISOString(),
                }
              : attachment;
            attachmentRows.push(
              buildAttachmentData(canonicalAttachment, attachmentId, targetId, userId)
            );
          });

          Object.entries(attachmentMap).forEach(([attachmentKey, attachmentId]) => {
            if (!(attachmentKey in nextAttachmentMap)) {
              managedAttachmentIdsToDelete.add(attachmentId);
            }
          });

          if (note.source) {
            mappingRows.push({
              ownerId: userId,
              roteId: targetId,
              provider: note.source.provider,
              accountId: note.source.accountId,
              externalId: note.source.externalId,
              attachmentMap: nextAttachmentMap,
              updatedAt: new Date(),
            });
          }
        }

        if (noteRows.length > 0) {
          await tx
            .insert(rotes)
            .values(noteRows)
            .onConflictDoUpdate({
              target: rotes.id,
              set: {
                title: sql`excluded."title"`,
                type: sql`excluded."type"`,
                tags: sql`excluded."tags"`,
                content: sql`excluded."content"`,
                state: sql`excluded."state"`,
                archived: sql`excluded."archived"`,
                authorid: sql`excluded."authorid"`,
                articleId: sql`excluded."articleId"`,
                pin: sql`excluded."pin"`,
                editor: sql`excluded."editor"`,
                createdAt: sql`excluded."createdAt"`,
                updatedAt: sql`excluded."updatedAt"`,
              },
            });
        }

        if (managedAttachmentIdsToDelete.size > 0) {
          for (const ids of chunkValues([...managedAttachmentIdsToDelete], 500)) {
            const deleted = await tx
              .delete(attachments)
              .where(and(eq(attachments.userid, userId), inArray(attachments.id, ids)))
              .returning({
                id: attachments.id,
                details: attachments.details,
                storage: attachments.storage,
              });
            attachmentCounts.deleted += deleted.length;
            deleted.forEach((attachment) => {
              if (attachment.storage === 'R2') {
                objectKeysToDelete.push(...collectAttachmentObjectKeys(attachment.details, userId));
              }
            });
          }
        }

        if (attachmentRows.length > 0) {
          for (const rows of chunkValues(attachmentRows, 250)) {
            const attachmentIds = rows.map((row) => String(row.id));
            const existingAttachmentRows = await tx
              .select({ id: attachments.id, userid: attachments.userid })
              .from(attachments)
              .where(inArray(attachments.id, attachmentIds));
            existingAttachmentRows.forEach((attachment) => {
              if (attachment.userid && attachment.userid !== userId) {
                throw new Error(`Security violation: Cannot update attachment ${attachment.id}`);
              }
            });
            const existingAttachmentIds = new Set(existingAttachmentRows.map((row) => row.id));
            attachmentCounts.updated += attachmentIds.filter((id) =>
              existingAttachmentIds.has(id)
            ).length;
            attachmentCounts.created += attachmentIds.filter(
              (id) => !existingAttachmentIds.has(id)
            ).length;

            await tx
              .insert(attachments)
              .values(rows)
              .onConflictDoUpdate({
                target: attachments.id,
                set: {
                  url: sql`excluded."url"`,
                  compressUrl: sql`excluded."compressUrl"`,
                  posterUrl: sql`excluded."posterUrl"`,
                  userid: sql`excluded."userid"`,
                  roteid: sql`excluded."roteid"`,
                  storage: sql`excluded."storage"`,
                  details: sql`excluded."details"`,
                  createdAt: sql`excluded."createdAt"`,
                  updatedAt: sql`excluded."updatedAt"`,
                  sortIndex: sql`excluded."sortIndex"`,
                },
              });
          }
        }

        if (mappingRows.length > 0) {
          await tx
            .insert(noteImportSources)
            .values(mappingRows)
            .onConflictDoUpdate({
              target: [
                noteImportSources.ownerId,
                noteImportSources.provider,
                noteImportSources.accountId,
                noteImportSources.externalId,
              ],
              set: {
                roteId: sql`excluded."roteId"`,
                attachmentMap: sql`excluded."attachmentMap"`,
                updatedAt: sql`now()`,
              },
            });
        }

        if (changes.length > 0) {
          await tx.insert(roteChanges).values(
            changes.map((change) => ({
              originid: change.id,
              roteid: change.id,
              action: change.action,
              userid: userId,
              createdAt: new Date(),
            }))
          );
        }
      });

      objectKeysToDelete.forEach((key) => {
        r2deletehandler(key).catch((error) => {
          // eslint-disable-next-line no-console -- committed imports must not fail if stale-object cleanup is unavailable
          console.error(`[import] failed to delete replaced attachment object: ${key}`, error);
        });
      });
    }

    trackBackgroundTask(
      enqueueEmbeddingJobs('rote', changedNoteIds, userId),
      'import_embedding_enqueue_failed'
    );

    return {
      count: payload.notes.length,
      created: counts.created,
      updated: counts.updated,
      unchanged: counts.unchanged,
      notes: { total: payload.notes.length, ...counts },
      articles: articleResult,
      attachments: attachmentCounts,
      formatVersion: payload.formatVersion ?? 1,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Security violation')) {
      throw new DatabaseError(error.message, error);
    }
    throw new DatabaseError('Failed to import user data', error);
  }
}

export async function planUserImport(userId: string, rawData: unknown) {
  const payload = parseImportPayload(rawData);
  const noteIndexes = await getNoteIndexesRequiringImport(userId, payload);
  return { noteIndexes: [...noteIndexes].sort((a, b) => a - b) };
}

async function getNoteIndexesRequiringImport(
  userId: string,
  payload: ImportPayload
): Promise<Set<number>> {
  if (payload.importOptions.existingStrategy === 'overwrite') {
    return new Set(payload.notes.map((_, index) => index));
  }

  const existingSourceKeys = new Set<string>();
  const sourceNotes = payload.notes.filter(hasImportSource);
  for (const chunk of chunkValues(sourceNotes, IMPORT_CHUNK_SIZE)) {
    const conditions = chunk.map((note) =>
      and(
        eq(noteImportSources.provider, note.source.provider),
        eq(noteImportSources.accountId, note.source.accountId),
        eq(noteImportSources.externalId, note.source.externalId)
      )
    );
    if (conditions.length === 0) continue;
    const rows = await db
      .select({
        accountId: noteImportSources.accountId,
        externalId: noteImportSources.externalId,
        provider: noteImportSources.provider,
      })
      .from(noteImportSources)
      .where(and(eq(noteImportSources.ownerId, userId), or(...conditions)));
    rows.forEach((row) => existingSourceKeys.add(sourceKey(row)));
  }

  const legacyNotes = payload.notes.filter((note) => !note.source);
  const existingLegacyIds = new Set<string>();
  for (const chunk of chunkValues(legacyNotes, 500)) {
    if (chunk.length === 0) continue;
    const rows = await db
      .select({ id: rotes.id })
      .from(rotes)
      .where(
        and(
          eq(rotes.authorid, userId),
          inArray(
            rotes.id,
            chunk.map((note) => note.id)
          )
        )
      );
    rows.forEach((row) => existingLegacyIds.add(row.id));
  }

  return new Set(
    payload.notes.flatMap((note, index) => {
      const exists = note.source
        ? existingSourceKeys.has(sourceKey(note.source))
        : existingLegacyIds.has(note.id);
      return exists ? [] : [index];
    })
  );
}

async function importArticles(userId: string, payload: ImportPayload) {
  const uniqueArticles = [
    ...new Map(payload.articles.map((article) => [article.id, article])).values(),
  ];
  if (uniqueArticles.length === 0) return { total: 0, created: 0, updated: 0 };

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: articles.id, authorId: articles.authorId })
      .from(articles)
      .where(
        inArray(
          articles.id,
          uniqueArticles.map((article) => article.id)
        )
      );
    existing.forEach((article) => {
      if (article.authorId !== userId) {
        throw new Error(`Security violation: Cannot update article ${article.id}`);
      }
    });
    const existingIds = new Set(existing.map((article) => article.id));
    const rows = uniqueArticles.map((article) => ({
      id: article.id,
      content: article.content,
      authorId: userId,
      createdAt: parseOptionalDate(article.createdAt) ?? new Date(),
      updatedAt: parseOptionalDate(article.updatedAt) ?? new Date(),
    }));

    await tx
      .insert(articles)
      .values(rows)
      .onConflictDoUpdate({
        target: articles.id,
        set: {
          content: sql`excluded."content"`,
          authorId: sql`excluded."authorId"`,
          createdAt: sql`excluded."createdAt"`,
          updatedAt: sql`excluded."updatedAt"`,
        },
      });

    return {
      total: rows.length,
      created: rows.filter((row) => !existingIds.has(row.id)).length,
      updated: rows.filter((row) => existingIds.has(row.id)).length,
    };
  });
}

async function getOwnedArticleIds(userId: string, notes: ImportNote[]): Promise<Set<string>> {
  const ids = notes.flatMap((note) => (note.articleId ? [note.articleId] : []));
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.authorId, userId), inArray(articles.id, [...new Set(ids)])));
  return new Set(rows.map((row) => row.id));
}

function buildNoteData(
  note: ImportNote,
  id: string,
  userId: string,
  ownedArticleIds: Set<string>,
  payload: ImportPayload
): NewRote {
  return {
    id,
    title: note.title ?? '',
    type: note.type ?? 'Rote',
    tags: note.tags ?? [],
    content: note.content,
    state:
      payload.importOptions.visibilityStrategy === 'private'
        ? 'private'
        : (note.state ?? 'private'),
    archived: note.archived ?? false,
    authorid: userId,
    articleId: note.articleId && ownedArticleIds.has(note.articleId) ? note.articleId : null,
    pin: note.pin ?? false,
    editor: note.editor ?? 'normal',
    createdAt: parseOptionalDate(note.createdAt) ?? new Date(),
    updatedAt: new Date(),
  };
}

function buildAttachmentData(
  attachment: ImportAttachment,
  id: string,
  roteId: string,
  userId: string
): NewAttachment {
  return {
    id,
    url: attachment.url,
    compressUrl: attachment.compressUrl ?? '',
    posterUrl: attachment.posterUrl ?? '',
    userid: userId,
    roteid: roteId,
    storage: attachment.storage,
    details: attachment.details,
    createdAt: parseOptionalDate(attachment.createdAt) ?? new Date(),
    updatedAt: new Date(),
    sortIndex: attachment.sortIndex ?? 0,
  };
}

function hasImportSource(note: ImportNote): note is ImportNote & { source: ImportSource } {
  return Boolean(note.source);
}

function sourceKey(source: Pick<ImportSource, 'accountId' | 'externalId' | 'provider'>): string {
  return JSON.stringify([source.provider, source.accountId, source.externalId]);
}

function readAttachmentMap(value: unknown): AttachmentMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
}

function parseOptionalDate(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

function fallbackAttachmentExternalId(attachment: ImportAttachment, index: number): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        index,
        url: attachment.url,
        compressUrl: attachment.compressUrl ?? '',
        posterUrl: attachment.posterUrl ?? '',
        storage: attachment.storage,
        details: {
          key: attachment.details.key ?? null,
          size: attachment.details.size ?? null,
          mimetype: attachment.details.mimetype ?? null,
          compressKey: attachment.details.compressKey ?? null,
        },
        sortIndex: attachment.sortIndex ?? 0,
      })
    )
    .digest('hex');
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let offset = 0; offset < values.length; offset += size) {
    chunks.push(values.slice(offset, offset + size));
  }
  return chunks;
}

function collectAttachmentObjectKeys(details: unknown, userId: string): string[] {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return [];
  const record = details as Record<string, unknown>;
  const prefix = `users/${userId}/`;
  return Array.from(
    new Set(
      ['key', 'compressKey', 'posterKey', 'pairedVideoKey']
        .map((key) => record[key])
        .filter((value): value is string => typeof value === 'string' && value.startsWith(prefix))
    )
  );
}
