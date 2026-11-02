import { and, eq, isNull, sql } from 'drizzle-orm';
import { userOAuthBindings } from '../drizzle/schema';
import { oauthMergeAuthorizations } from '../drizzle/accountMergeSchema';
import db from '../utils/drizzle';
import { lockAccountMergeUsers, lockMergeAccounts } from './accounts';
import { AccountMergeError } from './errors';
import { readOAuthMergeEnabled } from './providerPolicy';
import { cleanupOAuthMergeAuthorizations, OAUTH_MERGE_RECEIPT_TTL_MS } from './retention';
import { afterAccountMergeCommit, transferAccountOwnership } from './transfer';
import type { AccountMergeResult, AccountMergeTransaction, OAuthMergeIdentity } from './types';

export const OAUTH_MERGE_AUTHORIZATION_TTL_MS = 10 * 60 * 1000;

function identityCondition(identity: OAuthMergeIdentity) {
  return and(
    eq(oauthMergeAuthorizations.targetUserId, identity.targetUserId),
    eq(oauthMergeAuthorizations.sourceUserId, identity.sourceUserId),
    eq(oauthMergeAuthorizations.provider, identity.provider),
    eq(oauthMergeAuthorizations.providerId, identity.providerId)
  );
}

async function lockVerifiedSourceBinding(
  transaction: AccountMergeTransaction,
  identity: OAuthMergeIdentity,
  sourceBindingId?: string
) {
  const [binding] = await transaction
    .select()
    .from(userOAuthBindings)
    .where(
      and(
        eq(userOAuthBindings.userid, identity.sourceUserId),
        eq(userOAuthBindings.provider, identity.provider),
        eq(userOAuthBindings.providerId, identity.providerId),
        sourceBindingId ? eq(userOAuthBindings.id, sourceBindingId) : undefined
      )
    )
    .for('update');
  const [targetBinding] = await transaction
    .select({ id: userOAuthBindings.id })
    .from(userOAuthBindings)
    .where(
      and(
        eq(userOAuthBindings.userid, identity.targetUserId),
        eq(userOAuthBindings.provider, identity.provider)
      )
    );
  if (!binding || targetBinding) throw new AccountMergeError('oauth_merge_conflict');
  return binding;
}

// Only the successful provider callback may issue this authorization. The state
// supplied at initiation and the IDs supplied by a merge request cannot issue it.
export async function authorizeOAuthAccountMerge(identity: OAuthMergeIdentity): Promise<void> {
  await cleanupOAuthMergeAuthorizations();
  await db.transaction(async (transaction) => {
    if (!(await readOAuthMergeEnabled(transaction, identity.provider))) {
      throw new AccountMergeError('oauth_merge_disabled');
    }
    await lockMergeAccounts(transaction, identity.sourceUserId, identity.targetUserId);
    const binding = await lockVerifiedSourceBinding(transaction, identity);
    const now = new Date();
    await transaction
      .insert(oauthMergeAuthorizations)
      .values({
        ...identity,
        sourceBindingId: binding.id,
        expiresAt: new Date(now.getTime() + OAUTH_MERGE_AUTHORIZATION_TTL_MS),
      })
      .onConflictDoUpdate({
        target: [
          oauthMergeAuthorizations.targetUserId,
          oauthMergeAuthorizations.sourceUserId,
          oauthMergeAuthorizations.provider,
          oauthMergeAuthorizations.providerId,
        ],
        set: {
          sourceBindingId: binding.id,
          expiresAt: new Date(now.getTime() + OAUTH_MERGE_AUTHORIZATION_TTL_MS),
        },
        setWhere: isNull(oauthMergeAuthorizations.completedAt),
      });
  });
}

export async function completeOAuthAccountMerge(
  identity: OAuthMergeIdentity
): Promise<AccountMergeResult> {
  await cleanupOAuthMergeAuthorizations();
  const completed = await db.transaction(async (transaction) => {
    const enabled = await readOAuthMergeEnabled(transaction, identity.provider);
    // Lock users before grants. User deletion can cascade grants where that user
    // is a target, so the reverse lock order can deadlock two competing merges.
    const users = await lockAccountMergeUsers(
      transaction,
      identity.sourceUserId,
      identity.targetUserId
    );
    const [authorization] = await transaction
      .select()
      .from(oauthMergeAuthorizations)
      .where(identityCondition(identity))
      .for('update');
    const now = new Date();
    if (!authorization) throw new AccountMergeError('oauth_merge_authorization_required');
    const target = users.find((user) => user.id === identity.targetUserId);
    if (!target) throw new AccountMergeError('oauth_merge_authorization_required');
    if (authorization.completedAt) {
      if (
        authorization.completedAt.getTime() + OAUTH_MERGE_RECEIPT_TTL_MS <= now.getTime() ||
        !authorization.result
      ) {
        throw new AccountMergeError('oauth_merge_authorization_required');
      }
      return { result: authorization.result, shouldBackfillTargetEmbeddings: false };
    }
    if (!enabled) throw new AccountMergeError('oauth_merge_disabled');
    if (authorization.expiresAt <= now)
      throw new AccountMergeError('oauth_merge_authorization_required');
    const source = users.find((user) => user.id === identity.sourceUserId);
    if (!source || source.id === target.id) throw new AccountMergeError('oauth_merge_conflict');
    await lockVerifiedSourceBinding(transaction, identity, authorization.sourceBindingId);
    const transferred = await transferAccountOwnership(transaction, { source, target });
    if (
      !transferred.result.migratedBindings.some(
        (binding) =>
          binding.provider === identity.provider && binding.providerId === identity.providerId
      )
    ) {
      throw new AccountMergeError('oauth_merge_conflict');
    }
    await transaction
      .update(oauthMergeAuthorizations)
      .set({ completedAt: sql`clock_timestamp()`, result: transferred.result })
      .where(identityCondition(identity));
    return transferred;
  });
  afterAccountMergeCommit(identity.targetUserId, completed.shouldBackfillTargetEmbeddings);
  return completed.result;
}
