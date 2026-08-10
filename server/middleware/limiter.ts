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

type RateLimitConsumer = (key: string) => Promise<unknown>;

function isRateLimitRejection(value: unknown): value is { msBeforeNext: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'msBeforeNext' in value &&
    typeof value.msBeforeNext === 'number' &&
    Number.isFinite(value.msBeforeNext)
  );
}

export function createRateLimiterMiddleware(
  consume: RateLimitConsumer = (key) => getLimiter().consume(key)
) {
  return async (c: HonoContext, next: () => Promise<void>) => {
    const user = c.get('user');
    const key = user ? user.id : getClientIp(c);

    try {
      await consume(key);
    } catch (error) {
      if (!isRateLimitRejection(error)) throw error;
      const retrySecs = Math.round(error.msBeforeNext / 1000) || 1;
      c.header('Retry-After', String(retrySecs));
      console.log('Too Many Requests', error);
      return c.text(`Too Many Requests. Please try again in ${retrySecs} seconds.`, 429);
    }

    await next();
  };
}

// Create rate limiting middleware function with enhanced features
export const rateLimiterMiddleware = createRateLimiterMiddleware();
