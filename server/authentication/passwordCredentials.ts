import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { users } from '../drizzle/schema';
import db from '../utils/drizzle';
import {
  hasRemainingLoginMethod,
  LastLoginMethodError,
  lockUserLoginMethods,
} from './loginMethods';
import messages from './messages.json';

export class PasswordCredentialError extends Error {
  constructor(
    public readonly errorCode:
      | 'user_not_found'
      | 'current_password_required'
      | 'incorrect_password',
    message: string
  ) {
    super(message);
    this.name = 'PasswordCredentialError';
  }
}

export async function clearUserPassword(userId: string, password?: string) {
  return db.transaction(async (transaction) => {
    const state = await lockUserLoginMethods(transaction, userId);
    if (!state) throw new PasswordCredentialError('user_not_found', messages.userNotFound);
    const { user, methods } = state;
    if (user.passwordhash && user.salt) {
      if (!password) {
        throw new PasswordCredentialError(
          'current_password_required',
          messages.currentPasswordRequired
        );
      }
      const derived = await new Promise<Buffer>((resolve, reject) => {
        crypto.pbkdf2(password, user.salt!, 310000, 32, 'sha256', (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });
      if (!crypto.timingSafeEqual(user.passwordhash, derived)) {
        throw new PasswordCredentialError('incorrect_password', messages.incorrectPassword);
      }
    }
    if (!hasRemainingLoginMethod(methods, { type: 'password' })) {
      throw new LastLoginMethodError();
    }
    const [updatedUser] = await transaction
      .update(users)
      .set({ passwordhash: null, salt: null, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  });
}
