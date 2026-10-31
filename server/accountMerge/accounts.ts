import { inArray } from 'drizzle-orm';
import { billingGrants, users } from '../drizzle/schema';
import { AccountMergeError } from './errors';
import type { AccountMergeTransaction, MergeAccounts } from './types';

export async function lockAccountMergeUsers(
  transaction: AccountMergeTransaction,
  sourceUserId: string,
  targetUserId: string
) {
  return transaction
    .select()
    .from(users)
    .where(inArray(users.id, [sourceUserId, targetUserId]))
    .orderBy(users.id)
    .for('update');
}

export async function lockMergeAccounts(
  transaction: AccountMergeTransaction,
  sourceUserId: string,
  targetUserId: string
): Promise<MergeAccounts> {
  const accounts = await lockAccountMergeUsers(transaction, sourceUserId, targetUserId);
  const source = accounts.find((user) => user.id === sourceUserId);
  const target = accounts.find((user) => user.id === targetUserId);
  if (!source || !target || sourceUserId === targetUserId) {
    throw new AccountMergeError('oauth_merge_conflict');
  }
  return { source, target };
}

export async function assertMergeBillingAllowed(
  transaction: AccountMergeTransaction,
  accounts: MergeAccounts
): Promise<void> {
  // Billing grant writers acquire the same users locks before changing grants.
  const billing = await transaction
    .select({ status: billingGrants.status })
    .from(billingGrants)
    .where(inArray(billingGrants.userId, [accounts.source.id, accounts.target.id]));
  if (billing.some((grant) => grant.status !== 'none')) {
    throw new AccountMergeError('oauth_merge_billing_blocked');
  }
}
