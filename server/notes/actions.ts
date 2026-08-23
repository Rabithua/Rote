import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { articles, attachments, roteChanges, rotes, users, type Rote } from '../drizzle/schema';
import {
  collectOwnedAttachmentObjectKeys,
  enqueueStorageObjectCleanup,
  releaseStorageObjectReferences,
} from '../resources/service';
import { notifyPublicNoteCreated } from '../utils/adminHooks';
import { trackBackgroundTask } from '../utils/backgroundTask';
import {
  deleteEmbeddingsForSource,
  deleteRoteLinkPreviewsByRoteId,
  enqueueEmbeddingJob,
  findRoteById,
} from '../utils/dbMethods';
import db from '../utils/drizzle';
import { validateRoteAttachmentDetails } from '../utils/fileValidation';
import { parseAndStoreRoteLinkPreviews } from '../utils/linkPreview';
import { NoteCreateZod, NoteUpdateZod } from '../utils/zod';

export type CreateUserNoteInput = z.infer<typeof NoteCreateZod>;
export type UpdateUserNoteInput = z.infer<typeof NoteUpdateZod>;

type WritableNoteFields = Pick<
  Rote,
  'archived' | 'content' | 'editor' | 'pin' | 'state' | 'tags' | 'title' | 'type'
>;

function createArticleId(input: CreateUserNoteInput): string | null {
  if (typeof input.articleId === 'string') return input.articleId;
  return input.articleIds?.[0] ?? null;
}

function updatedArticleId(input: UpdateUserNoteInput): string | null | undefined {
  if (Object.prototype.hasOwnProperty.call(input, 'articleId')) {
    return input.articleId ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'articleIds')) {
    return input.articleIds?.[0] ?? null;
  }
  return undefined;
}

function updateFields(input: UpdateUserNoteInput): Partial<WritableNoteFields> {
  return {
    ...(input.archived !== undefined ? { archived: input.archived } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
    ...(input.editor !== undefined ? { editor: input.editor } : {}),
    ...(input.pin !== undefined ? { pin: input.pin } : {}),
    ...(input.state !== undefined ? { state: input.state } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
  };
}

function normalizedCreateTags(tags: string[] | undefined): string[] {
  return (tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0);
}

async function assertOwnedArticle(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  articleId: string | null | undefined
) {
  if (!articleId) return;
  const [article] = await transaction
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.authorId, userId)))
    .limit(1);
  if (!article) throw new Error('Article not found or permission denied');
}

function scheduleCreatedEffects(note: Rote) {
  trackBackgroundTask(
    enqueueEmbeddingJob('rote', note.id, note.authorid),
    'rote_embedding_enqueue_failed'
  );
  if (!note.articleId) {
    trackBackgroundTask(
      parseAndStoreRoteLinkPreviews(note.id, note.content),
      'link_preview_create_failed'
    );
  }
  if (note.state === 'public') {
    trackBackgroundTask(notifyPublicNoteCreated(note), 'admin_hook_public_note_failed');
  }
}

function scheduleUpdatedEffects(note: Rote, previousState: string, refreshLinkPreviews: boolean) {
  trackBackgroundTask(
    enqueueEmbeddingJob('rote', note.id, note.authorid),
    'rote_embedding_enqueue_failed'
  );
  if (refreshLinkPreviews) {
    trackBackgroundTask(
      (async () => {
        await deleteRoteLinkPreviewsByRoteId(note.id);
        if (!note.articleId) await parseAndStoreRoteLinkPreviews(note.id, note.content);
      })(),
      'link_preview_update_failed'
    );
  }
  if (previousState !== 'public' && note.state === 'public') {
    trackBackgroundTask(notifyPublicNoteCreated(note), 'admin_hook_public_note_failed');
  }
}

