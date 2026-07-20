import { Hono } from 'hono';
import {
  authenticateJWT,
  optionalJWT,
  requireAdmin,
  requireSuperAdmin,
} from '../../middleware/jwtAuth';
import type { AiConfig, ConfigTestResult, NotificationConfig } from '../../types/config';
import type { HonoContext, HonoVariables } from '../../types/hono';
import {
  generateSecurityKeys,
  getAllConfigs,
  getConfig,
  isInitialized,
  refreshConfigCache,
  setConfig,
} from '../../utils/config';
import { resolveIncomingAiConfig, sanitizeAiConfig } from '../../utils/ai/providers';
import {
  buildUserRegisteredEnvelope,
  findAdminHookChannel,
  sendAdminHookEnvelope,
  validateAdminHookChannel,
  validateNotificationConfig,
} from '../../utils/adminHooks';
import { ConfigTester } from '../../utils/configTester';
import { resolveCustomHeadScriptsUpdate } from '../../utils/customHeadScripts';
import { createResponse, getApiUrl } from '../../utils/main';
import {
  getStorageFriendlyError,
  logStorageTestResult,
  logStorageTestStart,
} from './adminStorageUtils';
import adminSetupRouter from './adminSetup';
import adminUsersRouter from './adminUsers';

const adminRouter = new Hono<{ Variables: HonoVariables }>();

adminRouter.route('/', adminSetupRouter);

adminRouter.post('/hooks/test', authenticateJWT, requireAdmin, async (c: HonoContext) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const channel = body.channel
      ? validateAdminHookChannel(body.channel)
      : typeof body.channelId === 'string'
        ? await findAdminHookChannel(body.channelId)
        : null;

    if (!channel) {
      return c.json(createResponse(null, ''), 404);
    }

    const testChannel = {
      ...channel,
      enabled: true,
      events: ['user.registered' as const],
    };
    const result = await sendAdminHookEnvelope(
      buildUserRegisteredEnvelope({
        createdAt: new Date(),
        id: '00000000-0000-0000-0000-000000000000',
        nickname: 'Hook Test',
        role: 'user',
        username: 'hook-test',
      }),
      [testChannel]
    );

    const failedResult = result.results.find((item) => item.status === 'failed');
    if (failedResult) {
      return c.json(createResponse(result, failedResult.error || 'Hook test failed'), 502);
    }

    return c.json(createResponse(result), 200);
  } catch (error: any) {
    return c.json(
      createResponse(null, error instanceof Error ? error.message : String(error ?? '')),
      400
    );
  }
});

const sanitizeSettingsForAdmin = (configs: Record<string, any>) => {
  if (!configs.ai) return configs;
  return {
    ...configs,
    ai: sanitizeAiConfig(configs.ai),
  };
};

// 获取所有配置（管理员）
adminRouter.get('/settings', authenticateJWT, requireAdmin, async (c: HonoContext) => {
  try {
    const group = c.req.query('group');

    if (group) {
      // 获取指定分组的配置
      const config = await getConfig(group as any);
      if (!config) {
        return c.json(createResponse(null, 'Configuration group not found'), 404);
      }

      return c.json(
        createResponse({
          group,
          config: group === 'ai' ? sanitizeAiConfig(config as AiConfig) : config,
        }),
        200
      );
    } else {
      // 获取所有配置
      const allConfigs = await getAllConfigs();
      return c.json(createResponse(sanitizeSettingsForAdmin(allConfigs)), 200);
    }
  } catch (error: any) {
    console.error('Failed to get settings:', error);
    return c.json(createResponse(null, 'Failed to get settings'), 500);
  }
});

