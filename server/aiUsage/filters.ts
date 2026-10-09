export interface AiUsageFilters {
  startAt: Date;
  endAt: Date;
  type: 'all' | 'chat' | 'embedding';
  model?: string;
}

export class InvalidAiUsageFilter extends Error {}

export function parseAiUsageFilters(
  query: Record<string, string>,
  now = new Date()
): AiUsageFilters {
  const type = query.type ?? 'all';
  const startAt = query.startAt
    ? new Date(query.startAt)
    : new Date(now.getTime() - 30 * 86400_000);
  const endAt = query.endAt ? new Date(query.endAt) : now;
  if (
    !['all', 'chat', 'embedding'].includes(type) ||
    Boolean(query.startAt) !== Boolean(query.endAt) ||
    !Number.isFinite(startAt.getTime()) ||
    !Number.isFinite(endAt.getTime()) ||
    startAt > endAt ||
    (query.model?.length ?? 0) > 255
  )
    throw new InvalidAiUsageFilter('invalid_ai_usage_filter');
  return { startAt, endAt, type: type as AiUsageFilters['type'], model: query.model || undefined };
}
