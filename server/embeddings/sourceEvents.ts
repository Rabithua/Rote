import { and, asc, eq, inArray } from 'drizzle-orm';
import { hasCapability } from '../authz/capabilityService';
import {
  articles,
  rotes,
  documentEmbeddings,
  embeddingJobs,
  embeddingSourceEvents,
} from '../drizzle/schema';
import db from '../utils/drizzle';
import { lockIndexState, readAiSnapshot } from './configStore';
import { canQueueIndex, queueSource } from './queue';

// Source mutations insert these events in their own transaction. Consumption
// locks only the outbox and queue; source rows are read later by the processor.
export async function consumeSourceEvents(pageSize = 100) {
  await db.transaction(async (tx) => {
    await lockIndexState(tx);
    const { config, state } = await readAiSnapshot(tx);
    const canQueue = canQueueIndex(config, state);
    const deferUpserts = state.generationReusable && !canQueue;
    const events = await tx
      .select()
      .from(embeddingSourceEvents)
      // Deferred upserts must not occupy the page ahead of actionable deletions.
      .where(deferUpserts ? eq(embeddingSourceEvents.action, 'delete') : undefined)
      .orderBy(asc(embeddingSourceEvents.createdAt), asc(embeddingSourceEvents.id))
      .limit(pageSize)
      .for('update', { skipLocked: true });
    const consumed: string[] = [];
    for (const event of events) {
      const table = event.sourceType === 'rote' ? rotes : articles;
      const owner = event.sourceType === 'rote' ? rotes.authorid : articles.authorId;
      const [source] = await tx
        .select({ ownerId: owner })
        .from(table)
        .where(eq(table.id, event.sourceId));
      if (!source || !(await hasCapability(source.ownerId, 'ai.chat'))) {
        await tx
          .delete(documentEmbeddings)
          .where(
            and(
              eq(documentEmbeddings.sourceType, event.sourceType),
              eq(documentEmbeddings.sourceId, event.sourceId)
            )
          );
        await tx
          .update(embeddingJobs)
          .set({ status: 'cancelled', leaseToken: null, leaseExpiresAt: null, lockedAt: null })
          .where(
            and(
              eq(embeddingJobs.sourceType, event.sourceType),
              eq(embeddingJobs.sourceId, event.sourceId),
              inArray(embeddingJobs.status, ['pending', 'running', 'failed'])
            )
          );
      } else if (
        canQueue &&
        (config.autoIndexEnabled ||
          state.status !== 'ready' ||
          event.rebuilding ||
          event.generationId !== state.generationId)
      ) {
        await queueSource(
          tx,
          state.generationId!,
          event.sourceType,
          event.sourceId,
          source.ownerId
        );
      }
      consumed.push(event.id);
    }
    if (consumed.length)
      await tx.delete(embeddingSourceEvents).where(inArray(embeddingSourceEvents.id, consumed));
  });
}
