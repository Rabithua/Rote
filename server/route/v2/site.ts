import { Hono } from 'hono';
import type {
  NotificationConfig,
  SecurityConfig,
  StorageConfig,
  UiConfig,
} from '../../types/config';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { getConfig, isInitialized } from '../../utils/config';
import { checkDatabaseConnection, getSiteMapData } from '../../utils/dbMethods';
import { createResponse } from '../../utils/main';
import { generateSitemapXML } from '../../utils/sitemap';

// 站点数据相关路由
const siteRouter = new Hono<{ Variables: HonoVariables }>();

// 获取站点地图数据
siteRouter.get('/sitemap', async (c: HonoContext) => {
  try {
    const siteConfig = await getConfig('site');
    const dynamicFrontendUrl = c.get('dynamicFrontendUrl') as string | undefined;
    const baseFrontendUrl =
      dynamicFrontendUrl || (siteConfig as any)?.frontendUrl || 'http://localhost:3001';

    const buildFullUrl = (path: string) => {
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const normalizedBase = baseFrontendUrl.endsWith('/')
        ? baseFrontendUrl
        : `${baseFrontendUrl}/`;
      return new URL(normalizedPath, normalizedBase).toString();
    };

    const sitemapData = await getSiteMapData();

    const staticRoutes = [
      { path: '/', changefreq: 'daily' as const, priority: 1 },
      { path: '/landing', changefreq: 'weekly' as const, priority: 0.8 },
      { path: '/login', changefreq: 'monthly' as const, priority: 0.4 },
      { path: '/explore', changefreq: 'daily' as const, priority: 0.7 },
      { path: '/archived', changefreq: 'weekly' as const, priority: 0.6 },
    ];

    const urls = [
      ...staticRoutes.map((route) => ({
        loc: buildFullUrl(route.path),
        changefreq: route.changefreq,
        priority: route.priority,
      })),
      ...sitemapData.users
        .filter((user) => Boolean(user.username))
        .map((user) => ({
          loc: buildFullUrl(`/${user.username}`),
          lastmod: user.updatedAt ? new Date(user.updatedAt).toISOString() : undefined,
          changefreq: 'weekly' as const,
          priority: 0.8,
        })),
      ...sitemapData.notes.map((note) => ({
        loc: buildFullUrl(`/rote/${note.id}`),
        lastmod: note.updatedAt ? new Date(note.updatedAt).toISOString() : undefined,
        changefreq: 'daily' as const,
        priority: 0.6,
      })),
    ];

    const sitemapXml = generateSitemapXML(urls);
    c.header('Content-Type', 'application/xml; charset=utf-8');
    return c.body(sitemapXml, 200);
  } catch (_error) {
    return c.json(createResponse(null, 'Failed to generate sitemap'), 500);
  }
});

// 获取站点状态和基本信息
siteRouter.get('/status', async (c: HonoContext) => {
  try {
    // 检查系统是否已初始化
    const initialized = await isInitialized();

    // 获取站点配置
    const siteConfig = await getConfig('site');
    const systemConfig = await getConfig('system');
    const notificationConfig = await getConfig<NotificationConfig>('notification');
    const storageConfig = (await getConfig('storage')) as Partial<StorageConfig> | null;
    const uiConfig = await getConfig<UiConfig>('ui');
    const securityConfig = await getConfig<SecurityConfig>('security');

    // 检查数据库连接状态
    const databaseConnected = await checkDatabaseConnection();

    // 计算 R2 存储是否可用
    const r2Configured = Boolean(
      storageConfig?.endpoint &&
      storageConfig.bucket &&
      storageConfig.accessKeyId &&
      storageConfig.secretAccessKey
    );

    // 构建响应数据
    const status = {
      // 系统状态
      isInitialized: initialized,
      databaseConnected,

      // 站点信息
      site: {
        name: (siteConfig as any)?.name || 'Rote',
        description: (siteConfig as any)?.description || '',
        frontendUrl: (siteConfig as any)?.frontendUrl || '',
        defaultLanguage: (siteConfig as any)?.defaultLanguage || 'zh-CN',
        icpRecord: (siteConfig as any)?.icpRecord || undefined,
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

      // 存储配置（用于前端判断是否启用附件上传）
      storage: {
        r2Configured,
        urlPrefix: r2Configured ? storageConfig?.urlPrefix || '' : '',
      },

      // UI 配置（用于前端判断是否允许注册等）
      ui: {
        allowRegistration: uiConfig?.allowRegistration ?? true,
        allowUploadFile: uiConfig?.allowUploadFile ?? true,
      },

      // OAuth 配置（用于前端判断是否显示 OAuth 登录按钮）
      oauth: await (async () => {
        const oauthEnabled = securityConfig?.oauth?.enabled ?? false;
        const providers: Record<string, { enabled: boolean }> = {};

        if (oauthEnabled && securityConfig?.oauth?.providers) {
          // 动态获取所有已注册的提供商
          const { oauthProviderRegistry } = await import('../../utils/oauth/providers');
          const registeredProviders = oauthProviderRegistry.getAllProviders();

          for (const provider of registeredProviders) {
            const providerConfig = securityConfig.oauth.providers[provider.name];
            if (providerConfig) {
              providers[provider.name] = {
                enabled: providerConfig.enabled ?? false,
              };
            }
          }
        }

        return {
          enabled: oauthEnabled,
          providers,
        };
      })(),

      // 时间戳
      timestamp: new Date().toISOString(),
    };

    return c.json(createResponse(status), 200);
  } catch (_error) {
    // 如果获取状态失败，返回基本错误信息
    return c.json(createResponse(null, 'Failed to get site status'), 500);
  }
});

// 获取系统配置状态（用于初始化向导）
siteRouter.get('/config-status', async (c: HonoContext) => {
  try {
    // 检查系统是否已初始化
    const initialized = await isInitialized();

    if (initialized) {
      // 如果已初始化，返回基本配置信息
      const siteConfig = await getConfig('site');
      const systemConfig = await getConfig('system');

      return c.json(
        createResponse({
          isInitialized: true,
          site: {
            name: (siteConfig as any)?.name || 'Rote',
            description: (siteConfig as any)?.description || '',
            frontendUrl: (siteConfig as any)?.frontendUrl || '',
          },
          system: {
            version: (systemConfig as any)?.initializationVersion || '1.0.0',
          },
        }),
        200
      );
    } else {
      // 如果未初始化，返回初始化所需的信息
      return c.json(
        createResponse({
          isInitialized: false,
          requiresSetup: true,
          setupSteps: ['basic', 'database', 'storage', 'email', 'security'],
        }),
        200
      );
    }
  } catch (_error) {
    return c.json(createResponse(null, 'Failed to get configuration status'), 500);
  }
});

export default siteRouter;
