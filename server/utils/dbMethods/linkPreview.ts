import { and, eq, sql } from 'drizzle-orm';
import { roteLinkPreviews, rotes } from '../../drizzle/schema';
import { lockNoteSyncOwner, recordRoteChanges, type SyncTransaction } from '../../sync/journal';
import db from '../drizzle';
import { DatabaseError } from './common';

async function lockPreviewNote(transaction: SyncTransaction, roteid: string, content: string) {
  if (!(await lockNoteSyncOwner(transaction, roteid))) return;
  // The fetch happened outside this transaction. Ignore results for content
  // that has since changed, including a delayed preview-clear operation.
  const [note] = await transaction
    .select({ id: rotes.id, authorid: rotes.authorid, articleId: rotes.articleId })
    .from(rotes)
    .where(and(eq(rotes.id, roteid), eq(rotes.content, content)));
  return note;
}

async function publishPreviewChange(
  transaction: SyncTransaction,
  note: { id: string; authorid: string }
) {
  // Advance the parent timestamp as well for legacy clients that compare it
  // before applying relation data. The journal and preview commit together.
  await transaction
    .update(rotes)
    .set({ updatedAt: sql`clock_timestamp()` })
    .where(eq(rotes.id, note.id));
  await recordRoteChanges(transaction, note.authorid, [{ originid: note.id, action: 'UPDATE' }]);
}

export async function upsertRoteLinkPreview(
  data: {
    roteid: string;
    url: string;
    title?: string | null;
    description?: string | null;
    image?: string | null;
    siteName?: string | null;
    contentExcerpt?: string | null;
    score?: number | null;
  },
  expectedContent: string
): Promise<any> {
  try {
    return await db.transaction(async (transaction) => {
      const note = await lockPreviewNote(transaction, data.roteid, expectedContent);
      if (!note || note.articleId) return;
      const [preview] = await transaction
        .insert(roteLinkPreviews)
        .values({
          roteid: data.roteid,
          url: data.url,
          title: data.title ?? null,
          description: data.description ?? null,
          image: data.image ?? null,
          siteName: data.siteName ?? null,
          contentExcerpt: data.contentExcerpt ?? null,
          score: data.score ?? null,
          createdAt: sql`now()`,
        })
        .onConflictDoUpdate({
          target: [roteLinkPreviews.roteid, roteLinkPreviews.url],
          set: {
            title: data.title ?? null,
            description: data.description ?? null,
            image: data.image ?? null,
            siteName: data.siteName ?? null,
            contentExcerpt: data.contentExcerpt ?? null,
            score: data.score ?? null,
          },
        })
        .returning();

      await publishPreviewChange(transaction, note);
      return preview;
    });
  } catch (error) {
    throw new DatabaseError('Failed to upsert link preview', error);
  }
}

export async function findRoteLinkPreviewsByRoteId(roteid: string): Promise<any[]> {
  try {
    return await db.query.roteLinkPreviews.findMany({
      where: (linkPreviews, { eq }) => eq(linkPreviews.roteid, roteid),
      orderBy: (linkPreviews, { asc }) => [asc(linkPreviews.createdAt)],
    });
  } catch (error) {
    throw new DatabaseError('Failed to find link previews by rote id', error);
  }
}

export async function deleteRoteLinkPreviewsByRoteId(
  roteid: string,
  expectedContent: string
): Promise<void> {
  try {
    await db.transaction(async (transaction) => {
      const note = await lockPreviewNote(transaction, roteid, expectedContent);
      if (!note) return;
      const removed = await transaction
        .delete(roteLinkPreviews)
        .where(eq(roteLinkPreviews.roteid, roteid))
        .returning({ id: roteLinkPreviews.id });
      if (removed.length > 0) await publishPreviewChange(transaction, note);
    });
  } catch (error) {
    throw new DatabaseError('Failed to delete link previews by rote id', error);
  }
}
