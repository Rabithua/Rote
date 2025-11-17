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
