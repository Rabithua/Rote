import { expect, it, spyOn } from 'bun:test';
import { Hono } from 'hono';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { HonoVariables } from '../types/hono';
import { DEFAULT_AI_CONFIG } from '../utils/ai/providers';

it('migrates a legacy database without pgvector, retaining configuration and vectors', async () => {
  const url = process.env.POSTGRESQL_URL;
  if (!url || !new URL(url).pathname.endsWith('legacy_embedding_test'))
    throw new Error('Use an empty legacy_embedding_test database');
  const client = postgres(url, { max: 1 });
  const folder = mkdtempSync(join(tmpdir(), 'rote-embedding-migrations-'));
  const log = spyOn(console, 'error').mockImplementation(() => {});
  const modelRequests: Record<string, unknown>[] = [];
  const model = Bun.serve({
    port: 0,
    async fetch(request) {
      modelRequests.push(await request.json());
      return Response.json({ data: [{ embedding: Array(1024).fill(0.1) }] });
    },
  });
  let closeDatabase: (() => Promise<void>) | undefined;
  try {
    const [tables] =
      await client`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'`;
    if (tables.count !== 0) throw new Error('Legacy migration test requires an empty database');
    const migrationFolder = join(import.meta.dir, '../drizzle/migrations');
    cpSync(migrationFolder, folder, { recursive: true });
    const journalPath = join(folder, 'meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
    const selectMigrations = (before: number) =>
      writeFileSync(
        journalPath,
        JSON.stringify({
          ...journal,
          entries: journal.entries.filter((entry: { idx: number }) => entry.idx < before),
        })
      );
    selectMigrations(30);
    await migrate(drizzle(client), { migrationsFolder: folder });
    const ownerId = '13180000-0000-4000-8000-000000000011';
    const sourceId = '13180000-0000-4000-8000-000000000012';
    const oldConfig = {
      enabled: true,
      vectorEnabled: true,
      embedding: {
        providerId: 'siliconflow',
        model: 'BAAI/bge-m3',
        baseUrl: 'https://api.siliconflow.cn/v1',
        apiKey: 'migration-placeholder',
        dimensions: 1024,
      },
    };
    await client`INSERT INTO users (id, email, username, role) VALUES (${ownerId}, 'legacy@example.test', 'legacy-embedding', 'admin')`;
    await client`INSERT INTO settings ("group", config) VALUES ('ai', ${JSON.stringify(oldConfig)}::jsonb)`;
    await client`INSERT INTO settings ("group", config) VALUES ('security', ${JSON.stringify({ jwtSecret: 'isolated-migration-test-secret', jwtAccessExpiry: '5m' })}::jsonb)`;
    // Existing Prisma-era tables were retained by the CREATE TABLE IF NOT EXISTS baseline.
    await client`ALTER TABLE settings ALTER COLUMN "updatedAt" DROP DEFAULT`;
    const [originalSetting] = await client`SELECT * FROM settings WHERE "group" = 'ai'`;
    const vector = JSON.stringify(Array(1024).fill(0.1));
    await client`INSERT INTO document_embeddings ("ownerId", "sourceType", "sourceId", "chunkIndex", "contentHash", "embeddingModel", "embeddingDimensions", embedding, text)
      VALUES (${ownerId}, 'rote', ${sourceId}, 0, 'old-hash', 'BAAI/bge-m3', 1024, ${vector}, 'legacy content')`;
    await client`INSERT INTO embedding_jobs ("ownerId", "sourceType", "sourceId", status) VALUES (${ownerId}, 'rote', ${sourceId}, 'running')`;
    selectMigrations(32);
    await migrate(drizzle(client), { migrationsFolder: folder });
    const [setting] = await client`SELECT config FROM settings WHERE "group" = 'ai'`;
    expect(setting.config.schemaVersion).toBe(2);
    expect(setting.config.embedding.output).toEqual({ mode: 'dimensions', dimensions: 1024 });
    expect(setting.config.embedding.apiKey).toBe('migration-placeholder');
    expect(setting.config.embedding.dimensions).toBeUndefined();
    const [retained] = await client`SELECT * FROM document_embeddings`;
    expect(retained.embedding).toBe(vector);
    expect(retained.generationId).toBeNull();
    const [job] = await client`SELECT status FROM embedding_jobs`;
    expect(job.status).toBe('cancelled');
    const [state] = await client`SELECT * FROM embedding_index_state`;
    expect(state.status).toBe('needs_validation');
    expect(state.dimensions).toBeNull();
    expect(await client`SELECT 1 FROM pg_extension WHERE extname = 'vector'`).toHaveLength(0);

    const database = await import('../utils/drizzle');
    closeDatabase = database.closeDatabase;
    const { refreshConfigCache } = await import('../utils/config');
    const { generateAccessToken } = await import('../utils/jwt');
    const { default: adminRouter } = await import('../route/v2/admin');
    const { registerAdminAiRoutes } = await import('../route/v2/aiAdmin');
    const { errorHandler } = await import('../utils/handlers');
    await refreshConfigCache();
    const app = new Hono<{ Variables: HonoVariables }>();
    const ai = new Hono<{ Variables: HonoVariables }>();
    registerAdminAiRoutes(ai);
    app.route('/admin', adminRouter);
    app.route('/ai', ai);
    app.onError(errorHandler);
    const token = await generateAccessToken({ userId: ownerId, username: 'legacy-embedding' });
    const request = (path: string, method: string, body?: unknown) =>
      app.request(path, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const incoming = {
      ...structuredClone(DEFAULT_AI_CONFIG),
      enabled: true,
      vectorEnabled: true,
      embedding: {
        ...DEFAULT_AI_CONFIG.embedding,
        providerId: 'siliconflow',
        baseUrl: `http://127.0.0.1:${model.port}/v1`,
        model: 'BAAI/bge-m3',
        apiKey: 'migration-placeholder',
      },
    };
    const probe = await request('/ai/test', 'POST', { target: 'embedding', config: incoming });
    expect(probe.status).toBe(200);
    expect((await probe.json()).data).toMatchObject({
      dimensions: 1024,
      output: { mode: 'native' },
    });
    expect(modelRequests[0]).not.toHaveProperty('dimensions');
    // The provider works, but the legacy NOT NULL column rejects the upsert before conflict handling.
    for (const [path, method, body] of [
      ['/admin/settings', 'PUT', { group: 'ai', config: incoming }],
      ['/ai/index/pause', 'POST', undefined],
    ] as const) {
      const failed = await request(path, method, body);
      expect(failed.status).toBe(500);
      expect(await failed.json()).toEqual({
        code: 1,
        message: 'embedding_settings_save_failed',
        data: { databaseCode: '23502' },
      });
    }
    expect(log.mock.calls).toHaveLength(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain('migration-placeholder');
    expect((await client`SELECT config FROM settings WHERE "group" = 'ai'`)[0].config).toEqual(
      setting.config
    );
    expect((await client`SELECT * FROM embedding_index_state`)[0]).toEqual(state);

    await migrate(drizzle(client), { migrationsFolder: migrationFolder });
    const saved = await request('/admin/settings', 'PUT', { group: 'ai', config: incoming });
    expect(saved.status).toBe(200);
    expect((await saved.json()).data.config).toMatchObject({
      revision: 1,
      embedding: { output: { mode: 'native' }, apiKey: '********' },
    });
    const [afterSave] = await client`SELECT * FROM settings WHERE "group" = 'ai'`;
    expect(afterSave.id).toBe(originalSetting.id);
    expect(afterSave.createdAt).toEqual(originalSetting.createdAt);
    expect(new Date(afterSave.updatedAt).getTime()).toBeGreaterThan(
      new Date(originalSetting.updatedAt).getTime()
    );
    expect((await client`SELECT * FROM embedding_index_state`)[0]).toMatchObject({
      revision: 1,
      status: 'needs_rebuild',
      dimensions: 1024,
      generationId: null,
    });
    expect(
      (await request('/admin/settings', 'PUT', { group: 'ai', config: incoming })).status
    ).toBe(409);
    for (const action of ['pause', 'resume'])
      expect((await request(`/ai/index/${action}`, 'POST')).status).toBe(200);
    expect((await client`SELECT * FROM embedding_index_state`)[0].revision).toBe(3);
    expect(await client`SELECT * FROM embedding_jobs WHERE status = 'pending'`).toHaveLength(0);
    expect(await client`SELECT 1 FROM pg_extension WHERE extname = 'vector'`).toHaveLength(0);
    await migrate(drizzle(client), { migrationsFolder: migrationFolder });
    expect(await client`SELECT * FROM document_embeddings`).toHaveLength(1);
    await client`DELETE FROM settings WHERE "group" = 'ai'`;
    const inserted = await request('/admin/settings', 'PUT', {
      group: 'ai',
      config: { ...incoming, revision: 3 },
    });
    expect(inserted.status).toBe(200);
    expect((await inserted.json()).data.config.revision).toBe(4);
    expect(
      (await client`SELECT "updatedAt" FROM settings WHERE "group" = 'ai'`)[0].updatedAt
    ).not.toBeNull();
  } finally {
    log.mockRestore();
    model.stop(true);
    await closeDatabase?.();
    await client.end();
    rmSync(folder, { recursive: true, force: true });
  }
}, 30_000);
