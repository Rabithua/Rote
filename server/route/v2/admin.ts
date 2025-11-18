import { Hono } from 'hono';
import {
  authenticateJWT,
  optionalJWT,
  requireAdmin,
  requireSuperAdmin,
} from '../../middleware/jwtAuth';
import type {
  ConfigTestResult,
  InitializationStatus,
  SetupRequest,
  SetupResponse,
} from '../../types/config';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { UserRole } from '../../types/main';
import {
  generateSecurityKeys,
  getAllConfigs,
  getConfig,
  getMissingRequiredConfigs,
  isInitialized,
  refreshConfigCache,
  setConfig,
} from '../../utils/config';
import { ConfigTester } from '../../utils/configTester';
import {
  checkDatabaseConnection,
  createAdminUser,
  deleteUserById,
  findUserByUsernameOrEmail,
  getLatestMigrationVersion,
  getRoleStats,
  getUserByIdForAdmin,
  hasAdminUser,
  listUsers,
  updateUserRole,
} from '../../utils/dbMethods';
import { createResponse, getApiUrl } from '../../utils/main';

const adminRouter = new Hono<{ Variables: HonoVariables }>();

// 获取系统初始化状态
adminRouter.get('/status', async (c: HonoContext) => {
  try {
    // 检查系统是否已初始化
    const initialized = await isInitialized();

    // 获取缺失的必需配置
    const missingRequiredConfigs = await getMissingRequiredConfigs();

    // 检查数据库连接
    const databaseConnected = await checkDatabaseConnection();

    // 检查是否有管理员用户
    const hasAdmin = await hasAdminUser();

    // 生成警告信息
    const warnings: string[] = [];

    if (!databaseConnected) {
      warnings.push('Database connection failed, please check database configuration');
    }

    if (initialized && !hasAdmin) {
      warnings.push('System is initialized but no admin user found');
    }

    if (missingRequiredConfigs.length > 0) {
      warnings.push(`Missing required configurations: ${missingRequiredConfigs.join(', ')}`);
    }

    // 构建响应数据
    const status: InitializationStatus = {
      isInitialized: initialized,
      missingRequiredConfigs,
      warnings,
    };

    // 如果系统已初始化，添加额外信息
    if (initialized) {
      const systemConfig = await getConfig('system');
      const siteConfig = await getConfig('site');

      return c.json(
        createResponse({
          ...status,
          systemInfo: {
            databaseConnected,
            hasAdmin,
            siteName: (siteConfig as any)?.name || 'Not set',
            siteUrl: (siteConfig as any)?.url || 'Not set',
            initializationVersion: (systemConfig as any)?.initializationVersion || '1.0.0',
          },
        }),
        200
      );
    } else {
      return c.json(createResponse(status), 200);
    }
  } catch (error) {
    console.error('获取系统状态失败:', error);
    return c.json(createResponse(null, 'Failed to get system status'), 500);
  }
});

