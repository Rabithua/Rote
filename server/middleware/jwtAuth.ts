import { NextFunction, Request, Response } from 'express';
import { ROLE_PERMISSIONS, UserRole } from '../types/main';
import { oneUser } from '../utils/dbMethods';
import { verifyAccessToken } from '../utils/jwt';

export async function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ code: 401, message: 'Access token required' });
  }

  try {
    const payload = await verifyAccessToken(token);
    const user = await oneUser(payload.userId);

    if (!user) {
      return res.status(401).json({ code: 401, message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ code: 401, message: 'Invalid token' });
  }
}

// 可选JWT认证中间件，允许访客和用户双重访问
export async function optionalJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // 如果没有token，直接继续（访客模式）
  if (!token) {
    req.user = undefined;
    return next();
  }

  try {
    const payload = await verifyAccessToken(token);
    const user = await oneUser(payload.userId);

    if (user) {
      req.user = user;
    } else {
      req.user = undefined;
    }

    next();
  } catch (error) {
    // Token无效时，仍然允许继续（作为访客）
    req.user = undefined;
    next();
  }
}

// 角色验证中间件
export function requireRole(requiredRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: 'Authentication required' });
    }

    const userRole = (req.user as any).role as UserRole;
    const roleHierarchy = [UserRole.USER, UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN];

    const userRoleIndex = roleHierarchy.indexOf(userRole);
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

    if (userRoleIndex < requiredRoleIndex) {
      return res.status(403).json({
        code: 403,
        message: `Insufficient permissions. Required role: ${requiredRole}`,
      });
    }

    next();
  };
}

// 权限验证中间件
export function requirePermission(permission: keyof (typeof ROLE_PERMISSIONS)[UserRole]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: 'Authentication required' });
    }

    const userRole = (req.user as any).role as UserRole;
    const permissions = ROLE_PERMISSIONS[userRole];

    if (!permissions[permission]) {
      return res.status(403).json({
        code: 403,
        message: `Insufficient permissions. Required permission: ${permission}`,
      });
    }

    next();
  };
}

// 管理员权限验证中间件
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole(UserRole.ADMIN)(req, res, next);
}

// 超级管理员权限验证中间件
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole(UserRole.SUPER_ADMIN)(req, res, next);
}
