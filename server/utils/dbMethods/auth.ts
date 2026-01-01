import { eq, or } from 'drizzle-orm';
import { users } from '../../drizzle/schema';
import db from '../drizzle';
import { DatabaseError } from './common';

// 认证相关方法
export async function passportCheckUser(data: { usernameOrEmail: string }) {
  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        emailVerified: users.emailVerified,
        passwordhash: users.passwordhash,
        salt: users.salt,
        // 注意：authProvider, authProviderId, authProviderUsername 已移除
        nickname: users.nickname,
        description: users.description,
        cover: users.cover,
        avatar: users.avatar,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(or(eq(users.username, data.usernameOrEmail), eq(users.email, data.usernameOrEmail)))
      .limit(1);

    return {
      err: null,
      user: user || null,
    };
  } catch (error) {
    throw new DatabaseError('Failed to authenticate user', error);
  }
}
