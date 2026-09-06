import { asc, isNull } from 'drizzle-orm';
import { articles, documentEmbeddings, rotes } from '../drizzle/schema';
import { hasCapability } from '../authz/capabilityService';
import {
  buildSourceDocument,
  getSourceOwner,
  hashText,
  splitIntoChunks,
} from '../utils/dbMethods/ai/documents';
import type { AiSourceType } from '../utils/dbMethods/ai/types';
import type { AiConfig } from '../types/config';
import type { EmbeddingTransaction } from './configStore';
import { validateVector } from './contract';

// An operator must establish provider provenance separately. This audit proves
// source ownership, complete chunk coverage and the stored vector contract.
export async function auditLegacyIndex(
  tx: EmbeddingTransaction,
  config: AiConfig,
  dimensions: number
) {
  const notes = await tx.select().from(rotes).orderBy(asc(rotes.id)).for('share');
  const documents = await tx.select().from(articles).orderBy(asc(articles.id)).for('share');
  const auditedSources = new Set<string>();
  const legacy = await tx
    .select()
    .from(documentEmbeddings)
    .where(isNull(documentEmbeddings.generationId))
    .orderBy(asc(documentEmbeddings.id))
    .for('share');
  const bySource = new Map<string, typeof legacy>();
  for (const row of legacy) {
    const key = `${row.sourceType}:${row.sourceId}`;
    const rows = bySource.get(key) ?? [];
    rows.push(row);
    bySource.set(key, rows);
  }
  const reusable: typeof legacy = [];
  const pending: { sourceType: AiSourceType; sourceId: string; ownerId: string }[] = [];
  const capabilities = new Map<string, boolean>();
  let sources = 0;
  for (const sourceType of ['rote', 'article'] as const) {
    const records = sourceType === 'rote' ? notes : documents;
    for (const source of records) {
      const ownerId = getSourceOwner(sourceType, source);
      if (!capabilities.has(ownerId))
        capabilities.set(ownerId, await hasCapability(ownerId, 'ai.chat'));
      if (!capabilities.get(ownerId)) continue;
      auditedSources.add(`${sourceType}:${source.id}`);
      const document = buildSourceDocument(sourceType, source);
      const chunks = splitIntoChunks(
        document.text,
        config.indexing.chunkSize,
        config.indexing.chunkOverlap
      );
      if (!chunks.length) continue;
      sources++;
      const rows = bySource.get(`${sourceType}:${source.id}`) ?? [];
      const matches =
        rows.length === chunks.length &&
        new Set(rows.map((row) => row.chunkIndex)).size === chunks.length &&
        rows.every((row) => {
          const chunk = chunks[row.chunkIndex];
          if (
            chunk === undefined ||
            row.ownerId !== ownerId ||
            row.text !== chunk ||
            row.contentHash !== hashText(chunk) ||
            row.embeddingModel !== config.embedding.model ||
            row.embeddingDimensions !== dimensions
          )
            return false;
          try {
            validateVector(JSON.parse(row.embedding), dimensions);
            return true;
          } catch {
            return false;
          } // Invalid legacy sources require regeneration; never adopt their vectors.
        });
      if (matches) reusable.push(...rows.map((row) => ({ ...row, metadata: document.metadata })));
      else pending.push({ sourceType, sourceId: source.id, ownerId });
    }
  }
  return { legacyChunks: legacy.length, sources, reusable, pending, auditedSources };
}
