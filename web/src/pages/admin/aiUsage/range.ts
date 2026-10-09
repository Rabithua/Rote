export type AiUsagePeriod = '7d' | '30d' | 'month';

export function aiUsageRange(period: AiUsagePeriod, now = new Date()) {
  const shanghai = new Date(now.getTime() + 8 * 3600_000);
  const start =
    period === 'month'
      ? new Date(Date.UTC(shanghai.getUTCFullYear(), shanghai.getUTCMonth(), 1) - 8 * 3600_000)
      : new Date(now.getTime() - (period === '7d' ? 7 : 30) * 86400_000);
  return { startAt: start.toISOString(), endAt: now.toISOString() };
}

export function formatTokenCount(value: string | null) {
  return value === null ? null : BigInt(value).toLocaleString();
}
