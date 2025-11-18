import { HonoContext } from '../types/hono';
import { ROLE_PERMISSIONS, UserRole } from '../types/main';
import { getSafeUser } from '../utils/dbMethods';
import { verifyAccessToken } from '../utils/jwt';

export async function authenticateJWT(c: HonoContext, next: () => Promise<void>) {
  const authHeader = c.req.header('authorization');
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return c.json({ code: 401, message: 'Access token required' }, 401);
  }

  try {
    const payload = await verifyAccessToken(token);
    const user = await getSafeUser(payload.userId);

    if (!user) {
      return c.json({ code: 401, message: 'User not found' }, 401);
    }

    c.set('user', user);
    await next();
  } catch (_error) {
    return c.json({ code: 401, message: 'Invalid token' }, 401);
  }
}

// 可选JWT认证中间件，允许访客和用户双重访问
export async function optionalJWT(c: HonoContext, next: () => Promise<void>) {
  const authHeader = c.req.header('authorization');
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    c.set('user', undefined);
    await next();
    return;
  }

  try {
    const payload = await verifyAccessToken(token);
    const user = await getSafeUser(payload.userId);

    if (user) {
      c.set('user', user);
    } else {
      c.set('user', undefined);
    }

    await next();
  } catch (_error) {
    // Token无效时，仍然允许继续（作为访客）
    c.set('user', undefined);
    await next();
  }
}

// 角色验证中间件
export function requireRole(requiredRole: UserRole) {
  return async (c: HonoContext, next: () => Promise<void>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ code: 401, message: 'Authentication required' }, 401);
    }

    const userRole = (user as any).role as UserRole;
    const roleHierarchy = [UserRole.USER, UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN];

    const userRoleIndex = roleHierarchy.indexOf(userRole);
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

    if (userRoleIndex < requiredRoleIndex) {
      return c.json(
        {
          code: 403,
          message: `Insufficient permissions. Required role: ${requiredRole}`,
        },
        403
      );
    }

    await next();
  };
}

// 权限验证中间件
export function requirePermission(permission: keyof (typeof ROLE_PERMISSIONS)[UserRole]) {
  return async (c: HonoContext, next: () => Promise<void>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ code: 401, message: 'Authentication required' }, 401);
    }

    const userRole = (user as any).role as UserRole;
    const permissions = ROLE_PERMISSIONS[userRole];

    if (!permissions[permission]) {
      return c.json(
        {
          code: 403,
          message: `Insufficient permissions. Required permission: ${permission}`,
        },
        403
      );
    }

    await next();
  };
}

// 管理员权限验证中间件
export async function requireAdmin(c: HonoContext, next: () => Promise<void>) {
  return requireRole(UserRole.ADMIN)(c, next);
}

// 超级管理员权限验证中间件
export async function requireSuperAdmin(c: HonoContext, next: () => Promise<void>) {
  return requireRole(UserRole.SUPER_ADMIN)(c, next);
}
