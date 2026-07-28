import { sql } from 'drizzle-orm';
import type { SecurityConfig } from '../../../types/config';
import { createEmbedding, vectorToLiteral } from '../../ai/client';
import { getGlobalConfig } from '../../config';
import db from '../../drizzle';
import { logAiTokenUsage } from '../aiToken';
import { subjectIsVisibleToViewer } from '../userBlock';
import { getStoredAiConfig, isVectorUsable } from './config';
import {
  buildTextArraySql,
  normalizeEmbeddingDimensions,
  normalizeLimit,
  normalizeSearchTimeRange,
  VALID_SOURCE_TYPES,
} from './documents';
import type {
  AiSourceType,
  NormalizedTimeRange,
  RetrievalDateField,
  SemanticSearchResult,
} from './types';

export async function semanticSearch(params: {
  query: string;
  ownerId?: string;
  viewerId?: string;
  scope?: 'mine' | 'public';
  sourceTypes?: AiSourceType[];
  timeRange?: NormalizedTimeRange | null;
  dateField?: RetrievalDateField;
  tags?: { include?: string[]; exclude?: string[]; match?: 'any' | 'all' };
  semanticScope?: string[];
  state?: 'private' | 'public' | 'all';
  archived?: boolean | null;
  limit?: number;
  exclude?: { sourceType: AiSourceType; sourceId: string };
  excludeIds?: string[];
}): Promise<SemanticSearchResult[]> {
  const config = await getStoredAiConfig();
  if (!isVectorUsable(config)) {
    throw new Error('AI vector search is disabled');
  }
  if (params.scope === 'public' && !config.publicExploreVectorEnabled) {
    throw new Error('Public semantic search is disabled');
  }

  const dimensions = normalizeEmbeddingDimensions(config.embedding.dimensions);
  const limit = normalizeLimit(params.limit);
  const { timeRange } = normalizeSearchTimeRange(params.timeRange);
  const dateField = params.dateField === 'updatedAt' ? 'updatedAt' : 'createdAt';
  const queryText = [params.query, ...(params.semanticScope || [])].filter(Boolean).join('\n');

  let queryEmbedding: number[];
  let usage: { prompt_tokens: number; total_tokens: number } | undefined;
  if (queryText) {
    const result = await createEmbedding(config.embedding, queryText);
    queryEmbedding = result.embedding;
    usage = result.usage;
  } else {
    const result = await createEmbedding(config.embedding, 'all notes');
    queryEmbedding = result.embedding;
    usage = result.usage;
  }
  if (usage && params.ownerId) {
    await logAiTokenUsage({
      userid: params.ownerId,
      model: config.embedding.model,
      type: 'embedding',
      promptTokens: usage.prompt_tokens,
      completionTokens: 0,
      totalTokens: usage.total_tokens,
    });
  }
  if (queryEmbedding.length !== dimensions) {
    throw new Error(
      `Embedding dimensions mismatch: expected ${dimensions}, got ${queryEmbedding.length}`
    );
  }

  const securityConfig = getGlobalConfig<SecurityConfig>('security');
  const requireVerifiedEmailForExplore = securityConfig?.requireVerifiedEmailForExplore === true;
  const sourceTypes = Array.from(
    new Set(
      (params.sourceTypes || ['rote', 'article']).filter((type) => VALID_SOURCE_TYPES.has(type))
    )
  );
  const vectorLiteral = vectorToLiteral(queryEmbedding);
  const sourceTypeSql =
    sourceTypes.length === 1
      ? sql`AND de."sourceType" = ${sourceTypes[0]}`
      : sourceTypes.length === 2
        ? sql``
        : sql`AND false`;
  const excludeSql = params.exclude
    ? sql`AND NOT (de."sourceType" = ${params.exclude.sourceType} AND de."sourceId" = ${params.exclude.sourceId})`
    : sql``;
  const excludeIdsSql =
    params.excludeIds && params.excludeIds.length > 0
      ? sql`AND NOT ((de."sourceType" || ':' || de."sourceId") = ANY(ARRAY[${sql.join(
          params.excludeIds.map((id) => sql`${id}`),
          sql`, `
        )}]::text[]))`
      : sql``;
  const tags = {
    include: params.tags?.include?.filter(Boolean) || [],
    exclude: params.tags?.exclude?.filter(Boolean) || [],
    match: params.tags?.match === 'all' ? 'all' : 'any',
  };
  const hasTagFilter = tags.include.length > 0 || tags.exclude.length > 0;
  const includeTagsSql =
    tags.include.length > 0
      ? tags.match === 'all'
        ? sql`AND r."tags" @> ${buildTextArraySql(tags.include)}`
        : sql`AND r."tags" && ${buildTextArraySql(tags.include)}`
      : sql``;
  const excludeTagsSql =
    tags.exclude.length > 0 ? sql`AND NOT (r."tags" && ${buildTextArraySql(tags.exclude)})` : sql``;
  const tagFilterSql = hasTagFilter
    ? sql`
      AND de."sourceType" = 'rote'
      AND r."id" IS NOT NULL
      ${includeTagsSql}
      ${excludeTagsSql}
    `
    : sql``;
  const stateSql =
    params.state && params.state !== 'all'
      ? sql`AND de."sourceType" = 'rote' AND r."state" = ${params.state}`
      : sql``;
  const archivedSql =
    typeof params.archived === 'boolean'
      ? sql`AND de."sourceType" = 'rote' AND r."archived" = ${params.archived}`
      : sql``;
  const timeRangeSql = timeRange
    ? sql`
      AND (
        (de."sourceType" = 'rote' AND r.${sql.raw(`"${dateField}"`)} >= ${timeRange.from}::timestamptz AND r.${sql.raw(`"${dateField}"`)} <= ${timeRange.to}::timestamptz)
        OR
        (de."sourceType" = 'article' AND a.${sql.raw(`"${dateField}"`)} >= ${timeRange.from}::timestamptz AND a.${sql.raw(`"${dateField}"`)} <= ${timeRange.to}::timestamptz)
      )
    `
    : sql``;
  const liveSourceSql = sql`
    AND (
      (de."sourceType" = 'rote' AND r."id" IS NOT NULL)
      OR
      (de."sourceType" = 'article' AND a."id" IS NOT NULL)
    )
  `;
  const viewerVisibilitySql =
    params.scope === 'public'
      ? subjectIsVisibleToViewer(sql`de."ownerId"`, params.viewerId)
      : undefined;
  const permissionSql =
    params.scope === 'public'
      ? sql`
        AND de."sourceType" = 'rote'
        AND r."authorid" = de."ownerId"
        AND r."state" = 'public'
        AND r."archived" = false
        ${viewerVisibilitySql ? sql`AND ${viewerVisibilitySql}` : sql``}
        AND NOT EXISTS (
          SELECT 1 FROM "user_settings" us
          WHERE us."userid" = r."authorid" AND us."allowExplore" = false
        )
        ${
          requireVerifiedEmailForExplore
            ? sql`AND EXISTS (
                SELECT 1 FROM "users" u
                WHERE u."id" = r."authorid" AND u."emailVerified" = true
              )`
            : sql``
        }
      `
      : sql`
        AND de."ownerId" = ${params.ownerId}
        AND (
          (de."sourceType" = 'rote' AND r."authorid" = ${params.ownerId})
          OR
          (de."sourceType" = 'article' AND a."authorId" = ${params.ownerId})
        )
      `;

  const rows = (await db.execute(sql`
    SELECT
      de."id",
      de."ownerId",
      de."sourceType",
      de."sourceId",
      de."chunkIndex",
      de."text",
      CASE
        WHEN de."sourceType" = 'rote' THEN jsonb_build_object(
          'title', COALESCE(r."title", ''),
          'tags', COALESCE(r."tags", ARRAY[]::text[]),
          'state', r."state",
          'archived', r."archived",
          'createdAt', r."createdAt",
          'updatedAt', r."updatedAt"
        )
        ELSE jsonb_build_object(
          'createdAt', a."createdAt",
          'updatedAt', a."updatedAt"
        )
      END AS "metadata",
      1 - ((de."embedding"::vector(${sql.raw(String(dimensions))})) <=> (${vectorLiteral}::vector(${sql.raw(
        String(dimensions)
      )}))) AS "similarity"
    FROM "document_embeddings" de
    LEFT JOIN "rotes" r ON de."sourceType" = 'rote' AND r."id" = de."sourceId"
    LEFT JOIN "articles" a ON de."sourceType" = 'article' AND a."id" = de."sourceId"
    WHERE de."embeddingModel" = ${config.embedding.model}
      AND de."embeddingDimensions" = ${dimensions}
      ${liveSourceSql}
      ${permissionSql}
      ${sourceTypeSql}
      ${excludeSql}
      ${excludeIdsSql}
      ${tagFilterSql}
      ${stateSql}
      ${archivedSql}
      ${timeRangeSql}
    ORDER BY (de."embedding"::vector(${sql.raw(String(dimensions))})) <=> (${vectorLiteral}::vector(${sql.raw(
      String(dimensions)
    )}))
    LIMIT ${limit * 3}
  `)) as any[];

  const bestBySource = new Map<string, SemanticSearchResult>();
  for (const row of rows) {
    const key = `${row.sourceType}:${row.sourceId}`;
    const result: SemanticSearchResult = {
      id: row.id,
      ownerId: row.ownerId,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      chunkIndex: Number(row.chunkIndex),
      text: row.text,
      similarity: Number(row.similarity),
      metadata: row.metadata || {},
    };
    const existing = bestBySource.get(key);
    if (!existing || result.similarity > existing.similarity) {
      bestBySource.set(key, result);
    }
  }

  return Array.from(bestBySource.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