// 更新配置（管理员）
adminRouter.put('/settings', authenticateJWT, requireAdmin, async (c: HonoContext) => {
  try {
    const body = await c.req.json();
    const { group } = body as { group: string; config: any };
    let { config } = body as { group: string; config: any };

    if (!group || !config) {
      return c.json(createResponse(null, 'Group and config are required'), 400);
    }

    // 验证分组是否有效
    const validGroups = ['site', 'storage', 'security', 'notification', 'ui', 'system', 'ai'];
    if (!validGroups.includes(group)) {
      return c.json(createResponse(null, 'Invalid configuration group'), 400);
    }

    // 对于系统配置，只允许超级管理员修改
    const user = c.get('user') as any;
    if (group === 'system' && user?.role !== 'super_admin') {
      return c.json(createResponse(null, 'Only super admin can modify system configuration'), 403);
    }

    if (group === 'site') {
      try {
        const existingSiteConfig = (await getConfig('site')) as Record<string, any> | null;
        const incomingScripts = resolveCustomHeadScriptsUpdate(
          existingSiteConfig?.customHeadScripts,
          config.customHeadScripts,
          user?.role === 'super_admin'
        );

        config = { ...config };
        if (incomingScripts === undefined) delete config.customHeadScripts;
        else config.customHeadScripts = incomingScripts;
      } catch (error: any) {
        const message = error instanceof Error ? error.message : String(error ?? '');
        return c.json(
          createResponse(null, message),
          message === 'Only super admin can modify custom head scripts' ? 403 : 400
        );
      }
    }

    // 如果是存储配置，需要先验证配置是否可用
    if (group === 'storage') {
      // 验证存储配置字段是否完整
      if (
        !config.endpoint ||
        !config.bucket ||
        !config.accessKeyId ||
        !config.secretAccessKey ||
        !config.urlPrefix
      ) {
        return c.json(createResponse(null, 'Storage configuration is incomplete'), 400);
      }

      // 测试存储配置是否可用
      logStorageTestStart('settings:update', config);
      const storageTest = await ConfigTester.testStorage(config);
      logStorageTestResult('settings:update', storageTest);
      if (!storageTest.success) {
        const friendlyMessage = getStorageFriendlyError(storageTest.details, storageTest.message);
        return c.json(
          createResponse(null, `Storage configuration test failed: ${friendlyMessage}`),
          400
        );
      }
    }

    // 如果是 UI 配置，验证 apiRateLimit
    if (group === 'ui') {
      if (
        config.apiRateLimit !== undefined &&
        (typeof config.apiRateLimit !== 'number' || config.apiRateLimit < 10)
      ) {
        return c.json(createResponse(null, 'API rate limit must be a number and at least 10'), 400);
      }
      if (
        config.maxVideoUploadSizeMB !== undefined &&
        (typeof config.maxVideoUploadSizeMB !== 'number' || config.maxVideoUploadSizeMB < 1)
      ) {
        return c.json(
          createResponse(null, 'Video upload size limit must be a number and at least 1 MB'),
          400
        );
      }
      // 验证 defaultUserRole 必须是有效角色
      if (config.defaultUserRole && !['user', 'moderator'].includes(config.defaultUserRole)) {
        return c.json(
          createResponse(null, 'Default user role must be either "user" or "moderator"'),
          400
        );
      }
    }

    // 如果是 Security 配置，验证 OAuth 配置
    if (group === 'security') {
      const securityConfig = config as any;
      if (securityConfig.oauth) {
        const oauthConfig = securityConfig.oauth;
        if (oauthConfig.enabled && oauthConfig.providers) {
          // 动态验证所有已配置的提供商
          const { oauthProviderRegistry } = await import('../../utils/oauth/providers');

          for (const [providerName, providerConfig] of Object.entries(oauthConfig.providers)) {
            if ((providerConfig as any)?.enabled) {
              try {
                await oauthProviderRegistry.validateProviderConfig(providerName, providerConfig);

                // 验证 callbackUrl 格式
                if ((providerConfig as any)?.callbackUrl) {
                  try {
                    new URL((providerConfig as any).callbackUrl);
                  } catch {
                    return c.json(
                      createResponse(null, `Invalid ${providerName} OAuth callbackUrl format`, 400),
                      400
                    );
                  }
                }
              } catch (error: any) {
                return c.json(
                  createResponse(null, `${providerName} OAuth: ${error.message}`, 400),
                  400
                );
              }
            }
          }
        }
      }
    }

    if (group === 'ai') {
      const existing = await getConfig<AiConfig>('ai');
      config = resolveIncomingAiConfig(config as Partial<AiConfig>, existing);
      if (
        config.embedding?.dimensions !== undefined &&
        (typeof config.embedding.dimensions !== 'number' ||
          config.embedding.dimensions < 1 ||
          config.embedding.dimensions > 4000)
      ) {
        return c.json(createResponse(null, 'Embedding dimensions must be between 1 and 4000'), 400);
      }
    }

    if (group === 'notification') {
      try {
        config = validateNotificationConfig(config as NotificationConfig);
      } catch (error: any) {
        return c.json(
          createResponse(null, error instanceof Error ? error.message : String(error ?? '')),
          400
        );
      }
    }

    // 更新配置
    const success = await setConfig(group as any, config, {
      isRequired: ['site', 'storage', 'security'].includes(group),
      isSystem: group === 'system',
      isInitialized: true,
    });

    if (!success) {
      return c.json(createResponse(null, 'Failed to update configuration'), 500);
    }

    return c.json(
      createResponse(
        { group, config: group === 'ai' ? sanitizeAiConfig(config as AiConfig) : config },
        'Configuration updated successfully'
      ),
      200
    );
  } catch (error: any) {
    console.error('Failed to update settings:', error);
    return c.json(createResponse(null, 'Failed to update settings'), 500);
  }
});

