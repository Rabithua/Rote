import moment from 'moment';
import type { HonoContext } from '../types/hono';
import { getClientIp } from '../utils/main';

const INTERNAL_BILLING_GRANT_PATH = /^\/internal\/billing\/grants\/[^/]+\/?$/;

export function normalizeRecordedPath(path: string): string {
  if (INTERNAL_BILLING_GRANT_PATH.test(path)) return '/internal/billing/grants/:userId';
  if (/^\/v2\/api\/shares(?:\/|$)/.test(path)) return '/v2/api/shares/:token';
  return path;
}

// Request middleware, record IP and time
export const recorderIpAndTime = async (c: HonoContext, next: () => Promise<void>) => {
  // Skip logging for specific endpoints
  const ignoredPaths = ['/', '/v1/api/status', '/v2/api/health'];
  const path = normalizeRecordedPath(new URL(c.req.url).pathname);

  if (ignoredPaths.includes(path)) {
    await next();
    return;
  }

  const ipAddress = getClientIp(c);
  const startTime = performance.now();

  await next();

  const durationMs = Math.max(0, Math.round(performance.now() - startTime));
  const logMessage = `[${moment().format(
    'YYYY/MM/DD HH:mm:ss'
  )}] IP: ${ipAddress} | Method: ${c.req.method} | Path: ${path} | Status: ${c.res.status} | DurationMs: ${durationMs}`;
  console.log(logMessage);
};