// 系统初始化向导
adminRouter.post('/setup', async (c: HonoContext) => {
  try {
    // 检查系统是否已经初始化
    const alreadyInitialized = await isInitialized();
    if (alreadyInitialized) {
      return c.json(createResponse(null, 'System has already been initialized'), 400);
    }

    // 验证请求数据
    const body = await c.req.json();
    const setupData: SetupRequest = body;
    if (!setupData.site || !setupData.storage || !setupData.ui || !setupData.admin) {
      return c.json(createResponse(null, 'Missing required configuration data'), 400);
    }

    // 验证必需字段
    if (!setupData.site.name || !setupData.site.url) {
      return c.json(createResponse(null, 'Site name and URL are required'), 400);
    }

    if (
      !setupData.storage.endpoint ||
      !setupData.storage.bucket ||
      !setupData.storage.accessKeyId ||
      !setupData.storage.secretAccessKey
    ) {
      return c.json(createResponse(null, 'Storage configuration is incomplete'), 400);
    }

    if (!setupData.admin.username || !setupData.admin.email || !setupData.admin.password) {
      return c.json(createResponse(null, 'Admin user information is incomplete'), 400);
    }

    // 测试存储配置
    const storageTest = await ConfigTester.testStorage(setupData.storage);
    if (!storageTest.success) {
      return c.json(
        createResponse(null, `Storage configuration test failed: ${storageTest.message}`),
        400
      );
    }

    // 检查管理员用户是否已存在
    const existingUser = await findUserByUsernameOrEmail({
      username: setupData.admin.username,
      email: setupData.admin.email,
    });

    if (existingUser) {
      return c.json(createResponse(null, 'Username or email already exists'), 400);
    }

    // 开始初始化流程
    // 1. 保存站点配置
    await setConfig(
      'site',
      {
        name: setupData.site.name,
        url: setupData.site.url,
        description: setupData.site.description || '',
        defaultLanguage: setupData.site.defaultLanguage || 'zh-CN',
        apiUrl: '', // 留空，让系统自动检测
        frontendUrl: setupData.site.url, // 使用站点 URL 作为前端 URL
      },
      { isRequired: true, isInitialized: true }
    );

    // 2. 保存存储配置
    await setConfig('storage', setupData.storage, { isRequired: true, isInitialized: true });

    // 3. 保存界面配置
    await setConfig('ui', setupData.ui, { isRequired: false, isInitialized: true });

    // 4. 生成并保存安全密钥
    const securityKeysGenerated = await generateSecurityKeys();
    if (!securityKeysGenerated) {
      throw new Error('Failed to generate security keys');
    }

    // 5. 创建管理员用户（在事务中）
    const adminUser = await createAdminUser({
      username: setupData.admin.username,
      email: setupData.admin.email,
      password: setupData.admin.password,
      nickname: setupData.admin.nickname,
    });

    // 6. 标记系统为已初始化
    // 获取当前迁移版本
    const migrationVersion = await getLatestMigrationVersion();

    await setConfig(
      'system',
      {
        isInitialized: true,
        initializationVersion: '1.0.0',
        lastMigrationVersion: migrationVersion,
      },
      { isRequired: true, isSystem: true, isInitialized: true }
    );

    // 7. 获取生成的密钥（用于响应）
    const securityConfig = await getConfig('security');
    const notificationConfig = await getConfig('notification');

    const response: SetupResponse = {
      success: true,
      message: 'System initialization completed successfully',
      data: {
        adminUser,
        generatedKeys: {
          jwtSecret: (securityConfig as any)?.jwtSecret || '',
          jwtRefreshSecret: (securityConfig as any)?.jwtRefreshSecret || '',
          sessionSecret: (securityConfig as any)?.sessionSecret || '',
          vapidPublicKey: (notificationConfig as any)?.vapidPublicKey || '',
          vapidPrivateKey: (notificationConfig as any)?.vapidPrivateKey || '',
        },
      },
    };

    return c.json(createResponse(response.data, response.message), 200);
  } catch (error: any) {
    console.error('System initialization failed:', error);
    return c.json(createResponse(null, `System initialization failed: ${error.message}`), 500);
  }
});

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
          config,
        }),
        200
      );
    } else {
      // 获取所有配置
      const allConfigs = await getAllConfigs();
      return c.json(createResponse(allConfigs), 200);
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
    const { group, config } = body as { group: string; config: any };

    if (!group || !config) {
      return c.json(createResponse(null, 'Group and config are required'), 400);
    }

    // 验证分组是否有效
    const validGroups = ['site', 'storage', 'security', 'notification', 'ui', 'system'];
    if (!validGroups.includes(group)) {
      return c.json(createResponse(null, 'Invalid configuration group'), 400);
    }

    // 对于系统配置，只允许超级管理员修改
    const user = c.get('user') as any;
    if (group === 'system' && user?.role !== 'super_admin') {
      return c.json(createResponse(null, 'Only super admin can modify system configuration'), 403);
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

    return c.json(createResponse({ group, config }, 'Configuration updated successfully'), 200);
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
        testResult = await ConfigTester.testStorage(config);
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
    // 动态检测当前 API URL
    const detectedApiUrl = getApiUrl(c);

    // 获取当前站点配置
    const currentSiteConfig = (await getConfig('site')) as any;
    const currentFrontendUrl =
      currentSiteConfig?.frontendUrl || currentSiteConfig?.url || 'http://localhost:3001';

    return c.json(
      createResponse({
        detected: {
          apiUrl: detectedApiUrl,
          frontendUrl: currentFrontendUrl,
        },
        current: {
          apiUrl: currentSiteConfig?.apiUrl || '',
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
    const { apiUrl, frontendUrl } = body as { apiUrl?: string; frontendUrl?: string };

    // 获取当前站点配置
    const currentSiteConfig = (await getConfig('site')) as any;
    if (!currentSiteConfig) {
      return c.json(createResponse(null, 'Site configuration not found'), 404);
    }

    // 更新 URL 配置
    const updatedConfig = {
      ...currentSiteConfig,
      apiUrl: apiUrl || '',
      frontendUrl: frontendUrl || currentSiteConfig.url,
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
            apiUrl: updatedConfig.apiUrl,
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

// 获取所有用户列表（管理员）
adminRouter.get('/users', authenticateJWT, requireAdmin, async (c: HonoContext) => {
  const page = c.req.query('page') || '1';
  const limit = c.req.query('limit') || '10';
  const role = c.req.query('role');
  const search = c.req.query('search');
  const { users, total } = await listUsers({ page, limit, role, search });

  return c.json(
    createResponse({
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    }),
    200
  );
});

// 更新用户角色（超级管理员）
adminRouter.put(
  '/users/:userId/role',
  authenticateJWT,
  requireSuperAdmin,
  async (c: HonoContext) => {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    const { role } = body as { role: UserRole };

    if (!Object.values(UserRole).includes(role)) {
      throw new Error('Invalid role');
    }

    const user = await updateUserRole(userId, role);

    return c.json(createResponse(user, 'User role updated successfully'), 200);
  }
);

// 获取用户详细信息（管理员）
adminRouter.get('/users/:userId', authenticateJWT, requireAdmin, async (c: HonoContext) => {
  const userId = c.req.param('userId');

  const user = await getUserByIdForAdmin(userId);

  if (!user) {
    throw new Error('User not found');
  }

  return c.json(createResponse(user), 200);
});

// 删除用户（超级管理员）
adminRouter.delete('/users/:userId', authenticateJWT, requireSuperAdmin, async (c: HonoContext) => {
  const userId = c.req.param('userId');

  await deleteUserById(userId);

  return c.json(createResponse(null, 'User deleted successfully'), 200);
});

// 获取角色统计信息（管理员）
adminRouter.get('/roles/stats', authenticateJWT, requireAdmin, async (c: HonoContext) => {
  const stats = await getRoleStats();
  return c.json(createResponse(stats), 200);
});

export default adminRouter;