// 测试配置连接（初始化前公开，初始化后需管理员）
adminRouter.post('/settings/test', optionalJWT, async (c: HonoContext) => {
  try {
    // 若系统已初始化，要求管理员权限
    const initialized = await isInitialized();
    if (initialized) {
      const user = (c.get('user') as any) || null;
      if (!user) {
        return c.json(createResponse(null, 'Authentication required'), 401);
      }
      if (!['admin', 'super_admin'].includes(user.role)) {
        return c.json(createResponse(null, 'Only admin can test configuration'), 403);
      }
    }

    const body = await c.req.json();
    const { type, config } = body as { type: string; config: any };

    if (!type || !config) {
      return c.json(createResponse(null, 'Type and config are required'), 400);
    }

    let testResult: ConfigTestResult;

    switch (type) {
      case 'storage':
        if (!config.urlPrefix) {
          return c.json(createResponse(null, 'Storage configuration is incomplete'), 400);
        }
        logStorageTestStart('settings:test', config);
        testResult = await ConfigTester.testStorage(config);
        logStorageTestResult('settings:test', testResult);
        break;
      case 'database':
        testResult = await ConfigTester.testDatabase();
        break;
      default:
        return c.json(createResponse(null, 'Invalid test type'), 400);
    }

    return c.json(createResponse(testResult), 200);
  } catch (error: any) {
    console.error('Configuration test failed:', error);
    return c.json(createResponse(null, 'Configuration test failed'), 500);
  }
});

// 重新生成安全密钥（超级管理员）
adminRouter.post(
  '/settings/regenerate-keys',
  authenticateJWT,
  requireSuperAdmin,
  async (c: HonoContext) => {
    try {
      const success = await generateSecurityKeys();

      if (!success) {
        return c.json(createResponse(null, 'Failed to regenerate security keys'), 500);
      }

      // 获取新生成的密钥
      const securityConfig = await getConfig('security');
      const notificationConfig = await getConfig('notification');

      return c.json(
        createResponse(
          {
            message: 'Security keys regenerated successfully',
            keys: {
              jwtSecret: (securityConfig as any)?.jwtSecret ? '***regenerated***' : '',
              jwtRefreshSecret: (securityConfig as any)?.jwtRefreshSecret
                ? '***regenerated***'
                : '',
              sessionSecret: (securityConfig as any)?.sessionSecret ? '***regenerated***' : '',
              vapidPublicKey: (notificationConfig as any)?.vapidPublicKey || '',
              vapidPrivateKey: (notificationConfig as any)?.vapidPrivateKey
                ? '***regenerated***'
                : '',
            },
          },
          'Security keys regenerated successfully'
        ),
        200
      );
    } catch (error: any) {
      console.error('Failed to regenerate security keys:', error);
      return c.json(createResponse(null, 'Failed to regenerate security keys'), 500);
    }
  }
);

// 自动检测当前 URL（管理员）
adminRouter.get('/settings/detect-urls', authenticateJWT, requireAdmin, async (c: HonoContext) => {
  try {
    // 动态检测当前 API URL（始终自动检测）
    const detectedApiUrl = getApiUrl(c);

    // 获取当前站点配置
    const currentSiteConfig = (await getConfig('site')) as any;
    const currentFrontendUrl = currentSiteConfig?.frontendUrl || 'http://localhost:3001';

    return c.json(
      createResponse({
        detected: {
          apiUrl: detectedApiUrl,
          frontendUrl: currentFrontendUrl,
        },
        current: {
          frontendUrl: currentSiteConfig?.frontendUrl || '',
        },
      }),
      200
    );
  } catch (error: any) {
    console.error('Failed to detect URLs:', error);
    return c.json(createResponse(null, 'Failed to detect URLs'), 500);
  }
});

// 更新 URL 配置（管理员）
adminRouter.post('/settings/update-urls', authenticateJWT, requireAdmin, async (c: HonoContext) => {
  try {
    const body = await c.req.json();
    const { frontendUrl } = body as { frontendUrl?: string };

    // 获取当前站点配置
    const currentSiteConfig = (await getConfig('site')) as any;
    if (!currentSiteConfig) {
      return c.json(createResponse(null, 'Site configuration not found'), 404);
    }

    // 更新前端 URL 配置（API URL 始终自动检测，不需要更新）
    const updatedConfig = {
      ...currentSiteConfig,
      frontendUrl: frontendUrl || currentSiteConfig.frontendUrl,
    };

    const success = await setConfig('site', updatedConfig, {
      isRequired: true,
      isInitialized: true,
    });

    if (!success) {
      return c.json(createResponse(null, 'Failed to update URL configuration'), 500);
    }

    return c.json(
      createResponse(
        {
          message: 'URL configuration updated successfully',
          urls: {
            frontendUrl: updatedConfig.frontendUrl,
          },
        },
        'URL configuration updated successfully'
      ),
      200
    );
  } catch (error: any) {
    console.error('Failed to update URL configuration:', error);
    return c.json(createResponse(null, 'Failed to update URL configuration'), 500);
  }
});

// 刷新配置缓存（测试专用）
adminRouter.post('/refresh-cache', authenticateJWT, requireAdmin, async (c: HonoContext) => {
  try {
    await refreshConfigCache();
    return c.json(createResponse(null, 'Configuration cache refreshed successfully'), 200);
  } catch (error: any) {
    console.error('Failed to refresh configuration cache:', error);
    return c.json(createResponse(null, 'Failed to refresh configuration cache'), 500);
  }
});

adminRouter.route('/', adminUsersRouter);

export default adminRouter;
