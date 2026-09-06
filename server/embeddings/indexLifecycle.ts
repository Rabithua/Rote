import { randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  documentEmbeddings,
  embeddingIndexState,
  embeddingJobs,
  embeddingSourceEvents,
} from '../drizzle/schema';
import db from '../utils/drizzle';
import { vectorIndexName } from '../utils/dbMethods/ai/documents';
import { getPgvectorStatus } from '../utils/dbMethods/ai/vector';
import { testEmbeddingProvider } from './client';
import { lockIndexState, readAiSnapshot } from './configStore';
import { embeddingFingerprint } from './contract';
import { EmbeddingError, isEmbeddingContractFailure } from './errors';

export async function startIndexRebuild(revision: unknown) {
  const before = await readAiSnapshot();
  if (revision !== before.state.revision)
    throw new EmbeddingError('embedding_revision_conflict', 409);
  if (before.state.status === 'rebuilding') return getPgvectorStatus();
  if (!before.config.enabled || !before.config.vectorEnabled)
    throw new EmbeddingError('embedding_disabled', 409);
  const status = await getPgvectorStatus();
  if (!status.installed) throw new EmbeddingError('embedding_database_unavailable', 503);
  const verified = await testEmbeddingProvider(before.config.embedding);
  await db.transaction(async (tx) => {
    const state = await lockIndexState(tx);
    if (state.revision !== revision) throw new EmbeddingError('embedding_revision_conflict', 409);
    if (state.status === 'rebuilding') return;
    const generationId = randomUUID();
    const indexName = vectorIndexName(verified.dimensions, generationId);
    await tx.execute(
      sql.raw(`CREATE INDEX "${indexName}" ON "document_embeddings"
      USING hnsw (("embedding"::vector(${verified.dimensions})) vector_cosine_ops)
      WHERE "generationId" = '${generationId}'::uuid AND "embeddingDimensions" = ${verified.dimensions}`)
    );
    await tx
      .update(embeddingJobs)
      .set({
        status: 'cancelled',
        leaseToken: null,
        leaseExpiresAt: null,
        lockedAt: null,
        updatedAt: new Date(),
      })
      .where(inArray(embeddingJobs.status, ['pending', 'running']));
    await tx
      .update(embeddingIndexState)
      .set({
        status: 'rebuilding',
        fingerprint: embeddingFingerprint(before.config),
        dimensions: verified.dimensions,
        generationId,
        scanSource: 'rote',
        scanCursor: null,
        scanComplete: false,
        errorCode: null,
        errorDetails: null,
        validatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(embeddingIndexState.id, 1));
  });
  return getPgvectorStatus();
}

export async function retryFailedEmbeddingJobs() {
  return db.transaction(async (tx) => {
    const state = await lockIndexState(tx);
    if (
      isEmbeddingContractFailure(state.errorCode) ||
      !state.generationId ||
      !['failed', 'ready', 'rebuilding'].includes(state.status)
    ) {
      throw new EmbeddingError('embedding_rebuild_required', 409);
    }
    // Keep only the newest failed attempt per source when no pending successor exists.
    await tx.execute(sql`WITH ranked AS (
      SELECT id, row_number() OVER (PARTITION BY "sourceType", "sourceId" ORDER BY "createdAt" DESC, id DESC) AS rank
      FROM embedding_jobs WHERE status = 'failed' AND "generationId" = ${state.generationId}
    ) UPDATE embedding_jobs f SET status = 'cancelled'
      FROM ranked r WHERE r.id = f.id AND (r.rank > 1 OR EXISTS (
        SELECT 1 FROM embedding_jobs p WHERE p."generationId" = f."generationId"
        AND p."sourceType" = f."sourceType" AND p."sourceId" = f."sourceId" AND p.status = 'pending'))`);
    const rows = await tx
      .update(embeddingJobs)
      .set({
        status: 'pending',
        attempts: 0,
        error: null,
        leaseToken: null,
        leaseExpiresAt: null,
        lockedAt: null,
        nextAttemptAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(embeddingJobs.generationId, state.generationId), eq(embeddingJobs.status, 'failed'))
      )
      .returning({ id: embeddingJobs.id });
    if (state.status === 'failed')
      await tx
        .update(embeddingIndexState)
        .set({ status: 'rebuilding', errorCode: null, errorDetails: null, updatedAt: new Date() })
        .where(eq(embeddingIndexState.id, 1));
    return { retried: rows.length };
  });
}

export async function clearAllEmbeddings() {
  await db.transaction(async (tx) => {
    const state = await lockIndexState(tx);
    await tx.delete(documentEmbeddings);
    await tx.delete(embeddingJobs);
    await tx.delete(embeddingSourceEvents);
    await tx
      .update(embeddingIndexState)
      .set({
        status: state.dimensions ? 'needs_rebuild' : 'needs_validation',
        generationId: null,
        scanComplete: false,
        scanCursor: null,
        errorCode: null,
        errorDetails: null,
        updatedAt: new Date(),
      })
      .where(eq(embeddingIndexState.id, 1));
  });
}

export async function finishIndexRebuild() {
  const status = await getPgvectorStatus();
  if (!status.indexName) return;
  await db.transaction(async (tx) => {
    const state = await lockIndexState(tx);
    if (
      state.status !== 'rebuilding' ||
      !state.scanComplete ||
      state.generationId !== status.generationId
    )
      return;
    const [outstanding] = await tx
      .select({ id: embeddingJobs.id })
      .from(embeddingJobs)
      .where(
        and(
          eq(embeddingJobs.generationId, state.generationId!),
          inArray(embeddingJobs.status, ['pending', 'running', 'failed'])
        )
      )
      .limit(1);
    if (outstanding) return;
    const [event] = await tx
      .select({ id: embeddingSourceEvents.id })
      .from(embeddingSourceEvents)
      .limit(1);
    if (event) return;
    await tx
      .update(embeddingIndexState)
      .set({ status: 'ready', errorCode: null, errorDetails: null, updatedAt: new Date() })
      .where(eq(embeddingIndexState.id, 1));
  });
}
