import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AiConfig } from '../types/config';
import { EmbeddingError } from './errors';

export const MAX_EMBEDDING_DIMENSIONS = 2000;
export const embeddingOutputSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('native') }),
  z.strictObject({
    mode: z.literal('dimensions'),
    dimensions: z.number().int().min(1).max(MAX_EMBEDDING_DIMENSIONS),
  }),
]);

export function validateVector(value: unknown, expectedDimensions?: number): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new EmbeddingError('embedding_response_invalid');
  }
  if (value.length > MAX_EMBEDDING_DIMENSIONS) {
    throw new EmbeddingError('embedding_dimensions_limit', 422, {
      actual: value.length,
      limit: MAX_EMBEDDING_DIMENSIONS,
    });
  }
  let norm = 0;
  const vector = value.map((item: unknown) => {
    if (typeof item !== 'number' || !Number.isFinite(item) || !Number.isFinite(Math.fround(item))) {
      throw new EmbeddingError('embedding_response_invalid');
    }
    norm += Math.fround(item) ** 2;
    return item;
  });
  if (!Number.isFinite(norm) || norm === 0) throw new EmbeddingError('embedding_response_invalid');
  if (expectedDimensions !== undefined && vector.length !== expectedDimensions) {
    throw new EmbeddingError('embedding_dimensions_mismatch', 422, {
      expected: expectedDimensions,
      actual: vector.length,
    });
  }
  return vector;
}

export function embeddingFingerprint(config: AiConfig): string {
  const { providerId, baseUrl, model, output, apiFormat } = config.embedding;
  return createHash('sha256')
    .update(
      JSON.stringify({
        providerId,
        baseUrl: baseUrl.trim().replace(/\/+$/, ''),
        model: model.trim(),
        apiFormat: apiFormat || 'openai_compatible',
        output:
          output.mode === 'native'
            ? { mode: 'native' }
            : { mode: 'dimensions', dimensions: output.dimensions },
        chunkSize: config.indexing.chunkSize,
        chunkOverlap: config.indexing.chunkOverlap,
        textVersion: 1,
      })
    )
    .digest('hex');
}
