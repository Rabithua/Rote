import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { documentEmbeddings, embeddingIndexState, embeddingSourceEvents } from '../drizzle/schema';
import db from '../utils/drizzle';
import { vectorIndexName } from '../utils/dbMethods/ai/documents';
import { getPgvectorStatus } from '../utils/dbMethods/ai/vector';
import { createEmbedding } from './client';
import { lockIndexState, readAiSnapshot } from './configStore';
import { embeddingFingerprint, validateVector } from './contract';
import { EmbeddingError } from './errors';
import { auditLegacyIndex } from './legacyIndexAudit';
import { queueSource } from './queue';

export type LegacyRecoveryOptions = {
  revision: number;
  confirmedProvider: string;
  apply?: boolean;
  maxIncrementalSources?: number;
};

// Explicit maintenance operation, never called by migration, save or worker.
// A matching model name cannot establish the origin of unversioned vectors.
export async function recoverLegacyIndex(options: LegacyRecoveryOptions) {
  const before = await readAiSnapshot();
  const assertRecoverable = (snapshot: typeof before) => {
    if (snapshot.state.revision !== options.revision)
      throw new EmbeddingError('embedding_revision_conflict', 409);
    if (
      !options.confirmedProvider ||
      snapshot.config.embedding.providerId !== options.confirmedProvider ||
      !snapshot.config.enabled ||
      !snapshot.config.vectorEnabled ||
      snapshot.state.status !== 'needs_rebuild' ||
      snapshot.state.generationId ||
      !snapshot.state.dimensions ||
      snapshot.state.fingerprint !== embeddingFingerprint(snapshot.config)
    ) {
      throw new EmbeddingError('embedding_legacy_recovery_unavailable', 409);
    }
  };
  assertRecoverable(before);
  if (!(await getPgvectorStatus()).installed)
    throw new EmbeddingError('embedding_database_unavailable', 503);
  const preview = await db.transaction(async (tx) => {
    await lockIndexState(tx);
    const snapshot = await readAiSnapshot(tx);
    assertRecoverable(snapshot);
    return auditLegacyIndex(tx, snapshot.config, snapshot.state.dimensions!);
  });
  if (!preview.reusable.length)
    throw new EmbeddingError('embedding_legacy_recovery_unavailable', 409);
  // Samples are a sanity check in addition to explicit operator provenance,
  // never an automatic inference of provider identity.
  const sampleIndexes = [
    ...new Set([0, Math.floor(preview.reusable.length / 2), preview.reusable.length - 1]),
  ];
  for (const index of sampleIndexes) {
    const row = preview.reusable[index];
    const old = validateVector(JSON.parse(row.embedding), before.state.dimensions!);
    const { embedding: current } = await createEmbedding(before.config.embedding, row.text, {
      expectedDimensions: old.length,
    });
    let dot = 0,
      oldNorm = 0,
      newNorm = 0,
      error = 0;
    for (let i = 0; i < old.length; i++) {
      dot += old[i] * current[i];
      oldNorm += old[i] ** 2;
      newNorm += current[i] ** 2;
      error += (old[i] - current[i]) ** 2;
    }
    if (dot / Math.sqrt(oldNorm * newNorm) < 0.99999 || Math.sqrt(error / oldNorm) > 0.01)
      throw new EmbeddingError('embedding_legacy_sample_mismatch', 409);
  }
  return db.transaction(async (tx) => {
    await lockIndexState(tx);
    const snapshot = await readAiSnapshot(tx);
    assertRecoverable(snapshot);
    // Re-audit under locks after provider requests. All existing sources remain
    // locked until registration commits; concurrent inserts leave durable events.
    const events = await tx.select().from(embeddingSourceEvents);
    const audit = await auditLegacyIndex(tx, snapshot.config, snapshot.state.dimensions!);
    const report = {
      revision: snapshot.state.revision,
      legacyChunks: audit.legacyChunks,
      reusableChunks: audit.reusable.length,
      incrementalSources: audit.pending.length,
      eligibleSources: audit.sources,
      verifiedSamples: sampleIndexes.length,
    };
    if (!options.apply) return { ...report, applied: false, generationId: null };
    if (
      !Number.isInteger(options.maxIncrementalSources ?? 0) ||
      (options.maxIncrementalSources ?? 0) < audit.pending.length
    )
      throw new EmbeddingError('embedding_legacy_incremental_limit', 409, report);
    if (!audit.reusable.length)
      throw new EmbeddingError('embedding_legacy_recovery_unavailable', 409);
    const generationId = randomUUID();
    // Keep historical rows untouched. Copy validated values without model calls.
    for (let offset = 0; offset < audit.reusable.length; offset += 100) {
      await tx
        .insert(documentEmbeddings)
        .values(
          audit.reusable
            .slice(offset, offset + 100)
            .map((row) => ({ ...row, id: randomUUID(), generationId }))
        );
    }
    const indexName = vectorIndexName(snapshot.state.dimensions!, generationId);
    await tx.execute(
      sql.raw(
        `CREATE INDEX "${indexName}" ON document_embeddings USING hnsw ((embedding::vector(${snapshot.state.dimensions})) vector_cosine_ops) WHERE "generationId"='${generationId}'::uuid AND "embeddingDimensions"=${snapshot.state.dimensions}`
      )
    );
    for (const source of audit.pending)
      await queueSource(tx, generationId, source.sourceType, source.sourceId, source.ownerId);
    // Only events visible to this audit are superseded. Later commits stay queued.
    const superseded = events
      .filter(
        (event) =>
          event.action === 'upsert' &&
          audit.auditedSources.has(`${event.sourceType}:${event.sourceId}`)
      )
      .map((event) => event.id);
    if (superseded.length)
      await tx.delete(embeddingSourceEvents).where(inArray(embeddingSourceEvents.id, superseded));
    await tx
      .update(embeddingIndexState)
      .set({
        generationId,
        generationFingerprint: snapshot.state.fingerprint,
        generationDimensions: snapshot.state.dimensions,
        generationReusable: false,
        status: 'rebuilding',
        scanSource: 'article',
        scanCursor: null,
        scanComplete: true,
        errorCode: null,
        errorDetails: null,
        updatedAt: new Date(),
      })
      .where(eq(embeddingIndexState.id, 1));
    return { ...report, applied: true, generationId };
  });
}
