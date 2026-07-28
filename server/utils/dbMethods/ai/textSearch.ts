import { sql } from 'drizzle-orm';
import {
  buildTextArraySql,
  normalizeLimit,
  normalizeSearchTimeRange,
  VALID_SOURCE_TYPES,
} from './documents';
import db from '../../drizzle';
import { semanticSearch } from './semanticSearch';
import { buildSourceIdExclusionSql } from './textSearchSql';
import type {
  AiSourceType,
  NormalizedTimeRange,
  RetrievalDateField,
  RetrievalSelection,
  SemanticSearchResult,
} from './types';

function extractTextSearchTerms(...values: Array<string | string[] | undefined>): string[] {
  const text = values.flat().filter(Boolean).join(' ');
  const terms = text.match(/[\p{L}\p{N}_]{2,}/gu) || [];
  return Array.from(new Set(terms.map((term) => term.trim()).filter(Boolean))).slice(0, 8);
}

function maybeDateString(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : undefined;
}

function buildTextSearchResult(
  row: any,
  sourceType: AiSourceType,
  similarity: number,
  retrievalMode: RetrievalSelection = 'relevance',
  dateField: RetrievalDateField = 'createdAt'
) {
  if (sourceType === 'rote') {
    const text = `Title: ${row.title || ''}\nTags: ${(row.tags || []).join(', ')}\n${row.content || ''}`;
    return {
      id: `text:${sourceType}:${row.id}`,
      ownerId: row.ownerId,
      sourceType,
      sourceId: row.id,
      chunkIndex: 0,
      text,
      similarity,
      retrievalMode,
      metadata: {
        title: row.title || '',
        tags: row.tags || [],
        state: row.state,
        archived: row.archived,
        createdAt: maybeDateString(row.createdAt),
        updatedAt: maybeDateString(row.updatedAt),
        retrievalMode,
        retrievalDateField: dateField,
      },
    } satisfies SemanticSearchResult;
  }

  return {
    id: `text:${sourceType}:${row.id}`,
    ownerId: row.ownerId,
    sourceType,
    sourceId: row.id,
    chunkIndex: 0,
    text: row.content || '',
    similarity,
    retrievalMode,
    metadata: {
      createdAt: maybeDateString(row.createdAt),
      updatedAt: maybeDateString(row.updatedAt),
      retrievalMode,
      retrievalDateField: dateField,
    },
  } satisfies SemanticSearchResult;
}

function buildRoteTextTermSql(terms: string[]) {
  if (!terms.length) return sql``;
  const clauses = terms.map((term) => {
    const pattern = `%${term}%`;
    return sql`(
      r."title" ILIKE ${pattern}
      OR r."content" ILIKE ${pattern}
      OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(r."tags", ARRAY[]::text[])) AS tag
        WHERE tag ILIKE ${pattern}
      )
    )`;
  });
  return sql`AND (${sql.join(clauses, sql` OR `)})`;
}

function buildArticleTextTermSql(terms: string[]) {
  if (!terms.length) return sql``;
  const clauses = terms.map((term) => {
    const pattern = `%${term}%`;
    return sql`a."content" ILIKE ${pattern}`;
  });
  return sql`AND (${sql.join(clauses, sql` OR `)})`;
}

function buildTextSearchTimeSql(
  alias: 'r' | 'a',
  timeRange?: NormalizedTimeRange | null,
  dateField: RetrievalDateField = 'createdAt'
) {
  if (!timeRange) return sql``;
  const column = dateField === 'updatedAt' ? 'updatedAt' : 'createdAt';
  return alias === 'r'
    ? sql`AND r.${sql.raw(`"${column}"`)} >= ${timeRange.from}::timestamptz AND r.${sql.raw(`"${column}"`)} <= ${timeRange.to}::timestamptz`
    : sql`AND a.${sql.raw(`"${column}"`)} >= ${timeRange.from}::timestamptz AND a.${sql.raw(`"${column}"`)} <= ${timeRange.to}::timestamptz`;
}

function buildTextSearchOrderSql(alias: 'r' | 'a', dateField: RetrievalDateField = 'updatedAt') {
  const column = dateField === 'updatedAt' ? 'updatedAt' : 'createdAt';
  return sql`${sql.raw(`${alias}."${column}"`)} DESC, ${sql.raw(`${alias}."id"`)} DESC`;
}

