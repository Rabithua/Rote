import crypto from 'crypto';
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { attachments, rotes, userOpenKeys, users } from '../../drizzle/schema';
import db from '../drizzle';

// Admin 相关数据库方法

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (_error) {
    return false;
  }
}

export async function hasAdminUser(): Promise<boolean> {
  const [result] = await db
    .select({ count: count() })
    .from(users)
    .where(inArray(users.role, ['admin', 'super_admin']));
  return (result?.count || 0) > 0;
}

export async function getLatestMigrationVersion(): Promise<string> {
  try {
    // Drizzle 不维护迁移表，返回 unknown
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function createAdminUser(data: {
  username: string;
  email: string;
  password: string;
  nickname?: string;
}) {
  const salt = crypto.randomBytes(16);
  const passwordhash = crypto.pbkdf2Sync(data.password, salt, 310000, 32, 'sha256');

  // 不包含 id 字段，让数据库使用 defaultRandom() 自动生成
  // 使用 sql`now()` 让数据库原子性地在同一时间点计算时间戳
  const insertData: any = {
    username: data.username,
    email: data.email,
    passwordhash,
    salt,
    nickname: data.nickname || data.username,
    // 管理员账号默认视为邮箱已验证
    emailVerified: true,
    role: 'super_admin',
    createdAt: sql`now()`,
    updatedAt: sql`now()`,
  };

  const [user] = await db.insert(users).values(insertData).returning({
    id: users.id,
    username: users.username,
    email: users.email,
    role: users.role,
  });
  return user;
}

export async function listUsers(params: {
  page?: number | string;
  limit?: number | string;
  role?: string;
  search?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const page = Number(params.page || 1);
  const limitNum = Number(params.limit || 10);
  const skip = (page - 1) * limitNum;

  const whereConditions = [];
  if (params.role) {
    whereConditions.push(eq(users.role, params.role));
  }
  if (params.search) {
    whereConditions.push(
      or(
        ilike(users.username, `%${params.search}%`),
        ilike(users.email, `%${params.search}%`),
        ilike(users.nickname, `%${params.search}%`)
      )!
    );
  }

  const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  // 构建排序
  const sortField = params.sortField || 'createdAt';
  const sortOrder = params.sortOrder || 'desc';
  let orderByClause;

  if (sortField === 'username') {
    orderByClause = sortOrder === 'asc' ? asc(users.username) : desc(users.username);
  } else if (sortField === 'email') {
    orderByClause = sortOrder === 'asc' ? asc(users.email) : desc(users.email);
  } else {
    // 默认按创建时间排序
    orderByClause = sortOrder === 'asc' ? asc(users.createdAt) : desc(users.createdAt);
  }

  const [usersList, totalResult] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        nickname: users.nickname,
        avatar: users.avatar,
        role: users.role,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(whereClause)
      .offset(skip)
      .limit(limitNum)
      .orderBy(orderByClause),
    db.select({ count: count() }).from(users).where(whereClause),
  ]);

  return { users: usersList, total: totalResult[0]?.count || 0, page, limit: limitNum };
}

export async function getUserByIdForAdmin(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      nickname: users.nickname,
      description: users.description,
      avatar: users.avatar,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  // 获取关联数据计数
  const [rotesCount, attachmentsCount, openkeyCount] = await Promise.all([
    db.select({ count: count() }).from(rotes).where(eq(rotes.authorid, userId)),
    db.select({ count: count() }).from(attachments).where(eq(attachments.userid, userId)),
    db.select({ count: count() }).from(userOpenKeys).where(eq(userOpenKeys.userid, userId)),
  ]);

  return {
    ...user,
    _count: {
      rotes: rotesCount[0]?.count || 0,
      attachments: attachmentsCount[0]?.count || 0,
      openkey: openkeyCount[0]?.count || 0,
    },
  };
}

export async function updateUserRole(userId: string, role: string) {
  const [user] = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      updatedAt: users.updatedAt,
    });
  return user;
}

export async function deleteUserById(userId: string) {
  // 检查用户是否存在以及是否是 super_admin
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  // 防止删除 super_admin 用户
  if (user.role === 'super_admin') {
    throw new Error('Cannot delete super admin user');
  }

  await db.delete(users).where(eq(users.id, userId));
  return true;
}

export async function verifyUserEmail(userId: string) {
  const [user] = await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      emailVerified: users.emailVerified,
      updatedAt: users.updatedAt,
    });
  return user;
}

export async function unverifyUserEmail(userId: string) {
  const [user] = await db
    .update(users)
    .set({ emailVerified: false, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      emailVerified: users.emailVerified,
      updatedAt: users.updatedAt,
    });
  return user;
}

export async function getRoleStats() {
  const roleStats = await db
    .select({
      role: users.role,
      count: count(),
    })
    .from(users)
    .groupBy(users.role);

  return roleStats.reduce(
    (acc: Record<string, number>, stat: any) => {
      acc[stat.role] = stat.count;
      return acc;
    },
    {} as Record<string, number>
  );
}

// 按用户名或邮箱查找用户（用于初始化时校验是否已存在）
export async function findUserByUsernameOrEmail(params: { username: string; email: string }) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.username, params.username), eq(users.email, params.email))!)
    .limit(1);
  return user || null;
}
