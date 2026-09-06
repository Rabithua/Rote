import { sql } from 'drizzle-orm';
import db from '../../drizzle';
import { readAiSnapshot } from '../../../embeddings/configStore';
import { EmbeddingError } from '../../../embeddings/errors';
import { vectorIndexName } from './documents';
import { generationMatches } from '../../../embeddings/generationIdentity';

export async function getPgvectorStatus() {
  const { config, state } = await readAiSnapshot();
  const name =
    state.dimensions && state.generationId
      ? vectorIndexName(state.dimensions, state.generationId)
      : null;
  const rows = await db.execute(sql`
    SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') AS available,
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS installed,
      (SELECT extversion FROM pg_extension WHERE extname = 'vector') AS version,
      EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = ${name} AND i.indisvalid) AS "hasIndex"
  `);
  const row = rows[0];
  return {
    available: Boolean(row.available),
    installed: Boolean(row.installed),
    version: row.version as string | null,
    indexName: row.hasIndex ? name : null,
    dimensions: state.dimensions,
    generationId: state.generationId,
    revision: state.revision,
    status: state.status,
    errorCode: state.errorCode,
    errorDetails: state.errorDetails,
    scanComplete: state.scanComplete,
    ready:
      config.enabled &&
      config.vectorEnabled &&
      state.status === 'ready' &&
      generationMatches(state, state.fingerprint, state.dimensions) &&
      Boolean(row.installed && row.hasIndex),
  };
}

export async function ensurePgvectorReady() {
  const before = await getPgvectorStatus();
  if (!before.available) throw new EmbeddingError('embedding_database_unavailable', 503);
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
  return getPgvectorStatus();
}
