import type { User } from '../drizzle/schema';

import type { SiteConfig } from '../types/config';
import type { HonoContext } from '../types/hono';
import { getGlobalConfig } from './config';

export function getApiUrl(c: HonoContext): string {
  const protocol = c.req.header('x-forwarded-proto') || 'http';
  const host = c.req.header('x-forwarded-host') || c.req.header('host') || 'localhost:3000';
  return `${protocol}://${host}`;
}

/**
 * 获取客户端 IP 地址
 * 按优先级尝试从多个来源获取：x-forwarded-for -> x-real-ip -> 原始连接
 * @param c Hono 上下文对象
 * @returns 客户端 IP 地址，如果无法获取则返回 'local'
 */
export function getClientIp(c: HonoContext): string {
  // 1. 尝试从 x-forwarded-for 获取（可能包含多个 IP，取第一个）
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for 可能包含多个 IP，用逗号分隔，取第一个
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) {
      return firstIp;
    }
  }

  // 2. 尝试从 x-real-ip 获取
  const realIp = c.req.header('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // 3. 尝试从原始请求对象获取（Bun 运行时）
  try {
    const raw = c.req.raw;
    if (raw && 'remoteAddress' in raw) {
      const remoteAddress = (raw as any).remoteAddress;
      if (remoteAddress) {
        return remoteAddress;
      }
    }
  } catch {
    // 忽略错误，继续尝试其他方式
  }

  // 4. 如果都获取不到，返回 'local' 作为标识（比 'unknown' 更友好）
  return 'local';
}

// UUID 格式验证函数
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export function sanitizeUserData(user: User) {
  const sanitizedUser = user as User & { certified?: boolean };
  delete (sanitizedUser as { passwordhash?: Uint8Array }).passwordhash;
  delete (sanitizedUser as { salt?: Uint8Array }).salt;
  // TODO: 下下次更新移除 emailVerified 公开字段兼容，统一只返回 certified。
  if ('emailVerified' in sanitizedUser) {
    sanitizedUser.certified = sanitizedUser.emailVerified;
    delete (sanitizedUser as { emailVerified?: boolean }).emailVerified;
  }
  return sanitizedUser;
}

export function sanitizeOtherUserData(user: User) {
  const sanitizedUser = sanitizeUserData(user);
  delete (sanitizedUser as { email?: string }).email;
  delete (sanitizedUser as { createdAt?: any }).createdAt;
  delete (sanitizedUser as { updatedAt?: any }).updatedAt;
  return sanitizedUser;
}

function normalizeCertificationFields(value: any): any {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeCertificationFields(item));
  }

  if (!value || typeof value !== 'object' || value instanceof Date || value instanceof Uint8Array) {
    return value;
  }

  const normalized = { ...value };
  // TODO: 下下次更新移除 emailVerified 公开字段兼容，统一只返回 certified。
  if ('emailVerified' in normalized) {
    normalized.certified = normalized.certified ?? normalized.emailVerified;
    delete normalized.emailVerified;
  }

  Object.keys(normalized).forEach((key) => {
    normalized[key] = normalizeCertificationFields(normalized[key]);
  });

  return normalized;
}

// Request body data validation
export async function bodyTypeCheck(c: HonoContext, next: () => Promise<void>) {
  const body = await c.req.json().catch(() => ({}));
  const { permissions } = body;

  if (permissions && !Array.isArray(permissions)) {
    throw new Error('Permissions wrong!');
  }

  await next();
}

export async function injectDynamicUrls(c: HonoContext, next: () => Promise<void>) {
  // API URL 始终自动检测，不再从配置读取
  c.set('dynamicApiUrl', getApiUrl(c));

  // 前端 URL 从配置读取，如果没有则使用默认值
  const siteConfig = getGlobalConfig<SiteConfig>('site');
  if (siteConfig?.frontendUrl) {
    c.set('dynamicFrontendUrl', siteConfig.frontendUrl);
  } else {
    c.set('dynamicFrontendUrl', 'http://localhost:3001');
  }

  await next();
}

/**
 * Standard response format
 * @param data Response data
 * @param message Response message
 * @param code Status code
 * @returns Standardized response object
 */
export const createResponse = (
  data: any = null,
  message: string = 'success',
  code: number = 0
) => ({
  code,
  message,
  data: normalizeCertificationFields(data),
});
