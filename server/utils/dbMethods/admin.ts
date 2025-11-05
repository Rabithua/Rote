import crypto from 'crypto';
import prisma from '../prisma';

// Admin 相关数据库方法

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (_error) {
    return false;
  }
}

export async function hasAdminUser(): Promise<boolean> {
  const adminCount = await prisma.user.count({ where: { role: { in: ['admin', 'super_admin'] } } });
  return adminCount > 0;
}

export async function getLatestMigrationVersion(): Promise<string> {
  try {
    const result =
      (await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1`) as any[];
    return result[0]?.migration_name || 'unknown';
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

  return prisma.user.create({
    data: {
      username: data.username,
      email: data.email,
      passwordhash,
      salt,
      nickname: data.nickname || data.username,
      role: 'super_admin',
    },
    select: { id: true, username: true, email: true, role: true },
  });
}

export async function listUsers(params: {
  page?: number | string;
  limit?: number | string;
  role?: string;
  search?: string;
}) {
  const page = Number(params.page || 1);
  const limit = Number(params.limit || 10);
  const skip = (page - 1) * limit;

  const where: any = {};
  if (params.role) where.role = params.role;
  if (params.search) {
    where.OR = [
      { username: { contains: params.search } },
      { email: { contains: params.search } },
      { nickname: { contains: params.search } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, limit };
}

export async function getUserByIdForAdmin(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      nickname: true,
      description: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { rotes: true, attachments: true, openkey: true } },
    },
  });
}

export async function updateUserRole(userId: string, role: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, username: true, email: true, role: true, updatedAt: true },
  });
}

export async function deleteUserById(userId: string) {
  await prisma.user.delete({ where: { id: userId } });
  return true;
}

export async function getRoleStats() {
  const roleStats = await prisma.user.groupBy({ by: ['role'], _count: { role: true } });
  return roleStats.reduce(
    (acc: Record<string, number>, stat: any) => {
      acc[stat.role] = stat._count.role;
      return acc;
    },
    {} as Record<string, number>
  );
}

// 按用户名或邮箱查找用户（用于初始化时校验是否已存在）
export async function findUserByUsernameOrEmail(params: { username: string; email: string }) {
  return prisma.user.findFirst({
    where: {
      OR: [{ username: params.username }, { email: params.email }],
    },
    select: { id: true },
  });
}
