import { RateLimiterMemory } from 'rate-limiter-flexible';
import type { UiConfig } from '../types/config';
import type { HonoContext } from '../types/hono';
import { getGlobalConfig } from '../utils/config';
import { getClientIp } from '../utils/main';

// 动态获取速率限制配置
function getRateLimitConfig(): number {
  const uiConfig = getGlobalConfig<UiConfig>('ui');
  // 如果配置存在且有效（>= 10），使用配置值；否则使用默认值 100
  return uiConfig?.apiRateLimit && uiConfig.apiRateLimit >= 10 ? uiConfig.apiRateLimit : 100;
}

// 创建速率限制器实例（延迟初始化）
let limiter: RateLimiterMemory | null = null;
let currentPoints: number = 100; // 跟踪当前配置值

// 获取或创建速率限制器
function getLimiter(): RateLimiterMemory {
  const points = getRateLimitConfig();

  // 如果 limiter 不存在或配置已更改，重新创建
  if (!limiter || currentPoints !== points) {
    limiter = new RateLimiterMemory({
      points, // Maximum number of requests allowed within the duration
      duration: 1, // Duration in seconds (每秒)
    });
    currentPoints = points;
  }

  return limiter;
}

// Create rate limiting middleware function with enhanced features
export const rateLimiterMiddleware = async (c: HonoContext, next: () => Promise<void>) => {
  const user = c.get('user');
  const key = user ? user.id : getClientIp(c);

  try {
    const currentLimiter = getLimiter();
    await currentLimiter.consume(key);
    await next();
  } catch (rejRes: any) {
    const retrySecs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    c.header('Retry-After', String(retrySecs));
    console.log('Too Many Requests', rejRes);
    return c.text(`Too Many Requests. Please try again in ${retrySecs} seconds.`, 429);
  }
};
