import { describe, expect, it } from 'bun:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { randomUUID } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';

const databaseUrl = process.env.AI_CONVERSATIONS_MIGRATION_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;

databaseDescribe('AI conversation history database upgrade', () => {
  it('upgrades a populated revision-37 schema without altering existing notes, accounts or sync cursors', async () => {
    if (!databaseUrl || new URL(databaseUrl).pathname !== '/rote_ai_conversation_migration_test') {
      throw new Error('Use an empty rote_ai_conversation_migration_test database');
    }
    const client = postgres(databaseUrl, { max: 1 });
    const folder = mkdtempSync(join(tmpdir(), 'rote-ai-conversation-migrations-'));
    let ownsSchema = false;
    try {
      const [existing] = await client`
        SELECT count(*)::int AS count FROM information_schema.tables
        WHERE table_schema IN ('public', 'drizzle')
      `;
      if (existing.count !== 0)
        throw new Error('Migration upgrade test requires an empty database');
      // Teardown is only allowed after proving this dedicated database empty.
      ownsSchema = true;
      cpSync(join(import.meta.dir, '../drizzle/migrations'), folder, { recursive: true });
      const journalPath = join(folder, 'meta/_journal.json');
      const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
      writeFileSync(
        journalPath,
        JSON.stringify({
          ...journal,
          entries: journal.entries.filter((entry: { idx: number }) => entry.idx <= 37),
        })
      );
      const database = drizzle(client);
      await migrate(database, { migrationsFolder: folder });
      const userId = randomUUID();
      const noteId = randomUUID();
      await client`
        INSERT INTO users (id, email, username)
        VALUES (${userId}, 'history-upgrade@example.test', 'history-upgrade')
      `;
      await client`
        INSERT INTO rotes (id, authorid, content, title, tags)
        VALUES (${noteId}, ${userId}, 'Existing note before AI history persistence', 'Existing note', ARRAY['history'])
      `;
      await client`INSERT INTO rote_sync_states (userid, revision) VALUES (${userId}, 1)`;
      await client`
        INSERT INTO rote_changes (originid, roteid, action, userid, revision)
        VALUES (${noteId}, ${noteId}, 'CREATE', ${userId}, 1)
      `;
      const usersBefore = await client`SELECT * FROM users WHERE id = ${userId}`;
      const notesBefore = await client`SELECT * FROM rotes WHERE id = ${noteId}`;
      const cursorsBefore = await client`SELECT * FROM rote_sync_states WHERE userid = ${userId}`;
      const changesBefore = await client`SELECT * FROM rote_changes WHERE userid = ${userId}`;
      expect(await client`SELECT to_regclass('public.ai_conversations') AS name`).toEqual([
        { name: null },
      ]);
      const [beforeLedger] =
        await client`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`;
      expect(beforeLedger.count).toBe(38);

      writeFileSync(
        journalPath,
        JSON.stringify({
          ...journal,
          entries: journal.entries.filter((entry: { idx: number }) => entry.idx <= 38),
        })
      );
      await migrate(database, { migrationsFolder: folder });
      expect(await client`SELECT * FROM users WHERE id = ${userId}`).toEqual(usersBefore);
      expect(await client`SELECT * FROM rotes WHERE id = ${noteId}`).toEqual(notesBefore);
      expect(await client`SELECT * FROM rote_sync_states WHERE userid = ${userId}`).toEqual(
        cursorsBefore
      );
      expect(await client`SELECT * FROM rote_changes WHERE userid = ${userId}`).toEqual(
        changesBefore
      );
      expect(await client`SELECT * FROM ai_conversations`).toEqual([]);
      const columns = await client`
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ai_conversations'
        ORDER BY ordinal_position
      `;
      expect(columns).toEqual([
        { column_name: 'owner_id', data_type: 'uuid' },
        { column_name: 'id', data_type: 'character varying' },
        { column_name: 'revision', data_type: 'integer' },
        { column_name: 'created_at', data_type: 'timestamp with time zone' },
        { column_name: 'updated_at', data_type: 'timestamp with time zone' },
        { column_name: 'deleted_at', data_type: 'timestamp with time zone' },
        { column_name: 'agent_conversation_id', data_type: 'character varying' },
        { column_name: 'messages', data_type: 'jsonb' },
      ]);
      const ledgerAfter = await client`
        SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id
      `;
      expect(ledgerAfter).toHaveLength(39);

      await migrate(database, { migrationsFolder: folder });
      expect(
        await client`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`
      ).toEqual(ledgerAfter);
      expect(await client`SELECT * FROM users WHERE id = ${userId}`).toEqual(usersBefore);
      expect(await client`SELECT * FROM rotes WHERE id = ${noteId}`).toEqual(notesBefore);
      expect(await client`SELECT * FROM rote_sync_states WHERE userid = ${userId}`).toEqual(
        cursorsBefore
      );
      expect(await client`SELECT * FROM rote_changes WHERE userid = ${userId}`).toEqual(
        changesBefore
      );
      expect(await client`SELECT * FROM ai_conversations`).toEqual([]);
    } finally {
      try {
        if (ownsSchema) {
          await client`DROP SCHEMA IF EXISTS drizzle CASCADE`;
          await client`DROP SCHEMA public CASCADE`;
          await client`CREATE SCHEMA public`;
        }
      } finally {
        await client.end();
        rmSync(folder, { recursive: true, force: true });
      }
    }
  }, 30_000);
});
