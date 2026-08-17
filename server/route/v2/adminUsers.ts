import { Hono } from 'hono';
import { authenticateJWT, requireAdmin, requireSuperAdmin } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { UserRole } from '../../types/main';
import { isPushNotificationsEnabled } from '../../push/config';
import {
  certifyUser,
  deleteUserById,
  getDashboardStats,
  getRoleStats,
  getUserByIdForAdmin,
  listUsers,
  uncertifyUser,
  updateUserRole,
} from '../../utils/dbMethods';
import { createResponse } from '../../utils/main';

const adminUsersRouter = new Hono<{ Variables: HonoVariables }>();

async function handleCertifyUser(c: HonoContext) {
  const userId = c.req.param('userId');

  const { user } = await certifyUser(userId, isPushNotificationsEnabled());

  if (!user) {
    throw new Error('User not found');
  }

  return c.json(createResponse(user, 'User certified successfully'), 200);
}

async function handleUncertifyUser(c: HonoContext) {
  const userId = c.req.param('userId');

  const { user } = await uncertifyUser(userId, isPushNotificationsEnabled());

  if (!user) {
    throw new Error('User not found');
  }

  return c.json(createResponse(user, 'User certification removed successfully'), 200);
}

// 获取数据看板统计（管理员）
adminUsersRouter.get('/stats/dashboard', authenticateJWT, requireAdmin, async (c: HonoContext) => {
  try {
    const stats = await getDashboardStats();
    return c.json(createResponse(stats), 200);
  } catch (error: any) {
    console.error('Failed to get dashboard stats:', error);
    return c.json(createResponse(null, 'Failed to get dashboard stats'), 500);
  }
});

// 获取所有用户列表（管理员）
adminUsersRouter.get('/users', authenticateJWT, requireAdmin, async (c: HonoContext) => {
  const page = c.req.query('page') || '1';
  const limit = c.req.query('limit') || '10';
  const role = c.req.query('role');
  const search = c.req.query('search');
  const sortField = c.req.query('sortField');
  const sortOrder = c.req.query('sortOrder') as 'asc' | 'desc' | undefined;
  const { users, total } = await listUsers({ page, limit, role, search, sortField, sortOrder });

  return c.json(
    createResponse({
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    }),
    200
  );
});

// 更新用户角色（超级管理员）
adminUsersRouter.put(
  '/users/:userId/role',
  authenticateJWT,
  requireSuperAdmin,
  async (c: HonoContext) => {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    const { role } = body as { role: UserRole };

    if (!Object.values(UserRole).includes(role)) {
      throw new Error('Invalid role');
    }

    const user = await updateUserRole(userId, role);

    return c.json(createResponse(user, 'User role updated successfully'), 200);
  }
);

// 获取用户详细信息（管理员）
adminUsersRouter.get('/users/:userId', authenticateJWT, requireAdmin, async (c: HonoContext) => {
  const userId = c.req.param('userId');

  const user = await getUserByIdForAdmin(userId);

  if (!user) {
    throw new Error('User not found');
  }

  return c.json(createResponse(user), 200);
});

// 删除用户（超级管理员）
adminUsersRouter.delete(
  '/users/:userId',
  authenticateJWT,
  requireSuperAdmin,
  async (c: HonoContext) => {
    const userId = c.req.param('userId');

    await deleteUserById(userId);

    return c.json(createResponse(null, 'User deleted successfully'), 200);
  }
);

// 用户认证（管理员）
adminUsersRouter.put(
  '/users/:userId/certification',
  authenticateJWT,
  requireAdmin,
  handleCertifyUser
);

// 取消用户认证（管理员）
adminUsersRouter.delete(
  '/users/:userId/certification',
  authenticateJWT,
  requireAdmin,
  handleUncertifyUser
);

// 获取角色统计信息（管理员）
adminUsersRouter.get('/roles/stats', authenticateJWT, requireAdmin, async (c: HonoContext) => {
  const stats = await getRoleStats();
  return c.json(createResponse(stats), 200);
});

export default adminUsersRouter;
