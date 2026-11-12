import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { users } from '../../drizzle/schema';
import { prepareAccountResourceDeletion } from '../../resources/service';
import { lockMergeAccounts } from '../../accountMerge/accounts';
import { transferAccountOwnership, afterAccountMergeCommit } from '../../accountMerge/transfer';
import type { AccountMergeResult } from '../../accountMerge/types';
import db from '../drizzle';
import { verifyDeleteGrantToken } from '../../oauthAccounts/deleteConfirm';
import { DatabaseError } from './common';

// 删除用户账户
// 有密码的用户验证密码；仅 OAuth / Passkey 登录的用户必须携带
// provider 再授权或 Passkey 断言通过后签发的删除授予令牌。
export async function deleteUserAccount(
  userid: string,
  verification: { password?: string; deleteGrant?: string }
): Promise<any> {
  try {
    // 1. 验证用户存在
    const [user] = await db.select().from(users).where(eq(users.id, userid)).limit(1);

    if (!user) {
      throw new DatabaseError('User not found');
    }

    // 2. 按登录方式验证
    if (user.passwordhash && user.salt) {
      const password = verification.password;
      if (!password) {
        throw new Error('Password confirmation is required');
      }
      const passwordhashToVerify = crypto.pbkdf2Sync(password, user.salt, 310000, 32, 'sha256');

      if (
        Buffer.from(passwordhashToVerify).toString('hex') !==
        Buffer.from(user.passwordhash).toString('hex')
      ) {
        throw new Error('Incorrect password');
      }
    } else {
      const grantVerified = await verifyDeleteGrantToken(verification.deleteGrant, userid);
      // 旧客户端兼容：接受仅带非空 password 的请求体。
      // TODO(removal): 当所有已发布客户端都改为携带删除授予令牌后移除该分支。
      if (!grantVerified && !verification.password) {
        throw new Error('Re-authentication is required to delete this account');
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
