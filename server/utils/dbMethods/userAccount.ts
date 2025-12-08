import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import {
  attachments,
  reactions,
  roteChanges,
  rotes,
  userOAuthBindings,
  userOpenKeys,
  userSettings,
  userSwSubscriptions,
  users,
} from '../../drizzle/schema';
import db from '../drizzle';
import { r2deletehandler } from '../r2';
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

    // 3. 查询用户的所有附件（包括已绑定和未绑定的）
    const attachmentsList = await db
      .select({ details: attachments.details })
      .from(attachments)
      .where(eq(attachments.userid, userid));

    // 4. 删除所有附件文件（从 R2/S3）
    attachmentsList.forEach(({ details }) => {
      // @ts-expect-error - details 可能包含动态属性
      const key = details?.key;
      // @ts-expect-error - details 可能包含动态属性
      const compressKey = details?.compressKey;
      if (key) {
        r2deletehandler(key).catch((err) => {
          console.error(`Failed to delete attachment from R2: ${key}`, err);
        });
      }
      if (compressKey) {
        r2deletehandler(compressKey).catch((err) => {
          console.error(`Failed to delete compressed attachment from R2: ${compressKey}`, err);
        });
      }
    });

    // 5. 删除用户记录（数据库会自动级联删除 userSettings, userOpenKeys, userSwSubscriptions, rotes 等）
    // 附件和反应记录的外键设置为 set null，删除用户后会自动设为 null
    await db.delete(users).where(eq(users.id, userid));

    return { success: true };
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError('Failed to delete user account', error);
  }
}

