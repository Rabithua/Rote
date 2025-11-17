import moment from 'moment';
import { HonoContext } from '../types/hono';

// Request middleware, record IP and time
export const recorderIpAndTime = async (c: HonoContext, next: () => Promise<void>) => {
  // Skip logging for specific endpoints
  const ignoredPaths = ['/', '/v1/api/status'];
  const path = new URL(c.req.url).pathname;

  if (ignoredPaths.includes(path)) {
    await next();
    return;
  }

  const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';

  const logMessage = `[${moment().format(
    'YYYY/MM/DD HH:mm:ss'
  )}] IP: ${ipAddress} | Method: ${c.req.method} | Path: ${path}`;
  console.log(logMessage);
  await next();
};
