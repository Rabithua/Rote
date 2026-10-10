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
  const [note] = await transaction
    .select({ id: rotes.id, authorid: rotes.authorid })
    .from(rotes)
    .where(eq(rotes.id, noteId));
  if (!note) throw new Error('Note not found');
  await lockSyncOwner(transaction, note.authorid);
  // Account merges can move the note while we wait for its former owner.
  const [current] = await transaction
    .select({ id: rotes.id, authorid: rotes.authorid })
    .from(rotes)
    .where(eq(rotes.id, noteId));
  if (!current || current.authorid !== note.authorid) throw new Error('Note ownership changed');
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
  return transaction
    .insert(roteChanges)
    .values(
      changes.map((change, index) => ({
        ...change,
        roteid: change.roteid ?? change.originid,
        userid: userId,
        revision: firstRevision + BigInt(index),
        createdAt: sql`clock_timestamp()`,
      }))
    )
    .returning({ id: roteChanges.id, originid: roteChanges.originid, action: roteChanges.action });
}
