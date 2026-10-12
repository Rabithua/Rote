import { sql } from 'drizzle-orm';

// Token sums remain decimal strings, including inside JSON returned by PostgreSQL.
export const aiUsageMetrics = sql`jsonb_build_object(
  'totalTokens', COALESCE(SUM("totalTokens"), 0)::text,
  'promptTokens', COALESCE(SUM("promptTokens"), 0)::text,
  'completionTokens', COALESCE(SUM("completionTokens"), 0)::text,
  'calls', COUNT(*) FILTER (WHERE usage_status <> 'legacy')::int,
  'reportedCalls', COUNT(*) FILTER (WHERE usage_status = 'reported')::int,
  'unknownCalls', COUNT(*) FILTER (WHERE usage_status = 'unknown')::int,
  'legacyRecords', COUNT(*) FILTER (WHERE usage_status = 'legacy')::int,
  'failedCalls', COUNT(*) FILTER (WHERE status = 'failed')::int,
  'cancelledCalls', COUNT(*) FILTER (WHERE status = 'cancelled')::int,
  'cacheHitTokens', SUM(cache_hit_tokens)::text,
  'cacheMissTokens', SUM(cache_miss_tokens)::text,
  'reasoningTokens', SUM(reasoning_tokens)::text,
  'cacheHitReportedCalls', COUNT(cache_hit_tokens)::int,
  'cacheMissReportedCalls', COUNT(cache_miss_tokens)::int,
  'reasoningReportedCalls', COUNT(reasoning_tokens)::int
)`;
