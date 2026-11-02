import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { users } from '../../drizzle/schema';
import { prepareAccountResourceDeletion } from '../../resources/service';
import { lockMergeAccounts } from '../../accountMerge/accounts';
import { transferAccountOwnership, afterAccountMergeCommit } from '../../accountMerge/transfer';
import type { AccountMergeResult } from '../../accountMerge/types';
import db from '../drizzle';
import { DatabaseError } from './common';

// 删除用户账户
export async function deleteUserAccount(userid: string, password: string): Promise<any> {
  try {
    // 1. 验证用户存在
    const [user] = await db.select().from(users).where(eq(users.id, userid)).limit(1);

    if (!user) {
      throw new DatabaseError('User not found');
    }

    // 2. 验证密码（仅对有密码的用户）
    if (user.passwordhash && user.salt) {
      const passwordhashToVerify = crypto.pbkdf2Sync(password, user.salt, 310000, 32, 'sha256');

      if (
        Buffer.from(passwordhashToVerify).toString('hex') !==
        Buffer.from(user.passwordhash).toString('hex')
      ) {
        throw new Error('Incorrect password');
      }
    } else {
      // OAuth 用户不需要密码验证，但为了安全，仍然需要传递一个占位符
      // 前端应该已经通过 JWT 认证确认了用户身份
      if (!password) {
        throw new Error('Password confirmation is required');
      }
    }

    // Persist the managed cleanup manifest and release logical usage before the
    // user FK can be nulled/cascaded. Object-store availability never blocks
    // the account deletion itself.
    await db.transaction(async (tx) => {
      await prepareAccountResourceDeletion(userid, tx);
      // 删除用户和持久化清理清单属于同一提交；worker 不可能清理仍存活账户的数据。
      await tx.delete(users).where(eq(users.id, userid));
    });

    return { success: true };
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError('Failed to delete user account', error);
  }
}

// Trusted internal operation. HTTP OAuth merges must use completeOAuthAccountMerge,
// which consumes the verified-provider authorization inside this same transaction.
export async function mergeUserAccounts(
  sourceUserId: string,
  targetUserId: string
): Promise<AccountMergeResult> {
  const transferred = await db.transaction(async (tx) => {
    const accounts = await lockMergeAccounts(tx, sourceUserId, targetUserId);
    return transferAccountOwnership(tx, accounts);
  });
  afterAccountMergeCommit(targetUserId, transferred.shouldBackfillTargetEmbeddings);
  return transferred.result;
}
