import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { documentEmbeddings, embeddingIndexState, embeddingJobs } from '../drizzle/schema';
import type { AiConfig } from '../types/config';
import db from '../utils/drizzle';
import { vectorIndexName } from '../utils/dbMethods/ai/documents';
import type { EmbeddingExecutor, EmbeddingTransaction, IndexState } from './configStore';
import { embeddingFingerprint } from './contract';
import { EmbeddingError } from './errors';

export async function canInitializeIndex(state: IndexState, executor: EmbeddingExecutor = db) {
  if (state.generationId) return false;
  // Retained legacy vectors and jobs require the existing recovery/rebuild workflow.
  const [vectors] = await executor
    .select({ id: documentEmbeddings.id })
    .from(documentEmbeddings)
    .limit(1);
  if (vectors) return false;
  const [job] = await executor.select({ id: embeddingJobs.id }).from(embeddingJobs).limit(1);
  return !job;
}

export async function createIndexGeneration(
  tx: EmbeddingTransaction,
  config: AiConfig,
  dimensions: number
) {
  const [extension] = await tx.execute(sql`
    SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') AS available
  `);
  if (!extension.available) throw new EmbeddingError('embedding_database_unavailable', 503);
  await tx.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
  const generationId = randomUUID();
  const indexName = vectorIndexName(dimensions, generationId);
  await tx.execute(
    sql.raw(`CREATE INDEX "${indexName}" ON "document_embeddings"
    USING hnsw (("embedding"::vector(${dimensions})) vector_cosine_ops)
    WHERE "generationId" = '${generationId}'::uuid AND "embeddingDimensions" = ${dimensions}`)
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
  const fingerprint = embeddingFingerprint(config);
  await tx
    .update(embeddingIndexState)
    .set({
      status: 'rebuilding',
      fingerprint,
      dimensions,
      generationId,
      generationFingerprint: fingerprint,
      generationDimensions: dimensions,
      generationReusable: false,
      scanSource: 'rote',
      scanCursor: null,
      scanComplete: false,
      errorCode: null,
      errorDetails: null,
      validatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(embeddingIndexState.id, 1));
}
