import express from 'express';
import { NotificationConfig } from '../../types/config';
import { getConfig, isInitialized } from '../../utils/config';
import { getSiteMapData } from '../../utils/dbMethods';
import { asyncHandler } from '../../utils/handlers';
import { createResponse } from '../../utils/main';
import prisma from '../../utils/prisma';

// 站点数据相关路由
const siteRouter = express.Router();

// 获取站点地图数据
siteRouter.get(
  '/sitemap',
  asyncHandler(async (req, res) => {
    const data = await getSiteMapData();
    res.status(200).json(createResponse(data));
  })
);

// 获取站点状态和基本信息
siteRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    try {
      // 检查系统是否已初始化
      const initialized = await isInitialized();

      // 获取站点配置
      const siteConfig = await getConfig('site');
      const systemConfig = await getConfig('system');
      const notificationConfig = await getConfig<NotificationConfig>('notification');

      // 检查数据库连接状态
      let databaseConnected = false;
      try {
        await prisma.$queryRaw`SELECT 1`;
        databaseConnected = true;
      } catch (_error) {
        // 数据库连接失败
      }

      // 构建响应数据
      const status = {
        // 系统状态
        isInitialized: initialized,
        databaseConnected,

        // 站点信息
        site: {
          name: (siteConfig as any)?.name || 'Rote',
          description: (siteConfig as any)?.description || '',
          url: (siteConfig as any)?.url || '',
          defaultLanguage: (siteConfig as any)?.defaultLanguage || 'zh-CN',
        },

        // 系统信息
        system: {
          version: (systemConfig as any)?.initializationVersion || '1.0.0',
          lastMigration: (systemConfig as any)?.lastMigrationVersion || 'unknown',
        },

        // 通知配置（仅返回 public key）
        notification: {
          vapidPublicKey: notificationConfig?.vapidPublicKey || null,
        },

        // 时间戳
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(createResponse(status));
    } catch (error) {
      // 如果获取状态失败，返回基本错误信息
      res.status(500).json(createResponse(null, 'Failed to get site status'));
    }
  })
);

// 获取系统配置状态（用于初始化向导）
siteRouter.get(
  '/config-status',
  asyncHandler(async (req, res) => {
    try {
      // 检查系统是否已初始化
      const initialized = await isInitialized();

      if (initialized) {
        // 如果已初始化，返回基本配置信息
        const siteConfig = await getConfig('site');
        const systemConfig = await getConfig('system');

        res.status(200).json(
          createResponse({
            isInitialized: true,
            site: {
              name: (siteConfig as any)?.name || 'Rote',
              description: (siteConfig as any)?.description || '',
              url: (siteConfig as any)?.url || '',
            },
            system: {
              version: (systemConfig as any)?.initializationVersion || '1.0.0',
            },
          })
        );
      } else {
        // 如果未初始化，返回初始化所需的信息
        res.status(200).json(
          createResponse({
            isInitialized: false,
            requiresSetup: true,
            setupSteps: ['basic', 'database', 'storage', 'email', 'security'],
          })
        );
      }
    } catch (error) {
      res.status(500).json(createResponse(null, 'Failed to get configuration status'));
    }
  })
);

export default siteRouter;
