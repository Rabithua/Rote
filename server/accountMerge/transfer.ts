import { eq } from 'drizzle-orm';
import { users } from '../drizzle/schema';
import { enqueueBackfillEmbeddingJobsForOwner } from '../utils/dbMethods/ai';
import { assertMergeBillingAllowed } from './accounts';
import { transferContentOwnership } from './contentOwnership';
import { AccountMergeError } from './errors';
import { transferOAuthOwnership } from './oauthOwnership';
import { transferProfileOwnership } from './profileOwnership';
import { transferPushOwnership } from './pushOwnership';
import type { AccountMergeResult, AccountMergeTransaction, MergeAccounts } from './types';

export async function transferAccountOwnership(
  transaction: AccountMergeTransaction,
  accounts: MergeAccounts
): Promise<{ result: AccountMergeResult; shouldBackfillTargetEmbeddings: boolean }> {
  await assertMergeBillingAllowed(transaction, accounts);
  const mergedData = {
    notes: 0,
    attachments: 0,
    reactions: 0,
    openKeys: 0,
    subscriptions: 0,
    apnsDevices: 0,
    pushEvents: 0,
    changes: 0,
    aiConversations: 0,
  };
  const sourceId = accounts.source.id;
  const targetId = accounts.target.id;
  await transferContentOwnership(transaction, sourceId, targetId, mergedData);
  await transferPushOwnership(transaction, sourceId, targetId, mergedData);
  const shouldBackfillTargetEmbeddings = await transferProfileOwnership(
    transaction,
    accounts.source,
    accounts.target
  );
  const migratedBindings = await transferOAuthOwnership(transaction, sourceId, targetId);
  const deleted = await transaction
    .delete(users)
    .where(eq(users.id, sourceId))
    .returning({ id: users.id });
  if (deleted.length !== 1) throw new AccountMergeError('oauth_merge_conflict');
  return {
    result: { success: true, mergedData, migratedBindings },
    shouldBackfillTargetEmbeddings,
  };
}

export function afterAccountMergeCommit(targetUserId: string, shouldBackfill: boolean): void {
  if (!shouldBackfill) return;
  void enqueueBackfillEmbeddingJobsForOwner(targetUserId).catch(() => {
    process.stderr.write('account_merge_embedding_backfill_failed\n');
  });
}
