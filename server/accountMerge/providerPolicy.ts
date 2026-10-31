import { eq } from 'drizzle-orm';
import { settings } from '../drizzle/schema';
import type { SecurityConfig } from '../types/config';
import type { AccountMergeTransaction } from './types';

export async function readOAuthMergeEnabled(
  transaction: AccountMergeTransaction,
  provider: string
): Promise<boolean> {
  // A fresh shared row lock keeps a concurrently disabled provider from being
  // used after that configuration change commits. Process caches are not an
  // authorization source for this destructive account operation.
  const [stored] = await transaction
    .select({ config: settings.config })
    .from(settings)
    .where(eq(settings.group, 'security'))
    .for('share');
  const security = stored?.config as unknown as SecurityConfig | undefined;
  return (
    security?.oauth?.enabled === true && security.oauth.providers?.[provider]?.enabled === true
  );
}
