import crypto from 'crypto';
import { and, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
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
  const insertData: any = {
    username: data.username,
    email: data.email,
    passwordhash,
    salt,
    nickname: data.nickname || data.username,
    role: 'super_admin',
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

  const [usersList, totalResult] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        nickname: users.nickname,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(whereClause)
      .offset(skip)
      .limit(limitNum)
      .orderBy(desc(users.createdAt)),
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
  await db.delete(users).where(eq(users.id, userId));
  return true;
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
