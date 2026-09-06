import { and, eq, sql } from 'drizzle-orm';
import {
  articles,
  documentEmbeddings,
  embeddingJobs,
  rotes,
  type EmbeddingJob,
  type NewDocumentEmbedding,
} from '../drizzle/schema';
import { hasCapability } from '../authz/capabilityService';
import type { AiConfig } from '../types/config';
import db from '../utils/drizzle';
import {
  buildSourceDocument,
  getSourceDocument,
  getSourceOwner,
  hashText,
  splitIntoChunks,
} from '../utils/dbMethods/ai/documents';
import { logAiTokenUsage } from '../utils/dbMethods/aiToken';
import type { AiSourceType } from '../utils/dbMethods/ai/types';
import { createEmbedding } from './client';
import { canProcessIndex, lockIndexState, readAiSnapshot } from './configStore';
import { renewClaim } from './jobClaims';
import { deleteEmbeddingsForSource, queueSource } from './queue';

export async function processEmbeddingJob(job: EmbeddingJob, config: AiConfig, dimensions: number) {
  const sourceType = job.sourceType as AiSourceType;
  const source = await getSourceDocument(sourceType, job.sourceId);
  if (!source || !(await hasCapability(getSourceOwner(sourceType, source), 'ai.chat'))) {
    await deleteEmbeddingsForSource(sourceType, job.sourceId);
    return;
  }
  const ownerId = getSourceOwner(sourceType, source);
  const document = buildSourceDocument(sourceType, source);
  const sourceHash = hashText(JSON.stringify({ ownerId, document }));
  const chunks = splitIntoChunks(
    document.text,
    config.indexing.chunkSize,
    config.indexing.chunkOverlap
  );
  const vectors: NewDocumentEmbedding[] = [];
  for (const [chunkIndex, chunk] of chunks.entries()) {
    await renewClaim(job);
    const result = await createEmbedding(config.embedding, chunk, {
      expectedDimensions: dimensions,
    });
    if (result.usage)
      await logAiTokenUsage({
        userid: ownerId,
        model: config.embedding.model,
        type: 'embedding',
        promptTokens: result.usage.prompt_tokens,
        completionTokens: 0,
        totalTokens: result.usage.total_tokens,
      });
    vectors.push({
      generationId: job.generationId,
      ownerId,
      sourceType,
      sourceId: job.sourceId,
      chunkIndex,
      contentHash: hashText(chunk),
      embeddingModel: config.embedding.model,
      embeddingDimensions: dimensions,
      embedding: JSON.stringify(result.embedding),
      text: chunk,
      metadata: document.metadata,
    });
  }
  await db.transaction(async (tx) => {
    await lockIndexState(tx);
    const snapshot = await readAiSnapshot(tx);
    const [current] = await tx
      .select()
      .from(embeddingJobs)
      .where(
        and(
          eq(embeddingJobs.id, job.id),
          eq(embeddingJobs.status, 'running'),
          eq(embeddingJobs.leaseToken, job.leaseToken!),
          sql`${embeddingJobs.leaseExpiresAt} > now()`
        )
      )
      .for('update');
    if (!current) return;
    if (
      snapshot.state.generationId !== job.generationId ||
      !canProcessIndex(snapshot.config, snapshot.state)
    ) {
      await tx
        .update(embeddingJobs)
        .set({ status: 'cancelled', leaseToken: null, leaseExpiresAt: null, lockedAt: null })
        .where(eq(embeddingJobs.id, job.id));
      return;
    }
    const table = sourceType === 'rote' ? rotes : articles;
    const [liveSource] = await tx
      .select()
      .from(table)
      .where(eq(table.id, job.sourceId))
      .for('share');
    const liveOwner = liveSource ? getSourceOwner(sourceType, liveSource) : null;
    const eligible = liveOwner ? await hasCapability(liveOwner, 'ai.chat') : false;
    const liveHash = liveSource
      ? hashText(
          JSON.stringify({
            ownerId: liveOwner,
            document: buildSourceDocument(sourceType, liveSource),
          })
        )
      : null;
    if (liveSource && eligible && liveHash !== sourceHash) {
      await queueSource(tx, job.generationId!, sourceType, job.sourceId, liveOwner!);
    } else {
      await tx
        .delete(documentEmbeddings)
        .where(
          and(
            eq(documentEmbeddings.sourceType, sourceType),
            eq(documentEmbeddings.sourceId, job.sourceId),
            liveSource && eligible
              ? eq(documentEmbeddings.generationId, job.generationId!)
              : undefined
          )
        );
      if (liveSource && eligible && vectors.length)
        await tx.insert(documentEmbeddings).values(vectors);
    }
    await tx
      .update(embeddingJobs)
      .set({
        status: liveHash === sourceHash && eligible ? 'succeeded' : 'cancelled',
        error: null,
        leaseToken: null,
        leaseExpiresAt: null,
        lockedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(embeddingJobs.id, job.id));
  });
}
