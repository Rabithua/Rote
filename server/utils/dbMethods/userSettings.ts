import { eq } from 'drizzle-orm';
import { userSettings } from '../../drizzle/schema';
import db from '../drizzle';
import { DatabaseError } from './common';

// 获取当前用户设置（例如 allowExplore）
export async function getMySettings(userId: string): Promise<any> {
  try {
    const [setting] = await db
      .select({
        allowExplore: userSettings.allowExplore,
      })
      .from(userSettings)
      .where(eq(userSettings.userid, userId))
      .limit(1);

    return {
      allowExplore: setting?.allowExplore ?? true,
    };
  } catch (error) {
    throw new DatabaseError('Failed to get user settings', error);
  }
}

// 更新当前用户设置（例如 allowExplore）
export async function updateMySettings(userId: string, data: any): Promise<any> {
  try {
    const updates: Partial<{ allowExplore: boolean }> = {};
    if (data.allowExplore !== undefined) {
      updates.allowExplore = Boolean(data.allowExplore);
    }

    if (Object.keys(updates).length === 0) {
      // 没有任何可更新的字段，直接返回当前设置
      return getMySettings(userId);
    }

    const [existing] = await db
      .select({ id: userSettings.id })
      .from(userSettings)
      .where(eq(userSettings.userid, userId))
      .limit(1);

    if (existing) {
      await db
        .update(userSettings)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.id, existing.id));
    } else {
      await db.insert(userSettings).values({
        userid: userId,
        allowExplore: updates.allowExplore ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return getMySettings(userId);
  } catch (error) {
    throw new DatabaseError('Failed to update user settings', error);
  }
}
