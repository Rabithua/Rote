import crypto from 'crypto';
import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import { attachments, rotes, userSettings, users } from '../../drizzle/schema';
import db from '../drizzle';
import { r2deletehandler } from '../r2';
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
  authProvider?: string; // 'local' | 'github' | ...
  authProviderId?: string; // OAuth 提供商的用户 ID
  avatar?: string; // OAuth 用户可能有头像
}) {
  try {
    const insertData: any = {
      username: data.username,
      email: data.email,
      nickname: data.nickname,
      emailVerified: false,
      role: data.role || 'user',
      authProvider: data.authProvider || 'local',
      authProviderId: data.authProviderId || null,
      avatar: data.avatar || null,
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    };

    // 只有本地用户才需要密码
    if (data.authProvider === 'local' || !data.authProvider) {
      if (!data.password) {
        throw new DatabaseError('Password is required for local users');
      }
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

// 根据 OAuth 提供商和提供商 ID 查找用户
export async function findUserByOAuthId(
  authProvider: string,
  authProviderId: string
): Promise<any | null> {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.authProvider, authProvider), eq(users.authProviderId, authProviderId)))
      .limit(1);

    return user || null;
  } catch (error) {
    throw new DatabaseError(
      `Failed to find user by OAuth ID: ${authProvider}:${authProviderId}`,
      error
    );
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

export async function editMyProfile(userid: any, data: any): Promise<any> {
  try {
    const updateData: any = {};
    if (data.avatar !== undefined) updateData.avatar = data.avatar || null;
    if (data.nickname !== undefined) updateData.nickname = data.nickname || null;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.cover !== undefined) updateData.cover = data.cover || null;
    updateData.updatedAt = new Date();

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

export async function getUserInfoByUsername(username: string): Promise<any> {
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

export async function getMyProfile(userId: string): Promise<any> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      throw new DatabaseError('User not found');
    }

    // 读取或构建用户设置（目前仅包含 allowExplore）
    const [setting] = await db
      .select({
        allowExplore: userSettings.allowExplore,
      })
      .from(userSettings)
      .where(eq(userSettings.userid, userId))
      .limit(1);

    const allowExplore = setting?.allowExplore ?? true;

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
    };
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to get user profile: ${userId}`, error);
  }
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

export async function statistics(authorid: string): Promise<any> {
  try {
    const [noteCountResult, attachmentsList] = await Promise.all([
      db.select({ count: count() }).from(rotes).where(eq(rotes.authorid, authorid)),
      db.select().from(attachments).where(eq(attachments.userid, authorid)),
    ]);

    return {
      noteCount: noteCountResult[0]?.count || 0,
      attachmentsCount: attachmentsList.length,
    };
  } catch (error) {
    throw new DatabaseError('Failed to get user statistics', error);
  }
}

export async function exportData(authorid: string): Promise<any> {
  try {
    // 使用 relational query API 获取关联数据
    const notes = await db.query.rotes.findMany({
      where: (rotes, { eq }) => eq(rotes.authorid, authorid),
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: true,
        reactions: true,
      },
    });
    return { notes };
  } catch (error) {
    throw new DatabaseError('Failed to export user data', error);
  }
}

export async function getHeatMap(userId: string, startDate: string, endDate: string): Promise<any> {
  try {
    const rotesList = await db
      .select()
      .from(rotes)
      .where(
        and(
          eq(rotes.authorid, userId),
          gte(rotes.createdAt, new Date(startDate)),
          lte(rotes.createdAt, new Date(endDate))
        )
      );

    if (rotesList.length === 0) {
      return {};
    }

    return rotesList.reduce((acc: any, item: any) => {
      const date = item.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});
  } catch (error) {
    throw new DatabaseError('Failed to generate heatmap data', error);
  }
}

export async function getMyTags(userid: string): Promise<any> {
  try {
    const rotesList = await db
      .select({ tags: rotes.tags })
      .from(rotes)
      .where(eq(rotes.authorid, userid));
    const allTags = Array.from(new Set(rotesList.flatMap((item) => item.tags || [])));
    return allTags;
  } catch (error) {
    throw new DatabaseError('Failed to get user tags', error);
  }
}

// 删除用户账户
export async function deleteUserAccount(userid: string, password: string): Promise<any> {
  try {
    // 1. 验证用户存在
    const [user] = await db.select().from(users).where(eq(users.id, userid)).limit(1);

    if (!user) {
      throw new DatabaseError('User not found');
    }

    // 2. 验证密码（仅对本地用户）
    if (user.authProvider === 'local' && user.passwordhash && user.salt) {
      const passwordhashToVerify = crypto.pbkdf2Sync(password, user.salt, 310000, 32, 'sha256');

      if (
        Buffer.from(passwordhashToVerify).toString('hex') !==
        Buffer.from(user.passwordhash).toString('hex')
      ) {
        throw new Error('Incorrect password');
      }
    } else if (user.authProvider !== 'local') {
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
