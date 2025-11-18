import moment from 'moment';
import type { HonoContext } from '../types/hono';
import { getClientIp } from '../utils/main';

// Request middleware, record IP and time
export const recorderIpAndTime = async (c: HonoContext, next: () => Promise<void>) => {
  // Skip logging for specific endpoints
  const ignoredPaths = ['/', '/v1/api/status'];
  const path = new URL(c.req.url).pathname;

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
