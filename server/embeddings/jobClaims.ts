import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { embeddingIndexState, embeddingJobs, type EmbeddingJob } from '../drizzle/schema';
import db from '../utils/drizzle';
import { canProcessIndex, lockIndexState, readAiSnapshot } from './configStore';
import { EmbeddingError, isEmbeddingContractFailure } from './errors';

export const LEASE_MS = 120_000;
export async function claimEmbeddingJob() {
  return db.transaction(async (tx) => {
    await lockIndexState(tx);
    const { config, state } = await readAiSnapshot(tx);
    if (!canProcessIndex(config, state) || config.indexing.paused) return null;
    const rows = await tx.execute(sql`
      SELECT j.id FROM embedding_jobs j WHERE j."generationId" = ${state.generationId}
      AND ((j.status = 'pending' AND j."nextAttemptAt" <= now() AND NOT EXISTS (
        SELECT 1 FROM embedding_jobs r WHERE r."generationId" = j."generationId"
        AND r."sourceType" = j."sourceType" AND r."sourceId" = j."sourceId" AND r.status = 'running'
      )) OR (j.status = 'running' AND j."leaseExpiresAt" < now()))
      ORDER BY j."createdAt", j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED
    `);
    if (!rows[0]) return null;
    const [job] = await tx
      .update(embeddingJobs)
      .set({
        status: 'running',
        leaseToken: randomUUID(),
        leaseExpiresAt: new Date(Date.now() + LEASE_MS),
        lockedAt: new Date(),
        attempts: sql`${embeddingJobs.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(embeddingJobs.id, rows[0].id as string))
      .returning();
    return { job, config, state };
  });
}
export async function renewClaim(job: EmbeddingJob) {
  const rows = await db
    .update(embeddingJobs)
    .set({ leaseExpiresAt: new Date(Date.now() + LEASE_MS), updatedAt: new Date() })
    .where(
      and(
        eq(embeddingJobs.id, job.id),
        eq(embeddingJobs.status, 'running'),
        eq(embeddingJobs.leaseToken, job.leaseToken!),
        sql`${embeddingJobs.leaseExpiresAt} > now()`,
        sql`EXISTS (SELECT 1 FROM embedding_index_state eis WHERE eis.id = 1 AND eis."generationId" = ${job.generationId} AND eis.status IN ('ready', 'rebuilding'))`
      )
    )
    .returning({ id: embeddingJobs.id });
  if (!rows.length) throw new EmbeddingError('embedding_lease_lost', 409);
}
export async function failClaim(job: EmbeddingJob, error: unknown, maxRetries: number) {
  const failure =
    error instanceof EmbeddingError ? error : new EmbeddingError('embedding_job_failed', 503);
  await db.transaction(async (tx) => {
    const state = await lockIndexState(tx);
    const [current] = await tx
      .select()
      .from(embeddingJobs)
      .where(
        and(
          eq(embeddingJobs.id, job.id),
          eq(embeddingJobs.leaseToken, job.leaseToken!),
          eq(embeddingJobs.status, 'running')
        )
      )
      .for('update');
    if (!current || !current.leaseExpiresAt || current.leaseExpiresAt.getTime() <= Date.now())
      return;
    const [successor] = await tx
      .select({ id: embeddingJobs.id })
      .from(embeddingJobs)
      .where(
        and(
          eq(embeddingJobs.generationId, job.generationId!),
          eq(embeddingJobs.sourceType, job.sourceType),
          eq(embeddingJobs.sourceId, job.sourceId),
          eq(embeddingJobs.status, 'pending')
        )
      )
      .limit(1);
    const retry = failure.retryable && job.attempts < maxRetries;
    const stale = state.generationId !== job.generationId;
    await tx
      .update(embeddingJobs)
      .set({
        status: stale || successor ? 'cancelled' : retry ? 'pending' : 'failed',
        error: failure.code,
        leaseToken: null,
        leaseExpiresAt: null,
        lockedAt: null,
        nextAttemptAt: new Date(Date.now() + Math.min(60_000, 1000 * 2 ** job.attempts)),
        updatedAt: new Date(),
      })
      .where(eq(embeddingJobs.id, job.id));
    if (stale) return;
    const contractFailure = isEmbeddingContractFailure(failure.code);
    if (state.status === 'ready' && contractFailure) {
      await tx
        .update(embeddingIndexState)
        .set({
          status: 'needs_validation',
          fingerprint: null,
          generationReusable: false,
          errorCode: failure.code,
          errorDetails: failure.details,
          updatedAt: new Date(),
        })
        .where(eq(embeddingIndexState.id, 1));
    } else if (state.status === 'rebuilding' && !retry && (!successor || contractFailure)) {
      await tx
        .update(embeddingIndexState)
        .set({
          status: 'failed',
          ...(contractFailure ? { generationReusable: false } : {}),
          errorCode: failure.code,
          errorDetails: failure.details,
          updatedAt: new Date(),
        })
        .where(eq(embeddingIndexState.id, 1));
    }
  });
}
