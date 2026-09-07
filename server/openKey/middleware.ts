import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import type { HonoContext, HonoVariables } from '../types/hono';
import openKeyErrors from '../route/v2/openKey/errorCodes.json';
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
  now(): number;
}

const defaultDependencies: OpenKeyMiddlewareDependencies = {
  getOneOpenKey: getOneOpenKeyFromDatabase,
  logOpenKeyUsage: logOpenKeyUsageToDatabase,
  now: Date.now,
};

export function createOpenKeyMiddleware(
  dependencies: OpenKeyMiddlewareDependencies = defaultDependencies
) {
  return async (c: HonoContext, next: () => Promise<void>) => {
    const body = await c.req.json().catch(() => ({}));
    const credentialResult = OpenKeyCredentialSchema.safeParse(
      body?.openkey ?? c.req.query('openkey')
    );
    if (!credentialResult.success) {
      throw new HTTPException(400, { message: openKeyErrors.invalidCredential });
    }

    const startTime = dependencies.now();
    const credential = credentialResult.data;
    const openKey = await dependencies.getOneOpenKey(credential);

    c.set('openKey', openKey);

    await next();

    void dependencies.logOpenKeyUsage(openKey.id, {
      endpoint: c.req.path,
      method: c.req.method,
      clientIp: getClientIp(c),
      userAgent: c.req.header('user-agent'),
      statusCode: c.res.status,
      responseTime: dependencies.now() - startTime,
    });
  };
}

export const isOpenKeyOk = createOpenKeyMiddleware();
