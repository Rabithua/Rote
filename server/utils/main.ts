import { User } from '@prisma/client';

import { Request } from 'express';
import mainJson from '../json/main.json';
import { getOneOpenKey } from './dbMethods';

const { stateType, roteType, editorType } = mainJson;

export function getApiUrl(req: Request): string {
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
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
export function bodyTypeCheck(req: any, res: any, next: any) {
  const { type, state, editor, permissions } = req.body;

  if (state && !stateType.includes(state.toString())) {
    const error = new Error('State wrong!');
    error.name = 'ValidationError';
    return next(error);
  }

  if (permissions && !Array.isArray(permissions)) {
    const error = new Error('Permissions wrong!');
    error.name = 'ValidationError';
    return next(error);
  }

  if (type && !roteType.includes(type.toString())) {
    const error = new Error('Type wrong!');
    error.name = 'ValidationError';
    return next(error);
  }

  if (editor && !editorType.includes(editor.toString())) {
    const error = new Error('Editor wrong!');
    error.name = 'ValidationError';
    return next(error);
  }

  next();
}

// Query parameters validation
export function queryTypeCheck(req: any, res: any, next: any) {
  const { type, state, editor } = req.query;

  if (state && !stateType.includes(state.toString())) {
    const error = new Error('State wrong!');
    error.name = 'ValidationError';
    return next(error);
  }

  if (type && !roteType.includes(type.toString())) {
    const error = new Error('Type wrong!');
    error.name = 'ValidationError';
    return next(error);
  }

  if (editor && !editorType.includes(editor.toString())) {
    const error = new Error('Editor wrong!');
    error.name = 'ValidationError';
    return next(error);
  }

  next();
}

// OpenKey permission validation middleware
export function isOpenKeyOk(req: any, res: any, next: any) {
  const openkey = req.body?.openkey || req.query?.openkey;

  if (!openkey) {
    const error = new Error('Need openkey!');
    error.name = 'ValidationError';
    return next(error);
  }

  getOneOpenKey(openkey.toString())
    .then(async (e) => {
      req.openKey = e;
      next();
    })
    .catch(async (e) => {
      const error = new Error(e);
      error.name = 'ValidationError';
      next(error);
    });
}

export function injectDynamicUrls(req: any, res: any, next: any) {
  req.dynamicApiUrl = getApiUrl(req);
  req.dynamicFrontendUrl = process.env.BASE_URL || 'http://localhost:3001';

  next();
}

/**
 * Standard response format
 * @param data Response data
 * @param message Response message
 * @param code Status code
 * @returns Standardized response object
 */
export const createResponse = (data: any = null, message: string = 'success', code: number = 0) => {
  return {
    code,
    message,
    data,
  };
};
