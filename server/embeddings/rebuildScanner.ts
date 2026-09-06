import { asc, eq, gt } from 'drizzle-orm';
import { articles, embeddingIndexState, rotes } from '../drizzle/schema';
import { hasCapability } from '../authz/capabilityService';
import db from '../utils/drizzle';
import { canProcessIndex, lockIndexState, readAiSnapshot } from './configStore';
import { queueSource } from './queue';

export async function scanRebuildPage(pageSize = 100) {
  return db.transaction(async (tx) => {
    await lockIndexState(tx);
    const { config, state } = await readAiSnapshot(tx);
    if (
      !canProcessIndex(config, state) ||
      state.status !== 'rebuilding' ||
      state.scanComplete ||
      config.indexing.paused
    )
      return;
    const table = state.scanSource === 'rote' ? rotes : articles;
    const owner = state.scanSource === 'rote' ? rotes.authorid : articles.authorId;
    const rows = await tx
      .select({ id: table.id, ownerId: owner })
      .from(table)
      .where(state.scanCursor ? gt(table.id, state.scanCursor) : undefined)
      .orderBy(asc(table.id))
      .limit(pageSize);
    for (const row of rows) {
      if (await hasCapability(row.ownerId, 'ai.chat'))
        await queueSource(tx, state.generationId!, state.scanSource, row.id, row.ownerId);
    }
    const complete = rows.length < pageSize;
    await tx
      .update(embeddingIndexState)
      .set({
        scanSource: complete && state.scanSource === 'rote' ? 'article' : state.scanSource,
        scanCursor: complete ? null : rows[rows.length - 1].id,
        scanComplete: complete && state.scanSource === 'article',
        updatedAt: new Date(),
      })
      .where(eq(embeddingIndexState.id, 1));
  });
}