export async function createUserNote(userId: string, input: CreateUserNoteInput) {
  const articleId = createArticleId(input);
  const attachmentIds = input.attachmentIds ?? [];
  const rote = await db.transaction(async (transaction) => {
    const [user] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .for('update');
    if (!user) throw new Error('User not found');

    await assertOwnedArticle(transaction, userId, articleId);

    const attachmentRows =
      attachmentIds.length > 0
        ? await transaction
            .select({ id: attachments.id, details: attachments.details })
            .from(attachments)
            .where(
              and(
                inArray(attachments.id, attachmentIds),
                eq(attachments.userid, userId),
                isNull(attachments.roteid)
              )
            )
            .for('update')
        : [];
    if (attachmentRows.length !== attachmentIds.length) {
      throw new Error('Some attachments not found or permission denied');
    }
    validateRoteAttachmentDetails(attachmentRows);

    const [created] = await transaction
      .insert(rotes)
      .values({
        articleId,
        archived: input.archived ?? false,
        authorid: userId,
        content: input.content,
        editor: input.editor ?? 'normal',
        pin: input.pin ?? false,
        state: input.state || 'private',
        tags: normalizedCreateTags(input.tags),
        title: input.title ?? '',
        type: input.type || 'Rote',
        createdAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .returning();
    if (!created) throw new Error('Failed to create note');

    await Promise.all(
      attachmentIds.map((attachmentId, sortIndex) =>
        transaction
          .update(attachments)
          .set({ roteid: created.id, sortIndex, updatedAt: new Date() })
          .where(eq(attachments.id, attachmentId))
      )
    );
    await transaction.insert(roteChanges).values({
      originid: created.id,
      roteid: created.id,
      action: 'CREATE',
      userid: userId,
      createdAt: sql`now()`,
    });
    return created;
  });

  const note = (await findRoteById(rote.id, userId)) ?? rote;
  scheduleCreatedEffects(note);
  return note;
}

export async function updateUserNote(userId: string, id: string, input: UpdateUserNoteInput) {
  const articleId = updatedArticleId(input);
  const fields = updateFields(input);
  const result = await db.transaction(async (transaction) => {
    const [existing] = await transaction
      .select()
      .from(rotes)
      .where(and(eq(rotes.id, id), eq(rotes.authorid, userId)))
      .limit(1)
      .for('update');
    if (!existing) throw new Error('Note not found');

    await assertOwnedArticle(transaction, userId, articleId);
    const [updated] = await transaction
      .update(rotes)
      .set({
        ...fields,
        ...(articleId !== undefined ? { articleId } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(rotes.id, id), eq(rotes.authorid, userId)))
      .returning();
    if (!updated) throw new Error('Note not found');

    await transaction.insert(roteChanges).values({
      originid: id,
      roteid: id,
      action: 'UPDATE',
      userid: userId,
      createdAt: sql`now()`,
    });
    return { note: updated, previousState: existing.state };
  });

  const note = (await findRoteById(id, userId)) ?? result.note;
  scheduleUpdatedEffects(
    note,
    result.previousState,
    input.content !== undefined || articleId !== undefined
  );
  return note;
}

export async function deleteUserNote(userId: string, id: string) {
  const deleted = await db.transaction(async (transaction) => {
    const [user] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .for('update');
    if (!user) throw new Error('User not found');

    const [note] = await transaction
      .select()
      .from(rotes)
      .where(and(eq(rotes.id, id), eq(rotes.authorid, userId)))
      .limit(1)
      .for('update');
    if (!note) throw new Error('Note not found');

    const attachmentRows = await transaction
      .select({ details: attachments.details })
      .from(attachments)
      .where(eq(attachments.roteid, id))
      .for('update');
    const objectKeys = attachmentRows.flatMap(({ details }) =>
      collectOwnedAttachmentObjectKeys(details, userId)
    );
    const trackedKeys = new Set(
      await releaseStorageObjectReferences(userId, objectKeys, transaction)
    );
    await enqueueStorageObjectCleanup(
      transaction,
      objectKeys.filter((key) => !trackedKeys.has(key))
    );

    await transaction.insert(roteChanges).values({
      originid: id,
      roteid: id,
      action: 'DELETE',
      userid: userId,
      createdAt: sql`now()`,
    });
    await transaction.delete(attachments).where(eq(attachments.roteid, id));
    const [removed] = await transaction
      .delete(rotes)
      .where(and(eq(rotes.id, id), eq(rotes.authorid, userId)))
      .returning();
    if (!removed) throw new Error('Note not found');
    return removed;
  });

  trackBackgroundTask(deleteEmbeddingsForSource('rote', id), 'rote_embedding_delete_failed');
  return deleted;
}
