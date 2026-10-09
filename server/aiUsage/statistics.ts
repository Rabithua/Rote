import { sql } from 'drizzle-orm';
import db from '../utils/drizzle';
import type { AiUsageFilters } from './filters';

// Token sums remain decimal strings, including inside JSON returned by PostgreSQL.
const metrics = sql`jsonb_build_object(
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

export async function getAiUsageStatistics(filters: AiUsageFilters) {
  const rows = await db.execute(sql`
    WITH window_usage AS MATERIALIZED (
      SELECT * FROM ai_token_usage_logs
      WHERE "createdAt" >= ${filters.startAt.toISOString()} AND "createdAt" < ${filters.endAt.toISOString()}
      ${filters.type === 'all' ? sql`` : sql`AND type = ${filters.type}`}
    ), filtered AS MATERIALIZED (
      SELECT * FROM window_usage ${filters.model ? sql`WHERE model = ${filters.model}` : sql``}
    ), model_stats AS (
      SELECT provider_id AS "providerId", model, type, ${metrics} AS metrics
      FROM filtered GROUP BY provider_id, model, type
      ORDER BY COALESCE(SUM("totalTokens"), 0) DESC, model, type, provider_id NULLS LAST
    ), user_stats AS (
      SELECT userid AS id, ${metrics} AS metrics
      FROM filtered WHERE userid IS NOT NULL
        AND (purpose IS NULL OR purpose NOT IN ('provider_test', 'index_validation'))
      GROUP BY userid ORDER BY COALESCE(SUM("totalTokens"), 0) DESC, userid LIMIT 10
    ), top_users AS (
      SELECT s.id, u.username, u.avatar, s.metrics FROM user_stats s JOIN users u ON u.id = s.id
      ORDER BY (s.metrics->>'totalTokens')::numeric DESC, s.id
    )
    SELECT
      (SELECT ${metrics} FROM filtered) AS summary,
      (SELECT ${metrics} FROM filtered WHERE purpose IN ('provider_test', 'index_validation')) AS system,
      (SELECT ${metrics} FROM filtered WHERE userid IS NULL
        AND (purpose IS NULL OR purpose NOT IN ('provider_test', 'index_validation'))) AS unattributed,
      COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM model_stats m), '[]'::jsonb) AS models,
      COALESCE((SELECT jsonb_agg(to_jsonb(u)) FROM top_users u), '[]'::jsonb) AS "topUsers",
      COALESCE((SELECT jsonb_agg(model ORDER BY model) FROM
        (SELECT DISTINCT model FROM window_usage) available), '[]'::jsonb) AS "availableModels"
  `);
  return {
    ...rows[0],
    range: {
      startAt: filters.startAt.toISOString(),
      endAt: filters.endAt.toISOString(),
      timeZone: 'Asia/Shanghai',
    },
  };
}
