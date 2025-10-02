import express from 'express';
import { authenticateJWT, requireAdmin, requireSuperAdmin } from '../../middleware/jwtAuth';
import { UserRole } from '../../types/main';
import { asyncHandler } from '../../utils/handlers';
import { createResponse } from '../../utils/main';
import prisma from '../../utils/prisma';

const adminRouter = express.Router();

// 获取所有用户列表（管理员）
adminRouter.get(
  '/users',
  authenticateJWT,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, role, search } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (role) {
      where.role = role;
    }
    if (search) {
      where.OR = [
        { username: { contains: search as string } },
        { email: { contains: search as string } },
        { nickname: { contains: search as string } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
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

    res.status(200).json(
      createResponse({
        users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      })
    );
  })
);

// 更新用户角色（超级管理员）
adminRouter.put(
  '/users/:userId/role',
  authenticateJWT,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body as { role: UserRole };

    if (!Object.values(UserRole).includes(role)) {
      throw new Error('Invalid role');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        updatedAt: true,
      },
    });

    res.status(200).json(createResponse(user, 'User role updated successfully'));
  })
);

// 获取用户详细信息（管理员）
adminRouter.get(
  '/users/:userId',
  authenticateJWT,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
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
        _count: {
          select: {
            rotes: true,
            attachments: true,
            openkey: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    res.status(200).json(createResponse(user));
  })
);

// 删除用户（超级管理员）
adminRouter.delete(
  '/users/:userId',
  authenticateJWT,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    await prisma.user.delete({
      where: { id: userId },
    });

    res.status(200).json(createResponse(null, 'User deleted successfully'));
  })
);

// 获取角色统计信息（管理员）
adminRouter.get(
  '/roles/stats',
  authenticateJWT,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const roleStats = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true },
    });

    const stats = roleStats.reduce(
      (acc: Record<string, number>, stat: any) => {
        acc[stat.role] = stat._count.role;
        return acc;
      },
      {} as Record<string, number>
    );

    res.status(200).json(createResponse(stats));
  })
);

export default adminRouter;