function getResultDate(result: SemanticSearchResult, dateField: RetrievalDateField): number {
  const value = result.metadata?.[dateField] || result.metadata?.createdAt;
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export async function textSearchMemory(params: {
  query: string;
  ownerId?: string;
  viewerId?: string;
  sourceTypes?: AiSourceType[];
  timeRange?: NormalizedTimeRange | null;
  selection?: RetrievalSelection;
  dateField?: RetrievalDateField;
  tags?: { include?: string[]; exclude?: string[]; match?: 'any' | 'all' };
  semanticScope?: string[];
  state?: 'private' | 'public' | 'all';
  archived?: boolean | null;
  limit?: number;
  exclude?: { sourceType: AiSourceType; sourceId: string };
  excludeIds?: string[];
}): Promise<SemanticSearchResult[]> {
  if (!params.ownerId) return [];
  const limit = normalizeLimit(params.limit);
  const { timeRange } = normalizeSearchTimeRange(params.timeRange);
  const sourceTypes = new Set(
    (params.sourceTypes || ['rote', 'article']).filter((type) => VALID_SOURCE_TYPES.has(type))
  );
  const selection = params.selection === 'recent' ? 'recent' : 'relevance';
  const dateField = params.dateField === 'updatedAt' ? 'updatedAt' : 'createdAt';
  const terms =
    selection === 'recent' ? [] : extractTextSearchTerms(params.query, params.semanticScope);
  const runSearch = async (activeTerms: string[]) => {
    const results: SemanticSearchResult[] = [];
    const excludeRoteIds = [
      ...(params.exclude?.sourceType === 'rote' ? [params.exclude.sourceId] : []),
      ...((params.excludeIds || [])
        .filter((id) => id.startsWith('rote:'))
        .map((id) => id.slice('rote:'.length)) || []),
    ];
    const excludeArticleIds = [
      ...(params.exclude?.sourceType === 'article' ? [params.exclude.sourceId] : []),
      ...((params.excludeIds || [])
        .filter((id) => id.startsWith('article:'))
        .map((id) => id.slice('article:'.length)) || []),
    ];

    if (sourceTypes.has('rote')) {
      const includeTags = params.tags?.include?.filter(Boolean) || [];
      const excludeTags = params.tags?.exclude?.filter(Boolean) || [];
      const includeTagsSql =
        includeTags.length > 0
          ? params.tags?.match === 'all'
            ? sql`AND r."tags" @> ${buildTextArraySql(includeTags)}`
            : sql`AND r."tags" && ${buildTextArraySql(includeTags)}`
          : sql``;
      const excludeTagsSql =
        excludeTags.length > 0
          ? sql`AND NOT (r."tags" && ${buildTextArraySql(excludeTags)})`
          : sql``;
      const stateSql =
        params.state && params.state !== 'all' ? sql`AND r."state" = ${params.state}` : sql``;
      const archivedSql =
        typeof params.archived === 'boolean' ? sql`AND r."archived" = ${params.archived}` : sql``;
      const excludeSql = buildSourceIdExclusionSql('r', excludeRoteIds);
      const rows = (await db.execute(sql`
        SELECT
          r."id",
          r."authorid" AS "ownerId",
          r."title",
          r."content",
          r."tags",
          r."state",
          r."archived",
          r."createdAt",
          r."updatedAt"
        FROM "rotes" r
        WHERE r."authorid" = ${params.ownerId}
          ${buildRoteTextTermSql(activeTerms)}
          ${includeTagsSql}
          ${excludeTagsSql}
          ${stateSql}
          ${archivedSql}
          ${buildTextSearchTimeSql('r', timeRange, dateField)}
          ${excludeSql}
        ORDER BY ${buildTextSearchOrderSql('r', selection === 'recent' ? dateField : 'updatedAt')}
        LIMIT ${limit}
      `)) as any[];
      results.push(
        ...rows.map((row) =>
          buildTextSearchResult(row, 'rote', selection === 'recent' ? 0 : 0.2, selection, dateField)
        )
      );
    }

    if (
      sourceTypes.has('article') &&
      !params.tags?.include?.length &&
      !params.tags?.exclude?.length
    ) {
      const excludeSql = buildSourceIdExclusionSql('a', excludeArticleIds);
      const rows = (await db.execute(sql`
        SELECT
          a."id",
          a."authorId" AS "ownerId",
          a."content",
          a."createdAt",
          a."updatedAt"
        FROM "articles" a
        WHERE a."authorId" = ${params.ownerId}
          ${buildArticleTextTermSql(activeTerms)}
          ${buildTextSearchTimeSql('a', timeRange, dateField)}
          ${excludeSql}
        ORDER BY ${buildTextSearchOrderSql('a', selection === 'recent' ? dateField : 'updatedAt')}
        LIMIT ${limit}
      `)) as any[];
      results.push(
        ...rows.map((row) =>
          buildTextSearchResult(
            row,
            'article',
            selection === 'recent' ? 0 : 0.15,
            selection,
            dateField
          )
        )
      );
    }

    return results
      .sort((a, b) => {
        if (selection === 'recent') {
          return (
            getResultDate(b, dateField) - getResultDate(a, dateField) ||
            `${b.sourceType}:${b.sourceId}`.localeCompare(`${a.sourceType}:${a.sourceId}`)
          );
        }
        const aTime = Date.parse(String(a.metadata?.updatedAt || a.metadata?.createdAt || ''));
        const bTime = Date.parse(String(b.metadata?.updatedAt || b.metadata?.createdAt || ''));
        return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
      })
      .slice(0, limit);
  };

  const matched = await runSearch(terms);
  return matched;
}

export async function searchMemory(params: {
  query: string;
  ownerId?: string;
  viewerId?: string;
  scope?: 'mine' | 'public';
  sourceTypes?: AiSourceType[];
  timeRange?: NormalizedTimeRange | null;
  selection?: RetrievalSelection;
  dateField?: RetrievalDateField;
  tags?: { include?: string[]; exclude?: string[]; match?: 'any' | 'all' };
  semanticScope?: string[];
  state?: 'private' | 'public' | 'all';
  archived?: boolean | null;
  limit?: number;
  exclude?: { sourceType: AiSourceType; sourceId: string };
  excludeIds?: string[];
}): Promise<{ sources: SemanticSearchResult[]; warnings: string[] }> {
  const { timeRange, warnings } = normalizeSearchTimeRange(params.timeRange);
  const safeParams = { ...params, timeRange };
  if (params.selection === 'recent') {
    return {
      sources: await textSearchMemory({ ...safeParams, query: '', selection: 'recent' }),
      warnings,
    };
  }
  return { sources: await semanticSearch(safeParams), warnings };
}
