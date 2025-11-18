import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { rateLimiterMiddleware } from './middleware/limiter';
import { recorderIpAndTime } from './middleware/recorder';
import routerV2 from './route/v2'; // RESTful API routes
import type { SiteConfig } from './types/config';
import { HonoVariables } from './types/hono';
import {
  getGlobalConfig,
  initializeConfig,
  subscribeConfigChange,
  validateSystemConfiguration,
} from './utils/config';
import { waitForDatabase } from './utils/drizzle';
import { errorHandler } from './utils/handlers';
import { injectDynamicUrls } from './utils/main';
import { StartupMigration } from './utils/startupMigration';

const app = new Hono<{ Variables: HonoVariables }>();

const port = Number(process.env.PORT) || 3000;

// record ip and time
app.use('*', recorderIpAndTime);

// inject dynamic URLs
app.use('*', injectDynamicUrls);

// rate limiter
app.use('*', rateLimiterMiddleware);

// CORS 配置 - 从数据库或环境变量读取 allowedOrigins
// 当 credentials: true 时，不能使用 origin: '*'，必须明确指定允许的 origin
// 如果设置了 allowedOrigins，则只允许列表中的 origin；否则允许所有跨域请求
let allowedOrigins: string[] | null = null;

// 初始化 CORS 配置的函数
const initializeCorsConfig = () => {
  // 优先从环境变量读取
  if (process.env.ALLOWED_ORIGINS) {
    allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());
    return;
  }

  // 从数据库读取
  const siteConfig = getGlobalConfig<SiteConfig>('site');
  if (siteConfig?.allowedOrigins && siteConfig.allowedOrigins.length > 0) {
    allowedOrigins = siteConfig.allowedOrigins;
  } else {
    allowedOrigins = null; // null 表示允许所有 origin
  }
};

// 初始化 CORS 配置
initializeCorsConfig();

// CORS 中间件
// 当 credentials: true 时，不能使用 origin: '*'，必须明确指定允许的 origin
app.use(
  '*',
  cors({
    origin: (origin) => {
      // 如果没有设置 allowedOrigins，允许所有 origin（返回请求的 origin）
      if (!allowedOrigins || allowedOrigins.length === 0) {
        // 如果有 origin，返回该 origin（而不是 '*'）
        // 如果没有 origin（如移动应用、Postman 等），返回 null 表示允许
        return origin || null;
      }
      // 如果设置了 allowedOrigins，检查 origin 是否在允许列表中
      if (origin && allowedOrigins.includes(origin)) {
        return origin;
      }
      // 如果 origin 不在允许列表中，返回 null 拒绝
      return null;
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  })
);

// RESTful API routes
app.route('/v2/api', routerV2);

// 404 handler
app.notFound((c) =>
  c.json(
    {
      code: 1,
      message: 'Api not found!',
      data: null,
    },
    404
  )
);

// Global error handler (must be after all routes)
app.onError(errorHandler);

// 监听 site 配置变更，动态更新 CORS 设置
subscribeConfigChange('site', (_group, newConfig) => {
  const siteConfig = newConfig as SiteConfig;
  // 如果环境变量未设置，则从数据库配置更新
  if (!process.env.ALLOWED_ORIGINS) {
    if (siteConfig?.allowedOrigins && siteConfig.allowedOrigins.length > 0) {
      allowedOrigins = siteConfig.allowedOrigins;
      console.log('✅ CORS allowed origins updated from database:', allowedOrigins);
    } else {
      allowedOrigins = null;
      console.log('✅ CORS allowed origins set to allow all');
    }
  }
});

// 启动服务器前等待数据库就绪
(async () => {
  try {
    // 等待数据库连接就绪
    await waitForDatabase();

    // 运行数据库迁移
    const { runMigrations } = await import('./utils/drizzle');
    await runMigrations();

    // 初始化配置管理器
    await initializeConfig();

    // 配置管理器初始化后，重新初始化 CORS 配置（从数据库读取）
    initializeCorsConfig();

    // 验证关键配置是否正确加载
    validateSystemConfiguration();

    // 启动时检查系统状态
    await StartupMigration.checkStartupStatus();
    await StartupMigration.showConfigStatus();

    // 启动服务器（使用 Bun 原生服务器）
    // @ts-expect-error - Bun 全局类型在运行时可用
    const bun = globalThis.Bun;
    if (bun?.serve) {
      bun.serve({
        fetch: app.fetch,
        port,
      });
    } else {
      throw new Error('Bun runtime is required');
    }

    console.log(`Rote Node backend server listening on port ${port}!`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})();
