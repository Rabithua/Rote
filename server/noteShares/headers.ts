import type { MiddlewareHandler } from 'hono';

// Shared-note responses are bearer-token content. Browsers and proxies must
// re-check the server after creation, revocation, or note deletion.
export const shareHeaders: MiddlewareHandler = async (c, next) => {
  c.header('Cache-Control', 'no-store');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Robots-Tag', 'noindex, nofollow, noarchive');
  await next();
};
