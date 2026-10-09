import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { registerProviderCaptureTests } from './testCases/providerCapture.test';
import { registerHttpErrorUsageTests } from './testCases/httpErrorUsage.test';
import { saveAiUsage } from './repository';
import { getAiUsageStatistics } from './statistics';
import { parseAiUsageFilters } from './filters';
import type { AiUsageRecord } from './types';

const url = process.env.POSTGRESQL_URL;
if (!url || new URL(url).pathname !== '/ai_usage_test')
  throw new Error('Use an isolated empty ai_usage_test database');
const client = postgres(url, { max: 1 });
const owner = 'a1000000-0000-4000-8000-000000000001';
const provider = {
  providerId: 'deepseek',
  model: 'deepseek-flash',
  baseUrl: 'http://provider.test/v1',
};
const originalFetch = globalThis.fetch;

beforeAll(async () => {
  const [tables] =
    await client`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'`;
  if (tables.count !== 0) throw new Error('AI usage migration test requires an empty database');
  const folder = mkdtempSync(join(tmpdir(), 'rote-ai-usage-migration-'));
  try {
    cpSync(join(import.meta.dir, '../drizzle/migrations'), folder, { recursive: true });
    const journalPath = join(folder, 'meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
    writeFileSync(
      journalPath,
      JSON.stringify({
        ...journal,
        entries: journal.entries.filter((entry: { idx: number }) => entry.idx < 36),
      })
    );
    await migrate(drizzle(client), { migrationsFolder: folder });
    await client`INSERT INTO users (id, email, username, role) VALUES (${owner}, 'ai-usage@example.test', 'ai-usage', 'admin')`;
    await client`INSERT INTO ai_token_usage_logs (userid, model, type, "promptTokens", "completionTokens", "totalTokens") VALUES (${owner}, 'old', 'chat', 11, 2, 13)`;
    writeFileSync(journalPath, JSON.stringify(journal));
    await migrate(drizzle(client), { migrationsFolder: folder });
    const [legacy] = await client`SELECT * FROM ai_token_usage_logs`;
    expect(legacy).toMatchObject({
      userid: owner,
      promptTokens: 11,
      completionTokens: 2,
      totalTokens: 13,
      usage_status: 'legacy',
      request_id: null,
      cache_hit_tokens: null,
      purpose: null,
      status: null,
      provider_id: null,
    });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}, 30_000);
beforeEach(async () => {
  await client`DELETE FROM ai_token_usage_logs`;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});
afterAll(async () => {
  await client.end();
  const { closeDatabase } = await import('../utils/drizzle');
  await closeDatabase();
});

registerProviderCaptureTests(client, owner, provider);
registerHttpErrorUsageTests(client, owner, provider);

async function recorded() {
  return client`SELECT * FROM ai_token_usage_logs ORDER BY "createdAt", request_id`;
}

function record(overrides: Partial<AiUsageRecord> = {}): AiUsageRecord {
  return {
    requestId: randomUUID(),
    userid: owner,
    providerId: 'deepseek',
    model: 'deepseek-flash',
    type: 'chat',
    purpose: 'chat_answer',
    status: 'completed',
    usageStatus: 'reported',
    promptTokens: 100,
    completionTokens: 20,
    totalTokens: 120,
    cacheHitTokens: null,
    cacheMissTokens: null,
    reasoningTokens: null,
    createdAt: new Date('2026-09-30T16:00:00Z'),
    ...overrides,
  };
}

it('upserts a request id and anonymizes deleted users without losing usage', async () => {
  const deleted = randomUUID();
  await client`INSERT INTO users (id, email, username) VALUES (${deleted}, 'deleted@example.test', 'deleted-usage')`;
  const value = record({ userid: deleted });
  await saveAiUsage(value);
  await saveAiUsage({ ...value, totalTokens: 150, completionTokens: 50 });
  expect(await recorded()).toHaveLength(1);
  await client`DELETE FROM users WHERE id=${deleted}`;
  expect((await recorded())[0]).toMatchObject({ userid: null, totalTokens: 150 });
});

it('matches SQL totals across boundaries, model/type filters, legacy and unknown records', async () => {
  await saveAiUsage(record());
  await saveAiUsage(
    record({
      type: 'embedding',
      purpose: 'embedding_index',
      model: 'embedding-test',
      promptTokens: 9,
      completionTokens: 0,
      totalTokens: 9,
    })
  );
  await saveAiUsage(record({ userid: null, purpose: 'provider_test' }));
  await saveAiUsage(
    record({
      usageStatus: 'unknown',
      totalTokens: null,
      promptTokens: null,
      completionTokens: null,
    })
  );
  await saveAiUsage(record({ createdAt: new Date('2026-09-30T15:59:59Z') }));
  await saveAiUsage(record({ createdAt: new Date('2026-10-31T16:00:00Z') }));
  await client`INSERT INTO ai_token_usage_logs (userid, model, type, "promptTokens", "completionTokens", "totalTokens", "createdAt") VALUES (${owner}, 'old', 'chat', 11, 2, 13, '2026-10-01T00:00:00+08:00')`;
  const filters = parseAiUsageFilters({
    startAt: '2026-09-30T16:00:00Z',
    endAt: '2026-10-31T16:00:00Z',
  });
  const stats = (await getAiUsageStatistics(filters)) as any;
  expect(stats.summary).toMatchObject({
    totalTokens: '262',
    calls: 4,
    reportedCalls: 3,
    unknownCalls: 1,
    legacyRecords: 1,
  });
  expect(stats.system).toMatchObject({ totalTokens: '120', calls: 1 });
  expect(stats.topUsers).toHaveLength(1);
  expect(stats.topUsers[0].metrics.totalTokens).toBe('142');
  expect(
    stats.models.reduce((sum: bigint, model: any) => sum + BigInt(model.metrics.totalTokens), 0n)
  ).toBe(262n);
  const [direct] =
    await client`SELECT SUM("totalTokens")::text AS total FROM ai_token_usage_logs WHERE "createdAt">=${filters.startAt.toISOString()} AND "createdAt"<${filters.endAt.toISOString()}`;
  expect(stats.summary.totalTokens).toBe(direct.total);
  const selected = (await getAiUsageStatistics({
    ...filters,
    type: 'embedding',
    model: 'embedding-test',
  })) as any;
  expect(selected.summary).toMatchObject({ totalTokens: '9', calls: 1, unknownCalls: 0 });
  expect(selected.models).toHaveLength(1);
  expect(selected.topUsers[0].metrics.totalTokens).toBe('9');
  expect(selected.availableModels).toEqual(['embedding-test']);
});

it('attributes private and public query embeddings to the requester independently of content ownership', async () => {
  const { DEFAULT_AI_CONFIG } = await import('../utils/ai/providers');
  const { semanticSearch } = await import('../utils/dbMethods/ai/semanticSearch');
  const { vectorIndexName } = await import('../utils/dbMethods/ai/documents');
  const generation = randomUUID();
  const config = {
    ...DEFAULT_AI_CONFIG,
    enabled: true,
    vectorEnabled: true,
    publicExploreVectorEnabled: true,
    embedding: { ...provider, model: 'embedding-test', output: { mode: 'native' } },
  };
  await client`INSERT INTO settings ("group", config) VALUES ('ai', ${JSON.stringify(config)}::jsonb) ON CONFLICT ("group") DO UPDATE SET config=EXCLUDED.config`;
  await client`UPDATE embedding_index_state SET status='ready', "generationId"=${generation}, fingerprint='test', "generationFingerprint"='test', dimensions=3, "generationDimensions"=3 WHERE id=1`;
  await client`CREATE EXTENSION IF NOT EXISTS vector`;
  const index = vectorIndexName(3, generation);
  await client.unsafe(
    `CREATE INDEX "${index}" ON document_embeddings USING hnsw ((embedding::vector(3)) vector_cosine_ops)`
  );
  try {
    globalThis.fetch = (async () =>
      Response.json({
        data: [{ embedding: [1, 2, 3] }],
        usage: { prompt_tokens: 9, total_tokens: 9 },
      })) as typeof fetch;
    await semanticSearch({ query: 'test', scope: 'public', viewerId: owner });
    await semanticSearch({ query: 'test', scope: 'mine', viewerId: owner, ownerId: randomUUID() });
    expect(await recorded()).toHaveLength(2);
    for (const row of await recorded())
      expect(row).toMatchObject({ userid: owner, purpose: 'embedding_query', totalTokens: 9 });
  } finally {
    await client.unsafe(`DROP INDEX "${index}"`);
  }
});

it('serves the aggregate API only to admins, validates filters, and keeps the legacy dashboard contract', async () => {
  const { default: router } = await import('../route/v2/adminUsers');
  const { refreshConfigCache } = await import('../utils/config');
  const { generateAccessToken } = await import('../utils/jwt');
  await client`INSERT INTO settings ("group", config) VALUES ('security', ${JSON.stringify({ jwtSecret: 'ai-usage-isolated-test-key', jwtAccessExpiry: '5m' })}::jsonb) ON CONFLICT ("group") DO UPDATE SET config=EXCLUDED.config`;
  await refreshConfigCache();
  const token = await generateAccessToken({ userId: owner, username: 'ai-usage' });
  const headers = { authorization: `Bearer ${token}` };
  await saveAiUsage(record());
  const query = new URLSearchParams({
    startAt: '2026-09-30T16:00:00Z',
    endAt: '2026-10-31T16:00:00Z',
    type: 'chat',
    model: 'deepseek-flash',
  });
  const response = await router.request(`/stats/ai-usage?${query}`, { headers });
  expect(response.status).toBe(200);
  expect((await response.json()).data.summary).toMatchObject({ totalTokens: '120', calls: 1 });
  expect((await router.request('/stats/ai-usage')).status).toBe(401);
  expect((await router.request('/stats/ai-usage?type=invalid', { headers })).status).toBe(400);
  const legacy = await router.request('/stats/dashboard', { headers });
  expect(legacy.status).toBe(200);
  expect(Array.isArray((await legacy.json()).data.topUsersByTokenUsage)).toBe(true);
  await client`UPDATE users SET role='user' WHERE id=${owner}`;
  try {
    expect((await router.request('/stats/ai-usage', { headers })).status).toBe(403);
  } finally {
    await client`UPDATE users SET role='admin' WHERE id=${owner}`;
  }
});
