import { eq } from 'drizzle-orm';
import { users } from '../../drizzle/schema';
import db from '../drizzle';
import { DatabaseError } from './common';

// 认证相关方法
export async function passportCheckUser(data: { username: string }) {
  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        emailVerified: users.emailVerified,
        passwordhash: users.passwordhash,
        salt: users.salt,
        authProvider: users.authProvider,
        authProviderId: users.authProviderId,
        authProviderUsername: users.authProviderUsername,
        nickname: users.nickname,
        description: users.description,
        cover: users.cover,
        avatar: users.avatar,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.username, data.username))
      .limit(1);

    return {
      err: null,
      user: user || null,
    };
  } catch (error) {
    throw new DatabaseError('Failed to authenticate user', error);
  }
}
