import { and, asc, eq, gt, lte } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { roteChanges, rotes, roteSyncStates } from '../drizzle/schema';
import db from '../utils/drizzle';
import { decodeSyncCursor, encodeSyncCursor } from './cursor';

export async function readSyncSnapshot(userId: string) {
  return db.transaction(
    async (transaction) => {
      const [state] = await transaction
        .select()
        .from(roteSyncStates)
        .where(eq(roteSyncStates.userid, userId));
      const notes = await transaction
        .select({ id: rotes.id })
        .from(rotes)
        .where(eq(rotes.authorid, userId))
        .orderBy(rotes.id);
      return {
        noteIds: notes.map((note) => note.id),
        cursor: encodeSyncCursor(userId, state?.revision ?? BigInt(0)),
      };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' }
  );
}

export async function readSyncChanges(userId: string, token: string | undefined, limit = 100) {
  const cursor = decodeSyncCursor(token, userId);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new HTTPException(400, { message: 'invalid_sync_limit' });
  }
  return db.transaction(
    async (transaction) => {
      const [state] = await transaction
        .select()
        .from(roteSyncStates)
        .where(eq(roteSyncStates.userid, userId));
      const head = state?.revision ?? BigInt(0);
      const after = BigInt(cursor.revision);
      const through = cursor.through !== undefined ? BigInt(cursor.through) : head;
      if (after > head || through > head)
        throw new HTTPException(409, { message: 'sync_cursor_ahead' });
      const rows = await transaction
        .select({
          id: roteChanges.id,
          originid: roteChanges.originid,
          action: roteChanges.action,
          revision: roteChanges.revision,
        })
        .from(roteChanges)
        .where(
          and(
            eq(roteChanges.userid, userId),
            gt(roteChanges.revision, after),
            lte(roteChanges.revision, through)
          )
        )
        .orderBy(asc(roteChanges.revision))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const page = rows.slice(0, limit);
      const position = hasMore ? page[page.length - 1].revision! : through;
      return {
        changes: page.map((change) => ({ ...change, revision: change.revision!.toString() })),
        nextCursor: encodeSyncCursor(userId, position, hasMore ? through : undefined),
        hasMore,
      };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' }
  );
}
