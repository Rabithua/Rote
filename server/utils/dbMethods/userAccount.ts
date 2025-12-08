import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
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

      // 2. 合并笔记（rotes）
      const notesResult = await tx
        .update(rotes)
        .set({ authorid: targetUserId, updatedAt: new Date() })
        .where(eq(rotes.authorid, sourceUserId))
        .returning({ id: rotes.id });
      mergedData.notes = notesResult.length;

      // 3. 合并附件（attachments）
      const attachmentsResult = await tx
        .update(attachments)
        .set({ userid: targetUserId, updatedAt: new Date() })
        .where(eq(attachments.userid, sourceUserId))
        .returning({ id: attachments.id });
      mergedData.attachments = attachmentsResult.length;

      // 4. 合并反应（reactions）
      const reactionsResult = await tx
        .update(reactions)
        .set({ userid: targetUserId, updatedAt: new Date() })
        .where(eq(reactions.userid, sourceUserId))
        .returning({ id: reactions.id });
      mergedData.reactions = reactionsResult.length;

      // 5. 合并笔记变更历史（roteChanges）
      const changesResult = await tx
        .update(roteChanges)
        .set({ userid: targetUserId })
        .where(eq(roteChanges.userid, sourceUserId))
        .returning({ id: roteChanges.id });
      mergedData.changes = changesResult.length;

      // 6. 合并 API 密钥（userOpenKeys）
      const openKeysResult = await tx
        .update(userOpenKeys)
        .set({ userid: targetUserId, updatedAt: new Date() })
        .where(eq(userOpenKeys.userid, sourceUserId))
        .returning({ id: userOpenKeys.id });
      mergedData.openKeys = openKeysResult.length;

      // 7. 合并推送订阅（userSwSubscriptions）
      // 注意：endpoint 是唯一的，如果目标用户已有相同的 endpoint，需要处理冲突
      const sourceSubscriptions = await tx
        .select()
        .from(userSwSubscriptions)
        .where(eq(userSwSubscriptions.userid, sourceUserId));

      for (const sub of sourceSubscriptions) {
        // 检查目标用户是否已有相同的 endpoint
        const [existing] = await tx
          .select()
          .from(userSwSubscriptions)
          .where(eq(userSwSubscriptions.endpoint, sub.endpoint))
          .limit(1);

        if (existing && existing.userid === targetUserId) {
          // 目标用户已有相同 endpoint，删除源用户的订阅
          await tx.delete(userSwSubscriptions).where(eq(userSwSubscriptions.id, sub.id));
        } else {
          // 迁移订阅到目标用户
          await tx
            .update(userSwSubscriptions)
            .set({ userid: targetUserId, updatedAt: new Date() })
            .where(eq(userSwSubscriptions.id, sub.id));
          mergedData.subscriptions++;
        }
      }

      // 8. 合并用户设置（userSettings）
      // 策略：如果目标用户没有设置，使用源用户的设置；如果两者都有，保留目标用户的设置
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
        // 目标用户没有设置，创建新设置（使用源用户的设置值）
        await tx.insert(userSettings).values({
          userid: targetUserId,
          darkmode: sourceSettings.darkmode,
          allowExplore: sourceSettings.allowExplore,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else if (sourceSettings && targetSettings) {
        // 两者都有设置，优先保留目标用户的设置（不更新）
        // 这样可以确保用户当前的偏好设置不被覆盖
      }

      // 9. 合并用户资料字段（补充策略：如果目标用户没有，使用源用户的）
      const updateData: any = {
        updatedAt: new Date(),
      };

      // 头像：如果目标用户没有，使用源用户的
      if (!targetUser.avatar && sourceUser.avatar) {
        updateData.avatar = sourceUser.avatar;
      }

      // 昵称：如果目标用户没有，使用源用户的
      if (!targetUser.nickname && sourceUser.nickname) {
        updateData.nickname = sourceUser.nickname;
      }

      // 描述：如果目标用户没有，使用源用户的
      if (!targetUser.description && sourceUser.description) {
        updateData.description = sourceUser.description;
      }

      // 封面：如果目标用户没有，使用源用户的
      if (!targetUser.cover && sourceUser.cover) {
        updateData.cover = sourceUser.cover;
      }

      // 邮箱验证状态：如果目标用户未验证但源用户已验证，更新为已验证
      // 注意：邮箱本身保留目标用户的（因为唯一性约束）
      if (!targetUser.emailVerified && sourceUser.emailVerified) {
        updateData.emailVerified = true;
      }

      // 角色：保留目标用户的角色（不覆盖），因为角色通常由管理员设置
      // 如果源用户是管理员而目标用户不是，这可能是安全风险，所以保留目标用户的角色

      if (Object.keys(updateData).length > 1) {
        // 有需要更新的字段
        await tx.update(users).set(updateData).where(eq(users.id, targetUserId));
      }

      // 10. 迁移源账户的所有 OAuth 绑定到目标账户
      // 在删除源账户之前，获取源账户的所有 OAuth 绑定
      const sourceBindings = await tx
        .select()
        .from(userOAuthBindings)
        .where(eq(userOAuthBindings.userid, sourceUserId));

      // 获取目标账户的现有绑定，检查是否有冲突
      const targetBindings = await tx
        .select()
        .from(userOAuthBindings)
        .where(eq(userOAuthBindings.userid, targetUserId));

      // 创建两个集合：一个用于快速检查 provider，一个用于检查 (provider, providerId) 组合
      const targetProviderSet = new Set(targetBindings.map((b) => b.provider));
      const targetBindingSet = new Set(
        targetBindings.map((b) => `${b.provider}:${b.providerId}`)
      );
      const migratedBindings: Array<{ provider: string; providerId: string }> = [];

      // 为每个源账户的绑定创建到目标账户的绑定记录
      for (const binding of sourceBindings) {
        // 检查目标账户是否已有该提供商的绑定（只检查 provider，不检查 providerId）
        if (targetProviderSet.has(binding.provider)) {
          // 如果目标账户已有该提供商的绑定，跳过（保留目标账户的绑定）
          console.log(
            `Skipping OAuth binding migration for provider ${binding.provider}: target user already has binding`
          );
          continue;
        }

        // 检查目标账户是否已有相同的 (provider, providerId) 绑定
        // 这是关键检查：防止重复插入相同的绑定
        const bindingKey = `${binding.provider}:${binding.providerId}`;
        if (targetBindingSet.has(bindingKey)) {
          console.log(
            `Skipping OAuth binding migration for ${binding.provider}:${binding.providerId}: target user already has this exact binding`
          );
          continue;
        }

        // 检查该 providerId 是否已被其他用户使用（双重验证）
        const [existingBinding] = await tx
          .select()
          .from(userOAuthBindings)
          .where(
            and(
              eq(userOAuthBindings.provider, binding.provider),
              eq(userOAuthBindings.providerId, binding.providerId)
            )
          )
          .limit(1);

        // 如果 existingBinding 存在
        if (existingBinding) {
          if (existingBinding.userid === targetUserId) {
            // 目标账户已经有这个绑定了，跳过（虽然前面已经检查过，但这是双重验证）
            console.log(
              `Skipping OAuth binding migration for ${binding.provider}:${binding.providerId}: target user already has this binding`
            );
            continue;
          } else if (existingBinding.userid !== sourceUserId) {
            // 该绑定属于其他用户，这是数据不一致（不应该发生）
            console.warn(
              `Data inconsistency detected: OAuth binding ${binding.provider}:${binding.providerId} ` +
                `belongs to user ${existingBinding.userid} but expected to belong to source user ${sourceUserId}. ` +
                `Skipping migration to prevent data corruption.`
            );
            continue;
          }
          // 如果 existingBinding.userid === sourceUserId，继续迁移（这是正常的）
        }

        // 创建绑定记录到目标账户
        // 使用 try-catch 处理可能的唯一约束冲突（防御性编程）
        try {
          await tx.insert(userOAuthBindings).values({
            userid: targetUserId,
            provider: binding.provider,
            providerId: binding.providerId,
            providerUsername: binding.providerUsername,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } catch (insertError: any) {
          // 如果插入失败，检查是否是唯一约束冲突
          if (
            insertError?.code === '23505' || // PostgreSQL unique violation
            insertError?.message?.includes('unique constraint') ||
            insertError?.message?.includes('duplicate key')
          ) {
            // 唯一约束冲突：说明绑定已存在，跳过并记录
            console.warn(
              `Unique constraint violation when inserting OAuth binding ${binding.provider}:${binding.providerId} ` +
                `for target user ${targetUserId}. Binding may already exist. Skipping migration.`
            );
            continue;
          }
          // 其他错误，重新抛出
          throw insertError;
        }

        // 记录已迁移的绑定
        migratedBindings.push({
          provider: binding.provider,
          providerId: binding.providerId,
        });

        console.log(
          `Migrated OAuth binding: ${binding.provider} (${binding.providerId}) from ${sourceUserId} to ${targetUserId}`
        );
      }

      // 注意：不再需要更新 authProvider，因为现在使用绑定表来管理 OAuth 登录
      // 主登录方式可以通过检查 passwordhash 和 user_oauth_bindings 表来推断

      // 11. 删除源用户账户（级联删除会自动处理 userSettings 和 userOAuthBindings）
      console.log(`Attempting to delete source user: ${sourceUserId}`);

      // 在删除前再次验证源用户存在
      const [sourceUserBeforeDelete] = await tx
        .select()
        .from(users)
        .where(eq(users.id, sourceUserId))
        .limit(1);

      if (!sourceUserBeforeDelete) {
        console.warn(`Source user ${sourceUserId} does not exist, skipping delete`);
      } else {
        const deleteResult = await tx.delete(users).where(eq(users.id, sourceUserId)).returning();

        // 验证删除是否成功
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
        migratedBindings, // 返回已迁移的 OAuth 绑定信息
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to merge user accounts', error);
    }
  });
}
