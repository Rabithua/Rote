import type { AiUsageDailyMetrics, AiUsageStatistics, AiUsageTokenKey } from './types';

const DAY_MS = 86400_000;
const SHANGHAI_OFFSET_MS = 8 * 3600_000;

export interface AiUsageTrendPoint {
  date: string;
  metrics?: AiUsageDailyMetrics;
  totalTokens: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
}

// Only chart coordinates use numbers. Tooltips retain the original decimal strings.
export function buildDailyTokenTrend(
  daily: AiUsageStatistics['daily'],
  range: AiUsageStatistics['range']
): AiUsageTrendPoint[] {
  const start = new Date(range.startAt).getTime();
  const end = new Date(range.endAt).getTime();
  if (start >= end) return [];
  const firstDay = Math.floor((start + SHANGHAI_OFFSET_MS) / DAY_MS);
  const endDay = Math.ceil((end + SHANGHAI_OFFSET_MS) / DAY_MS);
  const byDate = new Map(daily.map((point) => [point.date, point.metrics]));

  return Array.from({ length: endDay - firstDay }, (_, index) => {
    const date = new Date((firstDay + index) * DAY_MS).toISOString().slice(0, 10);
    const metrics = byDate.get(date);
    const coordinate = (key: AiUsageTokenKey) => {
      const raw = metrics ? metrics[key] : '0';
      return raw === null ? null : Number(raw);
    };
    return {
      date,
      metrics,
      totalTokens: coordinate('totalTokens'),
      promptTokens: coordinate('promptTokens'),
      completionTokens: coordinate('completionTokens'),
    };
  });
}
