import { eq } from 'drizzle-orm';
import { users } from '../../drizzle/schema';
import db from '../drizzle';
import { DatabaseError } from './common';
import { getUserOAuthBindings } from './userOAuth';
import { getMySettings } from './userSettings';

export async function editMyProfile(
  userid: string,
  data: {
    avatar?: string | null;
    nickname?: string | null;
    description?: string | null;
    cover?: string | null;
  }
): Promise<{
  id: string;
  email: string;
  username: string;
  nickname: string | null;
  description: string | null;
  avatar: string | null;
  cover: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}> {
  try {
    const updateData: {
      avatar?: string | null;
      nickname?: string | null;
      description?: string | null;
      cover?: string | null;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };
    if (data.avatar !== undefined) updateData.avatar = data.avatar || null;
    if (data.nickname !== undefined) updateData.nickname = data.nickname || null;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.cover !== undefined) updateData.cover = data.cover || null;

    const [user] = await db.update(users).set(updateData).where(eq(users.id, userid)).returning();

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      nickname: user.nickname,
      description: user.description,
      avatar: user.avatar,
      cover: user.cover,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  } catch (error) {
    throw new DatabaseError('Failed to update user profile', error);
  }
}

export async function getUserInfoByUsername(username: string): Promise<{
  id: string;
  avatar: string | null;
  cover: string | null;
  nickname: string | null;
  username: string;
  createdAt: Date;
  description: string | null;
  emailVerified: boolean;
}> {
  try {
    const [user] = await db
      .select({
        id: users.id,
        avatar: users.avatar,
        cover: users.cover,
        nickname: users.nickname,
        username: users.username,
        createdAt: users.createdAt,
        description: users.description,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      throw new DatabaseError('User not found');
    }

    return user;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to get user info: ${username}`, error);
  }
}

export async function getMyProfile(userId: string): Promise<{
  id: string;
  emailVerified: boolean;
  email: string;
  username: string;
  nickname: string | null;
  description: string | null;
  avatar: string | null;
  cover: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  allowExplore: boolean;
  oauthBindings: Array<{
    provider: string;
    providerId: string;
    providerUsername: string | null;
  }>;
}> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      throw new DatabaseError('User not found');
    }

    // 读取或构建用户设置（目前仅包含 allowExplore）
    const setting = await getMySettings(userId);
    const allowExplore = setting.allowExplore;

    // 获取用户的所有 OAuth 绑定（支持多个 OAuth 提供商）
    const oauthBindings = await getUserOAuthBindings(userId);

    return {
      id: user.id,
      emailVerified: user.emailVerified,
      email: user.email,
      username: user.username,
      nickname: user.nickname,
      description: user.description,
      avatar: user.avatar,
      cover: user.cover,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      allowExplore,
      // 注意：authProvider 已移除，主登录方式可以通过 passwordhash 和 oauthBindings 推断
      // - 如果有 passwordhash，主登录方式是 'local'
      // - 如果没有 passwordhash 但有 oauthBindings，主登录方式是第一个绑定的提供商
      oauthBindings: oauthBindings.map((binding) => ({
        provider: binding.provider,
        providerId: binding.providerId,
        providerUsername: binding.providerUsername,
      })), // 返回完整的绑定信息
    };
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to get user profile: ${userId}`, error);
  }
}
