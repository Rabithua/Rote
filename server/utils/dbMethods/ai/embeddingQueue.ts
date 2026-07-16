import { and, eq, inArray, sql } from 'drizzle-orm';
import { articles, documentEmbeddings, embeddingJobs, rotes } from '../../../drizzle/schema';
import db from '../../drizzle';
import { DatabaseError } from '../common';
import { getStoredAiConfig, isAiEligibleUser, isVectorUsable, shouldAutoIndex } from './config';
import { getSourceDocument, sourceNeedsEmbeddingBackfill, VALID_SOURCE_TYPES } from './documents';
import type { AiSourceType, EmbeddingJobAction, EmbeddingJobStatus } from './types';

export async function enqueueEmbeddingJob(
  sourceType: AiSourceType,
  sourceId: string,
  ownerId: string,
  action: EmbeddingJobAction = 'upsert',
  force = false
): Promise<void> {
  try {
    if (!VALID_SOURCE_TYPES.has(sourceType)) return;

    if (action !== 'delete' && !(await isAiEligibleUser(ownerId))) {
      await deleteEmbeddingsForSource(sourceType, sourceId);
      return;
    }

    if (!force && action !== 'delete' && !shouldAutoIndex()) {
      return;
    }

    const [existing] = await db
      .select({ id: embeddingJobs.id })
      .from(embeddingJobs)
      .where(
        and(
          eq(embeddingJobs.sourceType, sourceType),
          eq(embeddingJobs.sourceId, sourceId),
          eq(embeddingJobs.status, 'pending')
        )
      )
      .limit(1);

    if (existing) return;

    await db.insert(embeddingJobs).values({
      ownerId,
      sourceType,
      sourceId,
      action,
      status: 'pending',
      attempts: 0,
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    });
  } catch (error: any) {
    throw new DatabaseError('Failed to enqueue embedding job', error);
  }
}

