import { canProcessIndex, readAiSnapshot } from '../../../embeddings/configStore';
import { articles, rotes } from '../../../drizzle/schema';
import { eq } from 'drizzle-orm';
import db from '../../drizzle';
import { DatabaseError } from '../common';
import { getStoredAiConfig, isAiEligibleUser, isVectorUsable, shouldAutoIndex } from './config';
import { getSourceDocument, sourceNeedsEmbeddingBackfill } from './documents';
import { enqueueEmbeddingJob, requireReadyGeneration } from '../../../embeddings/queue';
export {
  enqueueEmbeddingJob,
  enqueueEmbeddingJobs,
  deleteEmbeddingsForSource,
  deleteEmbeddingsForOwner,
  getEmbeddingJobStats,
} from '../../../embeddings/queue';

export async function enqueueBackfillEmbeddingJobs(): Promise<{ queued: number }> {
  try {
    await requireReadyGeneration();
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
    const { state } = await readAiSnapshot();
    if (
      (!shouldAutoIndex(config) &&
        !(state.status === 'rebuilding' && canProcessIndex(config, state))) ||
      !(await isAiEligibleUser(ownerId))
    ) {
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
