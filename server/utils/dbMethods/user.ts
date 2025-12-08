import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { users } from '../../drizzle/schema';
import db from '../drizzle';
import { DatabaseError } from './common';

// 用户相关方法
export async function allUser() {
  try {
    const allUsers = await db.select().from(users);
    return allUsers;
  } catch (error: any) {
    throw new DatabaseError('Failed to get all users', error);
  }
}

export async function oneUser(id: string) {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user || null;
  } catch (error) {
    throw new DatabaseError(`Failed to find user by id: ${id}`, error);
  }
}

// 获取安全的用户对象（排除敏感信息），用于注入到 req.user
export async function getSafeUser(id: string) {
  try {
    const [user] = await db
      .select({
        id: users.id,
        emailVerified: users.emailVerified,
        email: users.email,
        username: users.username,
        nickname: users.nickname,
        description: users.description,
        avatar: users.avatar,
        cover: users.cover,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user || null;
  } catch (error) {
    throw new DatabaseError(`Failed to get safe user by id: ${id}`, error);
  }
}

export async function createUser(data: {
  username: string;
  email: string;
  password?: string; // OAuth 用户可能没有密码
  nickname?: string;
  role?: string;
  avatar?: string; // OAuth 用户可能有头像
}) {
  try {
    const insertData: any = {
      username: data.username,
      email: data.email,
      nickname: data.nickname,
      emailVerified: false,
      role: data.role || 'user',
      avatar: data.avatar || null,
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    };

    // 如果有密码，创建本地用户；如果没有密码，创建 OAuth 用户
    if (data.password) {
      const salt = crypto.randomBytes(16);
      const passwordhash = crypto.pbkdf2Sync(data.password, salt, 310000, 32, 'sha256');
      insertData.passwordhash = passwordhash;
      insertData.salt = salt;
    } else {
      // OAuth 用户不需要密码
      insertData.passwordhash = null;
      insertData.salt = null;
    }

    const [user] = await db.insert(users).values(insertData).returning();
    return user;
  } catch (error: any) {
    // 处理唯一约束冲突
    if (error.code === '23505') {
      // PostgreSQL unique violation
      throw new DatabaseError('Username or email already exists', error);
    }
    throw new DatabaseError('Failed to create user', error);
  }
}

// 生成唯一用户名（如果用户名冲突）
export async function generateUniqueUsername(
  baseUsername: string,
  fallbackPrefix: string = 'user'
): Promise<string> {
  // 清理用户名：转小写，只保留字母、数字、下划线和连字符
  let username = baseUsername.toLowerCase().replace(/[^a-z0-9_-]/g, '');

  // 如果清理后用户名为空，使用 fallbackPrefix + 随机后缀
  if (!username || username.length === 0) {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    username = `${fallbackPrefix}-${randomSuffix}`;
  }

  // 确保用户名长度不超过数据库限制（100字符），但保留后缀空间
  const maxBaseLength = 90; // 保留空间给后缀（如 -999）
  if (username.length > maxBaseLength) {
    username = username.substring(0, maxBaseLength);
  }

  // 确保用户名至少 3 个字符（符合一般用户名规范）
  if (username.length < 3) {
    const randomSuffix = Math.random().toString(36).substring(2, 5);
    username = `${username}${randomSuffix}`.substring(0, maxBaseLength);
  }

  let suffix = 0;
  const maxSuffix = 999; // 最多尝试 999 次

  while (suffix <= maxSuffix) {
    const testUsername = suffix === 0 ? username : `${username}-${suffix}`;

    // 确保总长度不超过数据库限制
    if (testUsername.length > 100) {
      // 如果加上后缀后超过限制，缩短基础用户名
      const availableLength = 100 - (suffix.toString().length + 1); // +1 是连字符
      username = username.substring(0, availableLength);
      continue;
    }

    const existing = await db.select().from(users).where(eq(users.username, testUsername)).limit(1);

    if (existing.length === 0) {
      return testUsername;
    }
    suffix++;
  }

  // 如果所有后缀都尝试过了，使用随机后缀
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const finalUsername = `${username}-${randomSuffix}`.substring(0, 100);

  // 最后检查一次
  const existing = await db.select().from(users).where(eq(users.username, finalUsername)).limit(1);
  if (existing.length === 0) {
    return finalUsername;
  }

  throw new DatabaseError('Failed to generate unique username after multiple attempts');
}

export async function changeUserPassword(
  oldpassword: string,
  newpassword: string,
  id: string
): Promise<any> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);

    if (!user) {
      throw new DatabaseError('User not found');
    }

    const passwordhash = user.passwordhash;
    const salt = user.salt;

    // 确保 salt 和 passwordhash 不为 null（本地用户必须有密码）
    if (!salt || !passwordhash) {
      throw new DatabaseError('Password hash or salt is missing');
    }

    const oldpasswordhash = crypto.pbkdf2Sync(oldpassword, salt, 310000, 32, 'sha256');

    if (
      Buffer.from(oldpasswordhash).toString('hex') !== Buffer.from(passwordhash).toString('hex')
    ) {
      throw new DatabaseError('Incorrect old password');
    }

    const newSalt = crypto.randomBytes(16);
    const newpasswordhash = crypto.pbkdf2Sync(newpassword, newSalt, 310000, 32, 'sha256');

    const [userUpdate] = await db
      .update(users)
      .set({
        passwordhash: newpasswordhash,
        salt: newSalt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    return userUpdate;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError('Failed to change password', error);
  }
}
