import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { documentEmbeddings } from '../../../drizzle/schema';
import type { AiConfig } from '../../../types/config';
import { DEFAULT_AI_CONFIG } from '../../ai/providers';
import { normalizeTimeRangeInput, type NormalizedTimeRange } from '../../ai/retrievalPlan';
import db from '../../drizzle';
import { readAiSnapshot } from '../../../embeddings/configStore';
import type { AiSourceType, SemanticSearchResult } from './types';

export const VALID_SOURCE_TYPES = new Set<AiSourceType>(['rote', 'article']);
export const MAX_VECTOR_SEARCH_LIMIT = 50;

export function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeEmbeddingDimensions(value: number): number {
  const dimensions = Number(value);
  if (!Number.isInteger(dimensions) || dimensions <= 0 || dimensions > 2000) {
    throw new Error('Embedding dimensions must be an integer between 1 and 2000');
  }
  return dimensions;
}

export function normalizeLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit)) return 10;
  return Math.min(Math.max(Math.floor(limit), 1), MAX_VECTOR_SEARCH_LIMIT);
}

export function normalizeSearchTimeRange(timeRange?: NormalizedTimeRange | null): {
  timeRange: NormalizedTimeRange | null;
  warnings: string[];
} {
  if (!timeRange) return { timeRange: null, warnings: [] };
  const normalized = normalizeTimeRangeInput(timeRange);
  if (normalized) return { timeRange: normalized, warnings: [] };
  return { timeRange: null, warnings: ['invalid_time_range_ignored'] };
}

export function buildTextArraySql(values: string[]) {
  return sql`ARRAY[${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `
  )}]::text[]`;
}

export function vectorIndexName(dimensions: number, generationId: string): string {
  return `embedding_${generationId.replace(/-/g, '')}_${dimensions}_idx`;
}

export function fallbackAnswer(sources: SemanticSearchResult[]): string {
  if (sources.length === 0) {
    return 'No matching Rote memory was found for this question, so I cannot answer from your notes yet.';
  }
  return 'I found related Rote memory, but the model did not return a usable answer. Please try again or narrow the scope.';
}

export function splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  const cleanText = text.replace(/\r\n/g, '\n').trim();
  if (!cleanText) return [];

  const size = Math.max(500, chunkSize || DEFAULT_AI_CONFIG.indexing.chunkSize);
  const safeOverlap = Math.min(Math.max(overlap || 0, 0), Math.floor(size / 2));
  const chunks: string[] = [];
  let start = 0;

  while (start < cleanText.length) {
    const end = Math.min(start + size, cleanText.length);
    chunks.push(cleanText.slice(start, end).trim());
    if (end >= cleanText.length) break;
    start = Math.max(end - safeOverlap, start + 1);
  }

  return chunks.filter(Boolean);
}

function buildRoteDocument(rote: any): { text: string; metadata: any } {
  const title = rote.title ? `Title: ${rote.title}\n` : '';
  const tags =
    Array.isArray(rote.tags) && rote.tags.length ? `Tags: ${rote.tags.join(', ')}\n` : '';
  return {
    text: `${title}${tags}${rote.content || ''}`.trim(),
    metadata: {
      title: rote.title || '',
      tags: rote.tags || [],
      state: rote.state,
      archived: rote.archived,
      createdAt: rote.createdAt,
      updatedAt: rote.updatedAt,
    },
  };
}

function buildArticleDocument(article: any): { text: string; metadata: any } {
  return {
    text: article.content || '',
    metadata: {
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    },
  };
}

export async function getSourceDocument(
  sourceType: AiSourceType,
  sourceId: string
): Promise<any | null> {
  if (sourceType === 'rote') {
    return db.query.rotes.findFirst({
      where: (tbl, { eq }) => eq(tbl.id, sourceId),
    });
  }

  return db.query.articles.findFirst({
    where: (tbl, { eq }) => eq(tbl.id, sourceId),
  });
}

export function getSourceOwner(sourceType: AiSourceType, source: any): string {
  return sourceType === 'rote' ? source.authorid : source.authorId;
}

export function buildSourceDocument(
  sourceType: AiSourceType,
  source: any
): { text: string; metadata: any } {
  return sourceType === 'rote' ? buildRoteDocument(source) : buildArticleDocument(source);
}

export async function sourceNeedsEmbeddingBackfill(
  sourceType: AiSourceType,
  source: any,
  config: AiConfig
): Promise<boolean> {
  const document = buildSourceDocument(sourceType, source);
  const chunks = splitIntoChunks(
    document.text,
    config.indexing.chunkSize,
    config.indexing.chunkOverlap
  );
  const { state } = await readAiSnapshot();
  const expectedDimensions = state.dimensions;
  if (!state.generationId || !expectedDimensions) return true;
  const sourceId = source.id;
  const rows = await db
    .select({
      chunkIndex: documentEmbeddings.chunkIndex,
      contentHash: documentEmbeddings.contentHash,
      embeddingModel: documentEmbeddings.embeddingModel,
      embeddingDimensions: documentEmbeddings.embeddingDimensions,
    })
    .from(documentEmbeddings)
    .where(
      and(
        eq(documentEmbeddings.sourceType, sourceType),
        eq(documentEmbeddings.sourceId, sourceId),
        eq(documentEmbeddings.generationId, state.generationId)
      )
    );

  if (chunks.length === 0) {
    return rows.length > 0;
  }

  if (rows.length !== chunks.length) {
    return true;
  }

  const expectedByIndex = new Map(
    chunks.map((chunk, index) => [
      index,
      {
        contentHash: hashText(chunk),
        embeddingModel: config.embedding.model,
        embeddingDimensions: expectedDimensions,
      },
    ])
  );

  return rows.some((row) => {
    const expected = expectedByIndex.get(row.chunkIndex);
    return (
      !expected ||
      row.contentHash !== expected.contentHash ||
      row.embeddingModel !== expected.embeddingModel ||
      row.embeddingDimensions !== expected.embeddingDimensions
    );
  });
}
