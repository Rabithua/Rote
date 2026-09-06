import { sql } from 'drizzle-orm';
import type { EmbeddingExecutor, EmbeddingTransaction, IndexState } from './configStore';
import { vectorIndexName } from '../utils/dbMethods/ai/documents';

export function generationMatches(
  state: IndexState,
  fingerprint: string | null,
  dimensions: number | null
) {
  return Boolean(
    state.generationId &&
    fingerprint &&
    dimensions &&
    state.generationFingerprint === fingerprint &&
    state.generationDimensions === dimensions
  );
}

export async function restoreGenerationStatus(
  executor: EmbeddingExecutor,
  state: IndexState,
  fingerprint: string,
  dimensions: number
) {
  if (
    !state.generationReusable ||
    !state.scanComplete ||
    !generationMatches(state, fingerprint, dimensions)
  )
    return null;
  const indexName = vectorIndexName(dimensions, state.generationId!);
  const [status] = await executor.execute(sql`
    SELECT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
      AND c.relname=${indexName} AND i.indisvalid) AS valid,
    EXISTS (SELECT 1 FROM embedding_jobs WHERE "generationId"=${state.generationId} AND status='failed') AS failed,
    (EXISTS (SELECT 1 FROM embedding_jobs WHERE "generationId"=${state.generationId} AND status IN ('pending','running'))
      OR EXISTS (SELECT 1 FROM embedding_source_events)) AS pending
  `);
  if (!status.valid) return null;
  return status.failed
    ? ('failed' as const)
    : status.pending
      ? ('rebuilding' as const)
      : ('ready' as const);
}

export async function revokeGenerationClaims(
  tx: EmbeddingTransaction,
  generationId: string | null
) {
  if (!generationId) return;
  // Retain a fresh successor for every interrupted source. A worker from the
  // old configuration must not become valid again after a round-trip switch.
  await tx.execute(sql`WITH revoked AS (
    UPDATE embedding_jobs SET status='cancelled', "leaseToken"=NULL,
      "leaseExpiresAt"=NULL,"lockedAt"=NULL,"updatedAt"=now()
    WHERE "generationId"=${generationId} AND status='running'
    RETURNING "generationId","sourceType","sourceId","ownerId"
  ) INSERT INTO embedding_jobs ("generationId","sourceType","sourceId","ownerId",action,status)
    SELECT "generationId","sourceType","sourceId","ownerId",'upsert','pending' FROM revoked
    ON CONFLICT DO NOTHING`);
}
