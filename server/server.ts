import express = require('express');
import bodyParser from 'body-parser';
import cors from 'cors';
import passport from './utils/passport';

import { rateLimiterMiddleware } from './middleware/limiter';
import type { SiteConfig } from './types/config';
import {
  getGlobalConfig,
  initializeConfig,
  subscribeConfigChange,
  validateSystemConfiguration,
} from './utils/config';
import { errorHandler } from './utils/handlers';
import { injectDynamicUrls } from './utils/main';
import { recorderIpAndTime } from './utils/recoder';
import { StartupMigration } from './utils/startupMigration';

import routerV2 from './route/v2'; // RESTful API routes

const app: express.Application = express();

const port = process.env.PORT || 3000;

// record ip and time
app.use(recorderIpAndTime);

// inject dynamic URLs
app.use(injectDynamicUrls);

// rate limiter
app.use(rateLimiterMiddleware);

// Initialize Passport
app.use(passport.initialize());

// body parser
app.use(
  bodyParser.urlencoded({
    extended: false,
    limit: '10mb', // 设置合理的限制，防止内存耗尽攻击
  })
);
app.use(
  bodyParser.json({
    limit: '10mb', // 设置合理的限制，防止内存耗尽攻击
  })
);

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

app.use(
  cors({
    origin: (origin, callback) => {
      // 允许没有 origin 的请求（如移动应用、Postman 等）
      if (!origin) {
        return callback(null, true);
      }
      // 如果没有设置 allowedOrigins，允许所有跨域请求
      if (!allowedOrigins) {
        return callback(null, true);
      }
      // 如果设置了 allowedOrigins，检查 origin 是否在允许列表中
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // 拒绝不在允许列表中的 origin
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// 监听 site 配置变更，动态更新 CORS 设置
subscribeConfigChange('site', (group, newConfig, oldConfig) => {
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

app.use('/v2/api', routerV2); // RESTful API

// Global error handler (must be after all routes)
app.use(errorHandler);

app.get('*', (req, res) => {
  res.status(404).send({
    code: 1,
    message: 'Api not found!',
    data: null,
  });
});

app.listen(port, async () => {
  console.log(`Rote Node backend server listening on port ${port}!`);

  try {
    // 初始化配置管理器
    await initializeConfig();

    // 配置管理器初始化后，重新初始化 CORS 配置（从数据库读取）
    initializeCorsConfig();

    // 验证关键配置是否正确加载
    validateSystemConfiguration();

    // 启动时检查系统状态
    await StartupMigration.checkStartupStatus();
    await StartupMigration.showConfigStatus();
  } catch (error) {
    console.error('❌ Failed to initialize system:', error);
  }
});
