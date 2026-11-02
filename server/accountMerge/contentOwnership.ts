import { eq, sql } from 'drizzle-orm';
import { mergeAiConversationOwnership } from '../aiConversations/repository';
import {
  attachments,
  reactions,
  roteChanges,
  rotes,
  resourceStorageAccounts,
  resourceStorageObjects,
  userOpenKeys,
} from '../drizzle/schema';
import { cancelPendingUploadReservationsForUser } from '../resources/service';
import { recordRoteChanges } from '../sync/journal';
import type { AccountMergeTransaction, MergedAccountData } from './types';

export async function transferContentOwnership(
  tx: AccountMergeTransaction,
  sourceUserId: string,
  targetUserId: string,
  mergedData: MergedAccountData
): Promise<void> {
  mergedData.aiConversations = await mergeAiConversationOwnership(tx, sourceUserId, targetUserId);

  // 2. 合并笔记
  const notesResult = await tx
    .update(rotes)
    .set({ authorid: targetUserId, updatedAt: new Date() })
    .where(eq(rotes.authorid, sourceUserId))
    .returning({ id: rotes.id });
  mergedData.notes = notesResult.length;

  // 3. 合并附件
  const attachmentsResult = await tx
    .update(attachments)
    .set({ userid: targetUserId, updatedAt: new Date() })
    .where(eq(attachments.userid, sourceUserId))
    .returning({ id: attachments.id });
  mergedData.attachments = attachmentsResult.length;

  // 4. 合并反应
  const reactionNotes = await tx
    .selectDistinct({ id: rotes.id, authorid: rotes.authorid })
    .from(rotes)
    .innerJoin(reactions, eq(reactions.roteid, rotes.id))
    .where(eq(reactions.userid, sourceUserId));
  const reactionsResult = await tx
    .update(reactions)
    .set({ userid: targetUserId, updatedAt: new Date() })
    .where(eq(reactions.userid, sourceUserId))
    .returning({ id: reactions.id });
  mergedData.reactions = reactionsResult.length;

  // 5. 合并笔记变更历史
  const changesResult = await tx
    .update(roteChanges)
    .set({ userid: targetUserId, revision: null })
    .where(eq(roteChanges.userid, sourceUserId))
    .returning({ id: roteChanges.id });
  mergedData.changes = changesResult.length;

  // Transferred audit history is not part of the target's ordered feed.
  // Publish the transferred current notes at fresh target revisions.
  const changedByOwner = new Map<string, Map<string, 'CREATE' | 'UPDATE'>>();
  changedByOwner.set(targetUserId, new Map(notesResult.map((note) => [note.id, 'CREATE'])));
  for (const note of reactionNotes) {
    const changes = changedByOwner.get(note.authorid) ?? new Map<string, 'CREATE' | 'UPDATE'>();
    if (!changes.has(note.id)) changes.set(note.id, 'UPDATE');
    changedByOwner.set(note.authorid, changes);
  }
  // Use one stable counter-lock order when a merge affects multiple owners.
  for (const ownerId of [...changedByOwner.keys()].sort()) {
    await recordRoteChanges(
      tx,
      ownerId,
      [...changedByOwner.get(ownerId)!.entries()].map(([originid, action]) => ({
        originid,
        action,
      }))
    );
  }

  // 6. 合并 API 密钥
  const openKeysResult = await tx
    .update(userOpenKeys)
    .set({ userid: targetUserId, updatedAt: new Date() })
    .where(eq(userOpenKeys.userid, sourceUserId))
    .returning({ id: userOpenKeys.id });
  mergedData.openKeys = openKeysResult.length;

  // Managed storage follows ownership. Existing objects are never deleted
  // merely because the destination is over its current quota; subsequent
  // creates are evaluated against the combined usage.
  const [sourceStorage] = await tx
    .select()
    .from(resourceStorageAccounts)
    .where(eq(resourceStorageAccounts.userId, sourceUserId))
    .limit(1)
    .for('update');
  const [targetStorage] = await tx
    .select()
    .from(resourceStorageAccounts)
    .where(eq(resourceStorageAccounts.userId, targetUserId))
    .limit(1)
    .for('update');
  await cancelPendingUploadReservationsForUser(sourceUserId, tx);
  await tx
    .update(resourceStorageObjects)
    .set({ ownerId: targetUserId, updatedAt: new Date() })
    .where(eq(resourceStorageObjects.ownerId, sourceUserId));
  if (sourceStorage) {
    await tx
      .insert(resourceStorageAccounts)
      .values({
        userId: targetUserId,
        usedBytes: (targetStorage?.usedBytes ?? BigInt(0)) + sourceStorage.usedBytes,
        reservedBytes: targetStorage?.reservedBytes ?? BigInt(0),
      })
      .onConflictDoUpdate({
        target: resourceStorageAccounts.userId,
        set: {
          usedBytes: sql`${resourceStorageAccounts.usedBytes} + ${sourceStorage.usedBytes}`,
          updatedAt: new Date(),
        },
      });
    await tx
      .delete(resourceStorageAccounts)
      .where(eq(resourceStorageAccounts.userId, sourceUserId));
  }
}
