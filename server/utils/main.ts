import { User } from '@prisma/client';

import mainJson from '../json/main.json';
import { SiteConfig } from '../types/config';
import { HonoContext } from '../types/hono';
import { getGlobalConfig } from './config';
import { getOneOpenKey } from './dbMethods';

const { stateType, roteType, editorType } = mainJson;

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
  delete (user as { passwordhash?: Uint8Array }).passwordhash;
  delete (user as { salt?: Uint8Array }).salt;
  return user;
}

export function sanitizeOtherUserData(user: User) {
  delete (user as { passwordhash?: Uint8Array }).passwordhash;
  delete (user as { salt?: Uint8Array }).salt;
  delete (user as { email?: string }).email;
  delete (user as { createdAt?: any }).createdAt;
  delete (user as { updatedAt?: any }).updatedAt;
  return user;
}

// Request body data validation
export async function bodyTypeCheck(c: HonoContext, next: () => Promise<void>) {
  const body = await c.req.json().catch(() => ({}));
  const { type, state, editor, permissions } = body;

  if (state && !stateType.includes(state.toString())) {
    throw new Error('State wrong!');
  }

  if (permissions && !Array.isArray(permissions)) {
    throw new Error('Permissions wrong!');
  }

  if (type && !roteType.includes(type.toString())) {
    throw new Error('Type wrong!');
  }

  if (editor && !editorType.includes(editor.toString())) {
    throw new Error('Editor wrong!');
  }

  await next();
}

// Query parameters validation
export async function queryTypeCheck(c: HonoContext, next: () => Promise<void>) {
  const { type, state, editor } = c.req.query();

  if (state && !stateType.includes(state.toString())) {
    throw new Error('State wrong!');
  }

  if (type && !roteType.includes(type.toString())) {
    throw new Error('Type wrong!');
  }

  if (editor && !editorType.includes(editor.toString())) {
    throw new Error('Editor wrong!');
  }

  await next();
}

// OpenKey permission validation middleware
export async function isOpenKeyOk(c: HonoContext, next: () => Promise<void>) {
  const body = await c.req.json().catch(() => ({}));
  const openkey = body?.openkey || c.req.query('openkey');

  if (!openkey) {
    throw new Error('Need openkey!');
  }

  try {
    const openKey = await getOneOpenKey(openkey.toString());
    c.set('openKey', openKey);
    await next();
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function injectDynamicUrls(c: HonoContext, next: () => Promise<void>) {
  // 优先从数据库配置获取，如果没有则动态生成
  const siteConfig = getGlobalConfig<SiteConfig>('site');

  if (siteConfig?.apiUrl) {
    c.set('dynamicApiUrl', siteConfig.apiUrl);
  } else {
    c.set('dynamicApiUrl', getApiUrl(c));
  }

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
  data,
});
