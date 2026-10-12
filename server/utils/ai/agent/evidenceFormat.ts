import { unicodeLength } from './sourceBudget';

const SEARCH_COLUMNS = [
  'citation',
  'sourceType',
  'sourceId',
  'title',
  'tags',
  'createdAt',
  'updatedAt',
  'state',
  'archived',
  'excerpt',
  'truncated',
] as const;

type SearchEvidencePayload = {
  status: string;
  foundCount: number;
  sources: Record<(typeof SEARCH_COLUMNS)[number], unknown>[];
};

/** Model-only encoding; client source objects keep their existing shape. */
export function serializeSearchEvidence(payload: SearchEvidencePayload): string {
  const expanded = JSON.stringify(payload);
  if (payload.sources.length < 2) return expanded;

  const { sources, ...context } = payload;
  const compact = JSON.stringify({
    ...context,
    columns: SEARCH_COLUMNS,
    rows: sources.map((source) => SEARCH_COLUMNS.map((column) => source[column] ?? null)),
  });
  return unicodeLength(compact) < unicodeLength(expanded) ? compact : expanded;
}