export async function enqueueEmbeddingJobs(
  sourceType: AiSourceType,
  sourceIds: string[],
  ownerId: string
): Promise<void> {
  const uniqueIds = [...new Set(sourceIds)];
  if (uniqueIds.length === 0 || !VALID_SOURCE_TYPES.has(sourceType)) return;

  try {
    if (!(await isAiEligibleUser(ownerId))) {
      for (const sourceIdChunk of chunkValues(uniqueIds, 500)) {
        await db
          .delete(documentEmbeddings)
          .where(
            and(
              eq(documentEmbeddings.sourceType, sourceType),
              inArray(documentEmbeddings.sourceId, sourceIdChunk)
            )
          );
      }
      return;
    }
    if (!shouldAutoIndex()) return;

    for (const sourceIdChunk of chunkValues(uniqueIds, 500)) {
      const existing = await db
        .select({ sourceId: embeddingJobs.sourceId })
        .from(embeddingJobs)
        .where(
          and(
            eq(embeddingJobs.sourceType, sourceType),
            eq(embeddingJobs.status, 'pending'),
            inArray(embeddingJobs.sourceId, sourceIdChunk)
          )
        );
      const pendingIds = new Set(existing.map((row) => row.sourceId));
      const rows = sourceIdChunk
        .filter((sourceId) => !pendingIds.has(sourceId))
        .map((sourceId) => ({
          ownerId,
          sourceType,
          sourceId,
          action: 'upsert' as const,
          status: 'pending' as const,
          attempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

      if (rows.length > 0) await db.insert(embeddingJobs).values(rows);
    }
  } catch (error: any) {
    throw new DatabaseError('Failed to enqueue embedding jobs', error);
  }
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let offset = 0; offset < values.length; offset += size) {
    chunks.push(values.slice(offset, offset + size));
  }
  return chunks;
}

export async function deleteEmbeddingsForSource(
  sourceType: AiSourceType,
  sourceId: string
): Promise<void> {
  try {
    await db
      .delete(documentEmbeddings)
      .where(
        and(
          eq(documentEmbeddings.sourceType, sourceType),
          eq(documentEmbeddings.sourceId, sourceId)
        )
      );
  } catch (error: any) {
    throw new DatabaseError('Failed to delete document embeddings', error);
  }
}

export async function deleteEmbeddingsForOwner(ownerId: string): Promise<void> {
  try {
    await db.delete(documentEmbeddings).where(eq(documentEmbeddings.ownerId, ownerId));
    await db.delete(embeddingJobs).where(eq(embeddingJobs.ownerId, ownerId));
  } catch (error: any) {
    throw new DatabaseError('Failed to delete user document embeddings', error);
  }
}

export async function enqueueBackfillEmbeddingJobs(): Promise<{ queued: number }> {
  try {
    const config = await getStoredAiConfig();
    if (!isVectorUsable(config)) {
      throw new Error('AI vector storage is disabled');
    }

    let queued = 0;
    const roteRows = await db.select({ id: rotes.id, ownerId: rotes.authorid }).from(rotes);
    const articleRows = await db
      .select({ id: articles.id, ownerId: articles.authorId })
      .from(articles);

    for (const row of roteRows) {
      const source = await getSourceDocument('rote', row.id);
      if (source && (await sourceNeedsEmbeddingBackfill('rote', source, config))) {
        await enqueueEmbeddingJob('rote', row.id, row.ownerId, 'upsert', true);
        queued += 1;
      }
    }
    for (const row of articleRows) {
      const source = await getSourceDocument('article', row.id);
      if (source && (await sourceNeedsEmbeddingBackfill('article', source, config))) {
        await enqueueEmbeddingJob('article', row.id, row.ownerId, 'upsert', true);
        queued += 1;
      }
    }

    return { queued };
  } catch (error: any) {
    throw new DatabaseError('Failed to enqueue backfill embedding jobs', error);
  }
}

export async function enqueueBackfillEmbeddingJobsForOwner(
  ownerId: string
): Promise<{ queued: number; skipped: boolean }> {
  try {
    const config = await getStoredAiConfig();
    if (!shouldAutoIndex(config) || !(await isAiEligibleUser(ownerId))) {
      return { queued: 0, skipped: true };
    }

    let queued = 0;
    const roteRows = await db
      .select({ id: rotes.id, ownerId: rotes.authorid })
      .from(rotes)
      .where(eq(rotes.authorid, ownerId));
    const articleRows = await db
      .select({ id: articles.id, ownerId: articles.authorId })
      .from(articles)
      .where(eq(articles.authorId, ownerId));

    for (const row of roteRows) {
      const source = await getSourceDocument('rote', row.id);
      if (source && (await sourceNeedsEmbeddingBackfill('rote', source, config))) {
        await enqueueEmbeddingJob('rote', row.id, row.ownerId, 'upsert', true);
        queued += 1;
      }
    }
    for (const row of articleRows) {
      const source = await getSourceDocument('article', row.id);
      if (source && (await sourceNeedsEmbeddingBackfill('article', source, config))) {
        await enqueueEmbeddingJob('article', row.id, row.ownerId, 'upsert', true);
        queued += 1;
      }
    }

    return { queued, skipped: false };
  } catch (error: any) {
    throw new DatabaseError('Failed to enqueue user backfill embedding jobs', error);
  }
}

export async function getEmbeddingJobStats(): Promise<Record<EmbeddingJobStatus, number>> {
  const rows = (await db.execute(sql`
    SELECT status, COUNT(*)::int AS count
    FROM "embedding_jobs"
    GROUP BY status
  `)) as any[];

  const stats: Record<EmbeddingJobStatus, number> = {
    pending: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
  };
  rows.forEach((row) => {
    if (row.status in stats) {
      stats[row.status as EmbeddingJobStatus] = Number(row.count) || 0;
    }
  });
  return stats;
}
