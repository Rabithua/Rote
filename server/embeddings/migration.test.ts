import { expect, it } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

it('migrates a legacy database without pgvector, retaining configuration and vectors', async () => {
  const url = process.env.POSTGRESQL_URL;
  if (!url || !new URL(url).pathname.endsWith('legacy_embedding_test'))
    throw new Error('Use an empty legacy_embedding_test database');
  const client = postgres(url, { max: 1 });
  const folder = mkdtempSync(join(tmpdir(), 'rote-embedding-migrations-'));
  try {
    const [tables] =
      await client`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'`;
    if (tables.count !== 0) throw new Error('Legacy migration test requires an empty database');
    const migrationFolder = join(import.meta.dir, '../drizzle/migrations');
    cpSync(migrationFolder, folder, { recursive: true });
    const journalPath = join(folder, 'meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 30);
    writeFileSync(journalPath, JSON.stringify(journal));
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
    await client`INSERT INTO users (id, email, username) VALUES (${ownerId}, 'legacy@example.test', 'legacy-embedding')`;
    await client`INSERT INTO settings ("group", config) VALUES ('ai', ${JSON.stringify(oldConfig)}::jsonb)`;
    const vector = JSON.stringify(Array(1024).fill(0.1));
    await client`INSERT INTO document_embeddings ("ownerId", "sourceType", "sourceId", "chunkIndex", "contentHash", "embeddingModel", "embeddingDimensions", embedding, text)
      VALUES (${ownerId}, 'rote', ${sourceId}, 0, 'old-hash', 'BAAI/bge-m3', 1024, ${vector}, 'legacy content')`;
    await client`INSERT INTO embedding_jobs ("ownerId", "sourceType", "sourceId", status) VALUES (${ownerId}, 'rote', ${sourceId}, 'running')`;
    await migrate(drizzle(client), { migrationsFolder: migrationFolder });
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
    await migrate(drizzle(client), { migrationsFolder: migrationFolder });
    expect(await client`SELECT * FROM document_embeddings`).toHaveLength(1);
  } finally {
    await client.end();
    rmSync(folder, { recursive: true, force: true });
  }
}, 30_000);