// 合并账户：将源账户的数据合并到目标账户
export async function mergeUserAccounts(
  sourceUserId: string,
  targetUserId: string
): Promise<{
  success: boolean;
  mergedData: any;
  migratedBindings: Array<{ provider: string; providerId: string }>;
}> {
  // 使用事务确保操作的原子性
  return await db.transaction(async (tx) => {
    try {
      // 1. 验证两个用户都存在（在事务内验证，避免竞态条件）
      const [sourceUser] = await tx.select().from(users).where(eq(users.id, sourceUserId)).limit(1);
      const [targetUser] = await tx.select().from(users).where(eq(users.id, targetUserId)).limit(1);

      if (!sourceUser || !targetUser) {
        throw new DatabaseError('Source or target user not found');
      }

      if (sourceUserId === targetUserId) {
        throw new DatabaseError('Cannot merge account with itself');
      }
      const mergedData: any = {
        notes: 0,
        attachments: 0,
        reactions: 0,
        openKeys: 0,
        subscriptions: 0,
        changes: 0,
      };

      // 2. 合并笔记
      const notesResult = await tx
        .update(rotes)
        .set({ authorid: targetUserId, updatedAt: new Date() })
        .where(eq(rotes.authorid, sourceUserId))
        .returning({ id: rotes.id });
      mergedData.notes = notesResult.length;

      // 3. 合并附件
      const attachmentsResult = await tx
        .update(attachments)
        .set({ userid: targetUserId, updatedAt: new Date() })
        .where(eq(attachments.userid, sourceUserId))
        .returning({ id: attachments.id });
      mergedData.attachments = attachmentsResult.length;

      // 4. 合并反应
      const reactionsResult = await tx
        .update(reactions)
        .set({ userid: targetUserId, updatedAt: new Date() })
        .where(eq(reactions.userid, sourceUserId))
        .returning({ id: reactions.id });
      mergedData.reactions = reactionsResult.length;

      // 5. 合并笔记变更历史
      const changesResult = await tx
        .update(roteChanges)
        .set({ userid: targetUserId })
        .where(eq(roteChanges.userid, sourceUserId))
        .returning({ id: roteChanges.id });
      mergedData.changes = changesResult.length;

      // 6. 合并 API 密钥
      const openKeysResult = await tx
        .update(userOpenKeys)
        .set({ userid: targetUserId, updatedAt: new Date() })
        .where(eq(userOpenKeys.userid, sourceUserId))
        .returning({ id: userOpenKeys.id });
      mergedData.openKeys = openKeysResult.length;

      // 7. 合并推送订阅（endpoint 唯一，需要处理冲突）
      const sourceSubscriptions = await tx
        .select()
        .from(userSwSubscriptions)
        .where(eq(userSwSubscriptions.userid, sourceUserId));

      for (const sub of sourceSubscriptions) {
        const [existing] = await tx
          .select()
          .from(userSwSubscriptions)
          .where(eq(userSwSubscriptions.endpoint, sub.endpoint))
          .limit(1);

        if (existing && existing.userid === targetUserId) {
          await tx.delete(userSwSubscriptions).where(eq(userSwSubscriptions.id, sub.id));
        } else {
          await tx
            .update(userSwSubscriptions)
            .set({ userid: targetUserId, updatedAt: new Date() })
            .where(eq(userSwSubscriptions.id, sub.id));
          mergedData.subscriptions++;
        }
      }

      // 8. 合并用户设置（目标用户没有时使用源用户的，否则保留目标用户的）
      const [targetSettings] = await tx
        .select()
        .from(userSettings)
        .where(eq(userSettings.userid, targetUserId))
        .limit(1);

      const [sourceSettings] = await tx
        .select()
        .from(userSettings)
        .where(eq(userSettings.userid, sourceUserId))
        .limit(1);

      if (sourceSettings && !targetSettings) {
        await tx.insert(userSettings).values({
          userid: targetUserId,
          darkmode: sourceSettings.darkmode,
          allowExplore: sourceSettings.allowExplore,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // 9. 合并用户资料字段（目标用户没有时使用源用户的）
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (!targetUser.avatar && sourceUser.avatar) {
        updateData.avatar = sourceUser.avatar;
      }

      if (!targetUser.nickname && sourceUser.nickname) {
        updateData.nickname = sourceUser.nickname;
      }

      if (!targetUser.description && sourceUser.description) {
        updateData.description = sourceUser.description;
      }

      if (!targetUser.cover && sourceUser.cover) {
        updateData.cover = sourceUser.cover;
      }

      // 邮箱验证状态（邮箱本身因唯一约束保留目标用户的）
      if (!targetUser.emailVerified && sourceUser.emailVerified) {
        updateData.emailVerified = true;
      }

      if (Object.keys(updateData).length > 1) {
        await tx.update(users).set(updateData).where(eq(users.id, targetUserId));
      }

      // 10. 迁移 OAuth 绑定（使用 UPDATE 避免 unique_provider_id 约束冲突）
      const sourceBindings = await tx
        .select()
        .from(userOAuthBindings)
        .where(eq(userOAuthBindings.userid, sourceUserId));

      const targetBindings = await tx
        .select()
        .from(userOAuthBindings)
        .where(eq(userOAuthBindings.userid, targetUserId));

      const targetProviderSet = new Set(targetBindings.map((b) => b.provider));
      const targetBindingSet = new Set(targetBindings.map((b) => `${b.provider}:${b.providerId}`));
      const migratedBindings: Array<{ provider: string; providerId: string }> = [];

      for (const binding of sourceBindings) {
        if (targetProviderSet.has(binding.provider)) {
          console.log(
            `Deleting OAuth binding for provider ${binding.provider} from source user: target user already has binding`
          );
          await tx.delete(userOAuthBindings).where(eq(userOAuthBindings.id, binding.id));
          continue;
        }

        const bindingKey = `${binding.provider}:${binding.providerId}`;
        if (targetBindingSet.has(bindingKey)) {
          console.log(
            `Deleting OAuth binding for ${binding.provider}:${binding.providerId} from source user: target user already has this exact binding`
          );
          await tx.delete(userOAuthBindings).where(eq(userOAuthBindings.id, binding.id));
          continue;
        }

        try {
          const updateResult = await tx
            .update(userOAuthBindings)
            .set({
              userid: targetUserId,
              updatedAt: new Date(),
            })
            .where(eq(userOAuthBindings.id, binding.id))
            .returning();

          if (updateResult.length > 0) {
            migratedBindings.push({
              provider: binding.provider,
              providerId: binding.providerId,
            });

            console.log(
              `Migrated OAuth binding: ${binding.provider} (${binding.providerId}) from ${sourceUserId} to ${targetUserId}`
            );
          } else {
            console.warn(
              `Failed to update OAuth binding ${binding.provider}:${binding.providerId}: binding not found`
            );
          }
        } catch (updateError: any) {
          if (
            updateError?.code === '23505' ||
            updateError?.message?.includes('unique constraint') ||
            updateError?.message?.includes('duplicate key')
          ) {
            console.warn(
              `Unique constraint violation when updating OAuth binding ${binding.provider}:${binding.providerId}. ` +
                `Deleting source binding to prevent data inconsistency.`
            );
            await tx.delete(userOAuthBindings).where(eq(userOAuthBindings.id, binding.id));
            continue;
          }
          throw updateError;
        }
      }

      // 11. 删除源用户账户
      console.log(`Attempting to delete source user: ${sourceUserId}`);

      const [sourceUserBeforeDelete] = await tx
        .select()
        .from(users)
        .where(eq(users.id, sourceUserId))
        .limit(1);

      if (!sourceUserBeforeDelete) {
        console.warn(`Source user ${sourceUserId} does not exist, skipping delete`);
      } else {
        const deleteResult = await tx.delete(users).where(eq(users.id, sourceUserId)).returning();

        if (deleteResult.length === 0) {
          console.error(`Failed to delete source user: ${sourceUserId}`);
          throw new DatabaseError('Failed to delete source user account');
        }

        console.log(
          `Successfully deleted source user: ${sourceUserId} (${sourceUserBeforeDelete.username}), merged to: ${targetUserId} (${targetUser.username})`
        );
      }

      return {
        success: true,
        mergedData,
        migratedBindings,
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to merge user accounts', error);
    }
  });
}
