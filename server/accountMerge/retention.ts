import { and, eq, isNull, lte, or } from 'drizzle-orm';
import { oauthMergeAuthorizations } from '../drizzle/accountMergeSchema';
import db from '../utils/drizzle';

export const OAUTH_MERGE_RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;
export const OAUTH_MERGE_CLEANUP_BATCH_SIZE = 100;

// Opportunistic maintenance is bounded and never waits for an active merge's
// grant lock. Expiration is enforced independently when authorizing a request.
export async function cleanupOAuthMergeAuthorizations(): Promise<number> {
  return db.transaction(async (transaction) => {
    const now = new Date();
    const expired = await transaction
      .select()
      .from(oauthMergeAuthorizations)
      .where(
        or(
          and(
            isNull(oauthMergeAuthorizations.completedAt),
            lte(oauthMergeAuthorizations.expiresAt, now)
          ),
          lte(
            oauthMergeAuthorizations.completedAt,
            new Date(now.getTime() - OAUTH_MERGE_RECEIPT_TTL_MS)
          )
        )
      )
      .limit(OAUTH_MERGE_CLEANUP_BATCH_SIZE)
      .for('update', { skipLocked: true });
    if (!expired.length) return 0;
    await transaction
      .delete(oauthMergeAuthorizations)
      .where(
        or(
          ...expired.map((row) =>
            and(
              eq(oauthMergeAuthorizations.targetUserId, row.targetUserId),
              eq(oauthMergeAuthorizations.sourceUserId, row.sourceUserId),
              eq(oauthMergeAuthorizations.provider, row.provider),
              eq(oauthMergeAuthorizations.providerId, row.providerId)
            )
          )
        )
      );
    return expired.length;
  });
}
