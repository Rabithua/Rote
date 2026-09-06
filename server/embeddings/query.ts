import { and, eq } from 'drizzle-orm';
import { embeddingIndexState } from '../drizzle/schema';
import db from '../utils/drizzle';
import type { AiConfig } from '../types/config';
import { createEmbedding } from './client';
import { EmbeddingError, isEmbeddingContractFailure } from './errors';
import { requireReadyGeneration } from './queue';
import { getPgvectorStatus } from '../utils/dbMethods/ai/vector';

export async function createQueryEmbedding(
  config: AiConfig,
  generationId: string,
  dimensions: number,
  input: string
) {
  if (!(await getPgvectorStatus()).ready)
    throw new EmbeddingError('embedding_rebuild_required', 503);
  try {
    const result = await createEmbedding(config.embedding, input, {
      expectedDimensions: dimensions,
    });
    const current = await requireReadyGeneration();
    if (current.state.generationId !== generationId)
      throw new EmbeddingError('embedding_rebuild_required', 503);
    return result;
  } catch (error) {
    if (error instanceof EmbeddingError && isEmbeddingContractFailure(error.code)) {
      await db
        .update(embeddingIndexState)
        .set({
          status: 'needs_validation',
          fingerprint: null,
          generationReusable: false,
          errorCode: error.code,
          errorDetails: error.details,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(embeddingIndexState.id, 1),
            eq(embeddingIndexState.generationId, generationId),
            eq(embeddingIndexState.status, 'ready')
          )
        );
    }
    throw error;
  }
}
