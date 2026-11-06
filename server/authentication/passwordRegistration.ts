import crypto from 'crypto';
import type { z } from 'zod';
import { users } from '../drizzle/schema';
import { notifyUserRegistered } from '../utils/adminHooks';
import { trackBackgroundTask } from '../utils/backgroundTask';
import { UserIdentityConflict } from '../utils/dbMethods/user';
import db from '../utils/drizzle';
import type { RegisterDataZod } from '../utils/zod';
import { readAuthenticationPolicy, requireAccountRegistration } from './policy';

export async function registerPasswordAccount(data: z.infer<typeof RegisterDataZod>) {
  const salt = crypto.randomBytes(16);
  const passwordhash = crypto.pbkdf2Sync(data.password, salt, 310000, 32, 'sha256');
  let user;
  try {
    user = await db.transaction(async (transaction) => {
      const policy = await readAuthenticationPolicy(transaction);
      requireAccountRegistration(policy);
      const [created] = await transaction
        .insert(users)
        .values({
          username: data.username,
          email: data.email,
          nickname: data.nickname || data.username,
          passwordhash,
          salt,
          role: policy.ui?.defaultUserRole || 'user',
        })
        .returning();
      return created;
    });
  } catch (error) {
    const constraintError =
      (error as { cause?: { code?: string; constraint_name?: string } }).cause ||
      (error as { code?: string; constraint_name?: string });
    if (constraintError.code === '23505') {
      throw new UserIdentityConflict(
        constraintError.constraint_name?.includes('email') ? 'email' : 'username',
        error
      );
    }
    throw error;
  }
  trackBackgroundTask(notifyUserRegistered(user), 'admin_hook_user_registered_failed');
  return user;
}
