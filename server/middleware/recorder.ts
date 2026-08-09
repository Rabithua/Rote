import moment from 'moment';
import type { HonoContext } from '../types/hono';
import { getClientIp } from '../utils/main';

const INTERNAL_BILLING_GRANT_PATH = /^\/internal\/billing\/grants\/[^/]+\/?$/;

export function normalizeRecordedPath(path: string): string {
  if (INTERNAL_BILLING_GRANT_PATH.test(path)) return '/internal/billing/grants/:userId';
  return path;
}

// Request middleware, record IP and time
export const recorderIpAndTime = async (c: HonoContext, next: () => Promise<void>) => {
  // Skip logging for specific endpoints
  const ignoredPaths = ['/', '/v1/api/status'];
  const path = normalizeRecordedPath(new URL(c.req.url).pathname);

  if (ignoredPaths.includes(path)) {
    await next();
    return;
  }

  const ipAddress = getClientIp(c);

  const logMessage = `[${moment().format(
    'YYYY/MM/DD HH:mm:ss'
  )}] IP: ${ipAddress} | Method: ${c.req.method} | Path: ${path}`;
  console.log(logMessage);
  await next();
};
