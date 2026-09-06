import { and, isNotNull, ne, sql } from 'drizzle-orm';
import { documentEmbeddings, embeddingJobs } from '../drizzle/schema';
import type { EmbeddingTransaction } from './configStore';

// Caller holds the index-state lock. Keep the retained generation until its
// replacement is ready; unversioned legacy rows have a separate recovery policy.
export async function retireIndexGenerations(
  tx: EmbeddingTransaction,
  retainedGenerationId: string | null
) {
  const indexes = await tx.execute(sql`
    SELECT c.relname AS name FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_am am ON am.oid = c.relam
    WHERE i.indrelid = 'public.document_embeddings'::regclass
      AND n.nspname = 'public' AND am.amname = 'hnsw'
      AND c.relname ~ '^embedding_[0-9a-f]{32}_[0-9]+_idx$'
  `);
  const retainedPrefix = retainedGenerationId
    ? `embedding_${retainedGenerationId.replace(/-/g, '')}_`
    : null;
  for (const index of indexes) {
    const name = String(index.name);
    if (retainedPrefix && name.startsWith(retainedPrefix)) continue;
    await tx.execute(sql`DROP INDEX ${sql.identifier('public')}.${sql.identifier(name)}`);
  }
  await tx
    .delete(documentEmbeddings)
    .where(
      and(
        isNotNull(documentEmbeddings.generationId),
        retainedGenerationId ? ne(documentEmbeddings.generationId, retainedGenerationId) : undefined
      )
    );
  await tx
    .delete(embeddingJobs)
    .where(
      and(
        isNotNull(embeddingJobs.generationId),
        retainedGenerationId ? ne(embeddingJobs.generationId, retainedGenerationId) : undefined
      )
    );
}
