import { asc, eq, sql } from 'drizzle-orm';
import { roteLinkPreviews } from '../../drizzle/schema';
import db from '../drizzle';
import { DatabaseError } from './common';

export async function upsertRoteLinkPreview(data: {
  roteid: string;
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  siteName?: string | null;
  contentExcerpt?: string | null;
  score?: number | null;
}): Promise<any> {
  try {
    const [preview] = await db
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

    return preview;
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

export async function deleteRoteLinkPreviewsByRoteId(roteid: string): Promise<void> {
  try {
    await db.delete(roteLinkPreviews).where(eq(roteLinkPreviews.roteid, roteid));
  } catch (error) {
    throw new DatabaseError('Failed to delete link previews by rote id', error);
  }
}
