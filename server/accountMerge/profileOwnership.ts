import { eq } from 'drizzle-orm';
import { userSettings, users } from '../drizzle/schema';
import type { User } from '../drizzle/schema';
import type { AccountMergeTransaction } from './types';

export async function transferProfileOwnership(
  tx: AccountMergeTransaction,
  sourceUser: User,
  targetUser: User
): Promise<boolean> {
  const sourceUserId = sourceUser.id;
  const targetUserId = targetUser.id;
  let shouldBackfillTargetEmbeddings = false;
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

  // 用户认证状态（邮箱本身因唯一约束保留目标用户的）
  if (!targetUser.emailVerified && sourceUser.emailVerified) {
    updateData.emailVerified = true;
    shouldBackfillTargetEmbeddings = true;
  }

  if (Object.keys(updateData).length > 1) {
    await tx.update(users).set(updateData).where(eq(users.id, targetUserId));
  }

  return shouldBackfillTargetEmbeddings;
}
