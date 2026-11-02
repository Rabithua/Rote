import { eq } from 'drizzle-orm';
import { userOAuthBindings } from '../drizzle/schema';
import type { AccountMergeTransaction } from './types';

export async function transferOAuthOwnership(
  transaction: AccountMergeTransaction,
  sourceUserId: string,
  targetUserId: string
): Promise<Array<{ provider: string; providerId: string }>> {
  const sourceBindings = await transaction
    .select()
    .from(userOAuthBindings)
    .where(eq(userOAuthBindings.userid, sourceUserId))
    .orderBy(userOAuthBindings.id)
    .for('update');
  const targetBindings = await transaction
    .select()
    .from(userOAuthBindings)
    .where(eq(userOAuthBindings.userid, targetUserId));
  const targetProviders = new Set(targetBindings.map((binding) => binding.provider));
  const migratedBindings: Array<{ provider: string; providerId: string }> = [];

  for (const binding of sourceBindings) {
    if (targetProviders.has(binding.provider)) {
      await transaction.delete(userOAuthBindings).where(eq(userOAuthBindings.id, binding.id));
      continue;
    }
    // Users locks serialize binding writers. A database error must roll back the
    // complete merge, rather than deleting a binding after a failed statement.
    await transaction
      .update(userOAuthBindings)
      .set({ userid: targetUserId, updatedAt: new Date() })
      .where(eq(userOAuthBindings.id, binding.id));
    migratedBindings.push({ provider: binding.provider, providerId: binding.providerId });
  }
  return migratedBindings;
}
