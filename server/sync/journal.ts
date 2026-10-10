import { eq, sql } from 'drizzle-orm';
import { roteChanges, roteSyncStates, rotes, users } from '../drizzle/schema';
import db from '../utils/drizzle';

export type SyncTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface RoteChangeInput {
  originid: string;
  roteid?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  userid: string;
}

// Acquire the existing owner lock before note/attachment/reaction locks. Keep
// network and storage work outside this transaction.
export async function lockSyncOwner(transaction: SyncTransaction, userId: string) {
  const [user] = await transaction
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .for('update');
  if (!user) throw new Error('User not found');
}

export async function lockNoteSyncOwner(transaction: SyncTransaction, noteId: string) {
  // Serialize owner mutations without blocking FK references from a merge's
  // new sync-state row back to this owner.
  const [note] = await transaction
    .select({ id: rotes.id, authorid: rotes.authorid })
    .from(rotes)
    .where(eq(rotes.id, noteId));
  if (!note) return undefined;
  await transaction
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, note.authorid))
    .for('no key update');
  // Account merges can move the note while we wait for its former owner.
  const [current] = await transaction
    .select({ id: rotes.id, authorid: rotes.authorid })
    .from(rotes)
    .where(eq(rotes.id, noteId));
  if (!current) return undefined;
  if (current.authorid !== note.authorid) throw new Error('Note ownership changed');
  return current;
}

export async function recordRoteChanges(
  transaction: SyncTransaction,
  userId: string,
  changes: Omit<RoteChangeInput, 'userid'>[]
) {
  if (changes.length === 0) return [];
  // This row lock lasts until commit, so a later revision cannot commit before
  // this batch. PostgreSQL sequences alone do not provide that guarantee.
  const [state] = await transaction
    .insert(roteSyncStates)
    .values({ userid: userId, revision: BigInt(changes.length) })
    .onConflictDoUpdate({
      target: roteSyncStates.userid,
      set: { revision: sql`${roteSyncStates.revision} + ${changes.length}` },
    })
    .returning();
  const firstRevision = state.revision - BigInt(changes.length) + BigInt(1);
  const inserted: { id: string; originid: string; action: string }[] = [];
  // Bound SQL parameters while retaining one revision allocation and commit.
  for (let offset = 0; offset < changes.length; offset += 1000) {
    const rows = await transaction
      .insert(roteChanges)
      .values(
        changes.slice(offset, offset + 1000).map((change, index) => ({
          ...change,
          roteid: change.roteid ?? change.originid,
          userid: userId,
          revision: firstRevision + BigInt(offset + index),
          createdAt: sql`clock_timestamp()`,
        }))
      )
      .returning({
        id: roteChanges.id,
        originid: roteChanges.originid,
        action: roteChanges.action,
      });
    inserted.push(...rows);
  }
  return inserted;
}
