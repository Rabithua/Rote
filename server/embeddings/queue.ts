import { and, eq, inArray, sql } from 'drizzle-orm';
import { documentEmbeddings, embeddingJobs } from '../drizzle/schema';
import db from '../utils/drizzle';
import { hasCapability } from '../authz/capabilityService';
import {
  canProcessIndex,
  type IndexState,
  lockIndexState,
  readAiSnapshot,
  type EmbeddingTransaction,
} from './configStore';
import type { AiConfig } from '../types/config';
import { EmbeddingError } from './errors';
import type {
  AiSourceType,
  EmbeddingJobAction,
  EmbeddingJobStatus,
} from '../utils/dbMethods/ai/types';

export function canQueueIndex(config: AiConfig, state: IndexState) {
  return (
    ((config.enabled && config.vectorEnabled) ||
      state.status === 'rebuilding' ||
      state.status === 'failed') &&
    state.generationId !== null &&
    state.dimensions !== null &&
    ['ready', 'rebuilding', 'failed'].includes(state.status)
  );
}
export async function queueSource(
  tx: EmbeddingTransaction,
  generationId: string,
  sourceType: AiSourceType,
  sourceId: string,
  ownerId: string
) {
  await tx
    .update(embeddingJobs)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(
      and(
        eq(embeddingJobs.generationId, generationId),
        eq(embeddingJobs.sourceType, sourceType),
        eq(embeddingJobs.sourceId, sourceId),
        eq(embeddingJobs.status, 'failed')
      )
    );
  // A pending successor is retained while a previous revision is running.
  await tx
    .insert(embeddingJobs)
    .values({ generationId, sourceType, sourceId, ownerId, action: 'upsert', status: 'pending' })
    .onConflictDoNothing();
}
export async function enqueueEmbeddingJob(
  sourceType: AiSourceType,
  sourceId: string,
  ownerId: string,
  action: EmbeddingJobAction = 'upsert',
  force = false
) {
  if (!['rote', 'article'].includes(sourceType)) return;
  if (action === 'delete' || !(await hasCapability(ownerId, 'ai.chat'))) {
    await deleteEmbeddingsForSource(sourceType, sourceId);
    return;
  }
  await db.transaction(async (tx) => {
    await lockIndexState(tx);
    const { config, state } = await readAiSnapshot(tx);
    if (!canQueueIndex(config, state)) return;
    if (!force && !config.autoIndexEnabled && state.status === 'ready') return;
    await queueSource(tx, state.generationId!, sourceType, sourceId, ownerId);
  });
}
export async function enqueueEmbeddingJobs(
  sourceType: AiSourceType,
  sourceIds: string[],
  ownerId: string
) {
  for (const id of new Set(sourceIds)) await enqueueEmbeddingJob(sourceType, id, ownerId);
}
export async function deleteEmbeddingsForSource(sourceType: AiSourceType, sourceId: string) {
  await db.transaction(async (tx) => {
    await lockIndexState(tx);
    await tx
      .delete(documentEmbeddings)
      .where(
        and(
          eq(documentEmbeddings.sourceType, sourceType),
          eq(documentEmbeddings.sourceId, sourceId)
        )
      );
    await tx
      .update(embeddingJobs)
      .set({ status: 'cancelled', leaseToken: null, leaseExpiresAt: null, lockedAt: null })
      .where(
        and(
          eq(embeddingJobs.sourceType, sourceType),
          eq(embeddingJobs.sourceId, sourceId),
          inArray(embeddingJobs.status, ['pending', 'running', 'failed'])
        )
      );
  });
}
export async function deleteEmbeddingsForOwner(ownerId: string) {
  await db.transaction(async (tx) => {
    await lockIndexState(tx);
    await tx.delete(documentEmbeddings).where(eq(documentEmbeddings.ownerId, ownerId));
    await tx.delete(embeddingJobs).where(eq(embeddingJobs.ownerId, ownerId));
  });
}
export async function getEmbeddingJobStats(): Promise<Record<EmbeddingJobStatus, number>> {
  const { state } = await readAiSnapshot();
  const rows = await db.execute(
    sql`SELECT status, COUNT(*)::int AS count FROM "embedding_jobs" WHERE "generationId" = ${state.generationId} GROUP BY status`
  );
  const stats: Record<EmbeddingJobStatus, number> = {
    pending: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const row of rows)
    if ((row.status as string) in stats)
      stats[row.status as EmbeddingJobStatus] = Number(row.count);
  return stats;
}
export async function requireReadyGeneration() {
  const snapshot = await readAiSnapshot();
  if (!canProcessIndex(snapshot.config, snapshot.state) || snapshot.state.status !== 'ready')
    throw new EmbeddingError('embedding_rebuild_required', 503);
  return snapshot;
}
