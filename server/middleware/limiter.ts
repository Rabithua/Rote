import { RateLimiterMemory } from 'rate-limiter-flexible';
import { HonoContext } from '../types/hono';

// Configure the rate limiter
const limiter = new RateLimiterMemory({
  points: 100, // Maximum number of requests allowed within the duration
  duration: 1, // Duration in seconds
});

// Create rate limiting middleware function with enhanced features
export const rateLimiterMiddleware = async (c: HonoContext, next: () => Promise<void>) => {
  const user = c.get('user');
  const key = user
    ? user.id
    : c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';

  try {
    await limiter.consume(key);
    console.log(`Request allowed for key: ${key}`);
    await next();
  } catch (rejRes: any) {
    const retrySecs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    c.header('Retry-After', String(retrySecs));
    console.log('Too Many Requests', rejRes);
    return c.text(`Too Many Requests. Please try again in ${retrySecs} seconds.`, 429);
  }
};
