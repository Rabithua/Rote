import { z } from 'zod';
import type { HonoContext, HonoVariables } from '../types/hono';
import { getClientIp } from '../utils/main';
import {
  getOneOpenKey as getOneOpenKeyFromDatabase,
  logOpenKeyUsage as logOpenKeyUsageToDatabase,
  type UsageLogData,
} from '../utils/dbMethods/apikey';

const OpenKeyCredentialSchema = z.uuid();

type OpenKeyRecord = NonNullable<HonoVariables['openKey']>;

export interface OpenKeyMiddlewareDependencies {
  getOneOpenKey(id: string): Promise<OpenKeyRecord>;
  logOpenKeyUsage(openKeyId: string, data: UsageLogData): Promise<void>;
}

const defaultDependencies: OpenKeyMiddlewareDependencies = {
  getOneOpenKey: getOneOpenKeyFromDatabase,
  logOpenKeyUsage: logOpenKeyUsageToDatabase,
};

export function createOpenKeyMiddleware(
  dependencies: OpenKeyMiddlewareDependencies = defaultDependencies
) {
  return async (c: HonoContext, next: () => Promise<void>) => {
    const body = await c.req.json().catch(() => ({}));
    const credential = OpenKeyCredentialSchema.parse(body?.openkey ?? c.req.query('openkey'));
    const openKey = await dependencies.getOneOpenKey(credential);

    c.set('openKey', openKey);

    const startTime = Date.now();
    await next();

    void dependencies.logOpenKeyUsage(openKey.id, {
      endpoint: c.req.path,
      method: c.req.method,
      clientIp: getClientIp(c),
      userAgent: c.req.header('user-agent'),
      statusCode: c.res.status,
      responseTime: Date.now() - startTime,
    });
  };
}

export const isOpenKeyOk = createOpenKeyMiddleware();
