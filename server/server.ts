import express = require('express');
import bodyParser from 'body-parser';
import cors from 'cors';
import passport from './utils/passport';

import { rateLimiterMiddleware } from './middleware/limiter';
import { initializeConfig } from './utils/config';
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
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// cors
app.use(
  cors({
    origin: process.env.CORS?.split(',') || '*',
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

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

    // 启动时检查系统状态
    await StartupMigration.checkStartupStatus();
    await StartupMigration.showConfigStatus();
  } catch (error) {
    console.error('❌ Failed to initialize system:', error);
  }
});
