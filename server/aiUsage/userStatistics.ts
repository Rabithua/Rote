import { sql } from 'drizzle-orm';
import db from '../utils/drizzle';
import { aiUsageMetrics as metrics } from './aggregation';
import type { AiUsageFilters, AiUsagePagination } from './filters';

export async function getAiUsageUserStatistics(
  filters: AiUsageFilters,
  pagination: AiUsagePagination
) {
  const { page, limit } = pagination;
  const rows = await db.execute(sql`
    WITH filtered AS MATERIALIZED (
      SELECT * FROM ai_token_usage_logs
      WHERE "createdAt" >= ${filters.startAt.toISOString()} AND "createdAt" < ${filters.endAt.toISOString()}
        AND userid IS NOT NULL
        AND (purpose IS NULL OR purpose NOT IN ('provider_test', 'index_validation'))
      ${filters.type === 'all' ? sql`` : sql`AND type = ${filters.type}`}
      ${filters.model ? sql`AND model = ${filters.model}` : sql``}
    ), user_stats AS (
      SELECT userid AS id, ${metrics} AS metrics FROM filtered GROUP BY userid
    ), active_users AS MATERIALIZED (
      SELECT s.id, u.username, u.avatar, s.metrics FROM user_stats s JOIN users u ON u.id = s.id
    ), paged_users AS (
      SELECT * FROM active_users ORDER BY (metrics->>'totalTokens')::numeric DESC, id
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    )
    SELECT
      COALESCE((SELECT jsonb_agg(to_jsonb(u) ORDER BY (u.metrics->>'totalTokens')::numeric DESC, u.id)
        FROM paged_users u), '[]'::jsonb) AS users,
      (SELECT COUNT(*)::int FROM active_users) AS total
  `);
  const total = Number(rows[0].total);
  return {
    users: rows[0].users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}
