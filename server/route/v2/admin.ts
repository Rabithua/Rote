import express from 'express';
import {
  authenticateJWT,
  optionalJWT,
  requireAdmin,
  requireSuperAdmin,
} from '../../middleware/jwtAuth';
import {
  ConfigTestResult,
  InitializationStatus,
  SetupRequest,
  SetupResponse,
} from '../../types/config';
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
import { asyncHandler } from '../../utils/handlers';
import { createResponse } from '../../utils/main';

const adminRouter = express.Router();

// 获取系统初始化状态
adminRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
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

        res.status(200).json(
          createResponse({
            ...status,
            systemInfo: {
              databaseConnected,
              hasAdmin,
              siteName: (siteConfig as any)?.name || 'Not set',
              siteUrl: (siteConfig as any)?.url || 'Not set',
              initializationVersion: (systemConfig as any)?.initializationVersion || '1.0.0',
            },
          })
        );
      } else {
        res.status(200).json(createResponse(status));
      }
    } catch (error) {
      console.error('获取系统状态失败:', error);
      res.status(500).json(createResponse(null, 'Failed to get system status'));
    }
  })
);

// 系统初始化向导
adminRouter.post(
  '/setup',
  asyncHandler(async (req, res) => {
    try {
      // 检查系统是否已经初始化
      const alreadyInitialized = await isInitialized();
      if (alreadyInitialized) {
        return res.status(400).json(createResponse(null, 'System has already been initialized'));
      }

      // 验证请求数据
      const setupData: SetupRequest = req.body;
      if (!setupData.site || !setupData.storage || !setupData.ui || !setupData.admin) {
        return res.status(400).json(createResponse(null, 'Missing required configuration data'));
      }

      // 验证必需字段
      if (!setupData.site.name || !setupData.site.url) {
        return res.status(400).json(createResponse(null, 'Site name and URL are required'));
      }

      if (
        !setupData.storage.endpoint ||
        !setupData.storage.bucket ||
        !setupData.storage.accessKeyId ||
        !setupData.storage.secretAccessKey
      ) {
        return res.status(400).json(createResponse(null, 'Storage configuration is incomplete'));
      }

      if (!setupData.admin.username || !setupData.admin.email || !setupData.admin.password) {
        return res.status(400).json(createResponse(null, 'Admin user information is incomplete'));
      }

      // 测试存储配置
      const storageTest = await ConfigTester.testStorage(setupData.storage);
      if (!storageTest.success) {
        return res
          .status(400)
          .json(createResponse(null, `Storage configuration test failed: ${storageTest.message}`));
      }

      // 检查管理员用户是否已存在
      const existingUser = await findUserByUsernameOrEmail({
        username: setupData.admin.username,
        email: setupData.admin.email,
      });

      if (existingUser) {
        return res.status(400).json(createResponse(null, 'Username or email already exists'));
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

      res.status(200).json(createResponse(response.data, response.message));
    } catch (error: any) {
      console.error('System initialization failed:', error);
      res.status(500).json(createResponse(null, `System initialization failed: ${error.message}`));
    }
  })
);

// 获取所有配置（管理员）
adminRouter.get(
  '/settings',
  authenticateJWT,
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      const { group } = req.query as { group?: string };

      if (group) {
        // 获取指定分组的配置
        const config = await getConfig(group as any);
        if (!config) {
          return res.status(404).json(createResponse(null, 'Configuration group not found'));
        }

        res.status(200).json(
          createResponse({
            group,
            config,
          })
        );
      } else {
        // 获取所有配置
        const allConfigs = await getAllConfigs();
        res.status(200).json(createResponse(allConfigs));
      }
    } catch (error: any) {
      console.error('Failed to get settings:', error);
      res.status(500).json(createResponse(null, 'Failed to get settings'));
    }
  })
);

// 更新配置（管理员）
adminRouter.put(
  '/settings',
  authenticateJWT,
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      const { group, config } = req.body as { group: string; config: any };

      if (!group || !config) {
        return res.status(400).json(createResponse(null, 'Group and config are required'));
      }

      // 验证分组是否有效
      const validGroups = ['site', 'storage', 'security', 'notification', 'ui', 'system'];
      if (!validGroups.includes(group)) {
        return res.status(400).json(createResponse(null, 'Invalid configuration group'));
      }

      // 对于系统配置，只允许超级管理员修改
      if (group === 'system' && (req.user as any)?.role !== 'super_admin') {
        return res
          .status(403)
          .json(createResponse(null, 'Only super admin can modify system configuration'));
      }

      // 更新配置
      const success = await setConfig(group as any, config, {
        isRequired: ['site', 'storage', 'security'].includes(group),
        isSystem: group === 'system',
        isInitialized: true,
      });

      if (!success) {
        return res.status(500).json(createResponse(null, 'Failed to update configuration'));
      }

      res.status(200).json(createResponse({ group, config }, 'Configuration updated successfully'));
    } catch (error: any) {
      console.error('Failed to update settings:', error);
      res.status(500).json(createResponse(null, 'Failed to update settings'));
    }
  })
);

// 测试配置连接（初始化前公开，初始化后需管理员）
adminRouter.post(
  '/settings/test',
  optionalJWT,
  asyncHandler(async (req, res) => {
    try {
      // 若系统已初始化，要求管理员权限
      const initialized = await isInitialized();
      if (initialized) {
        const user = (req.user as any) || null;
        if (!user) {
          return res.status(401).json(createResponse(null, 'Authentication required'));
        }
        if (!['admin', 'super_admin'].includes(user.role)) {
          return res.status(403).json(createResponse(null, 'Only admin can test configuration'));
        }
      }

      const { type, config } = req.body as { type: string; config: any };

      if (!type || !config) {
        return res.status(400).json(createResponse(null, 'Type and config are required'));
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
          return res.status(400).json(createResponse(null, 'Invalid test type'));
      }

      res.status(200).json(createResponse(testResult));
    } catch (error: any) {
      console.error('Configuration test failed:', error);
      res.status(500).json(createResponse(null, 'Configuration test failed'));
    }
  })
);

// 重新生成安全密钥（超级管理员）
adminRouter.post(
  '/settings/regenerate-keys',
  authenticateJWT,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    try {
      const success = await generateSecurityKeys();

      if (!success) {
        return res.status(500).json(createResponse(null, 'Failed to regenerate security keys'));
      }

      // 获取新生成的密钥
      const securityConfig = await getConfig('security');
      const notificationConfig = await getConfig('notification');

      res.status(200).json(
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
        )
      );
    } catch (error: any) {
      console.error('Failed to regenerate security keys:', error);
      res.status(500).json(createResponse(null, 'Failed to regenerate security keys'));
    }
  })
);

// 自动检测当前 URL（管理员）
adminRouter.get(
  '/settings/detect-urls',
  authenticateJWT,
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      // 动态检测当前 API URL
      const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
      const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
      const detectedApiUrl = `${protocol}://${host}`;

      // 获取当前站点配置
      const currentSiteConfig = (await getConfig('site')) as any;
      const currentFrontendUrl =
        currentSiteConfig?.frontendUrl || currentSiteConfig?.url || 'http://localhost:3001';

      res.status(200).json(
        createResponse({
          detected: {
            apiUrl: detectedApiUrl,
            frontendUrl: currentFrontendUrl,
          },
          current: {
            apiUrl: currentSiteConfig?.apiUrl || '',
            frontendUrl: currentSiteConfig?.frontendUrl || '',
          },
        })
      );
    } catch (error: any) {
      console.error('Failed to detect URLs:', error);
      res.status(500).json(createResponse(null, 'Failed to detect URLs'));
    }
  })
);

// 更新 URL 配置（管理员）
adminRouter.post(
  '/settings/update-urls',
  authenticateJWT,
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      const { apiUrl, frontendUrl } = req.body as { apiUrl?: string; frontendUrl?: string };

      // 获取当前站点配置
      const currentSiteConfig = (await getConfig('site')) as any;
      if (!currentSiteConfig) {
        return res.status(404).json(createResponse(null, 'Site configuration not found'));
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
        return res.status(500).json(createResponse(null, 'Failed to update URL configuration'));
      }

      res.status(200).json(
        createResponse(
          {
            message: 'URL configuration updated successfully',
            urls: {
              apiUrl: updatedConfig.apiUrl,
              frontendUrl: updatedConfig.frontendUrl,
            },
          },
          'URL configuration updated successfully'
        )
      );
    } catch (error: any) {
      console.error('Failed to update URL configuration:', error);
      res.status(500).json(createResponse(null, 'Failed to update URL configuration'));
    }
  })
);

// 刷新配置缓存（测试专用）
adminRouter.post(
  '/refresh-cache',
  authenticateJWT,
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      await refreshConfigCache();
      res.status(200).json(createResponse(null, 'Configuration cache refreshed successfully'));
    } catch (error: any) {
      console.error('Failed to refresh configuration cache:', error);
      res.status(500).json(createResponse(null, 'Failed to refresh configuration cache'));
    }
  })
);

// 获取所有用户列表（管理员）
adminRouter.get(
  '/users',
  authenticateJWT,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, role, search } = req.query as any;
    const { users, total } = await listUsers({ page, limit, role, search });

    res.status(200).json(
      createResponse({
        users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      })
    );
  })
);

// 更新用户角色（超级管理员）
adminRouter.put(
  '/users/:userId/role',
  authenticateJWT,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body as { role: UserRole };

    if (!Object.values(UserRole).includes(role)) {
      throw new Error('Invalid role');
    }

    const user = await updateUserRole(userId, role);

    res.status(200).json(createResponse(user, 'User role updated successfully'));
  })
);

// 获取用户详细信息（管理员）
adminRouter.get(
  '/users/:userId',
  authenticateJWT,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const user = await getUserByIdForAdmin(userId);

    if (!user) {
      throw new Error('User not found');
    }

    res.status(200).json(createResponse(user));
  })
);

// 删除用户（超级管理员）
adminRouter.delete(
  '/users/:userId',
  authenticateJWT,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    await deleteUserById(userId);

    res.status(200).json(createResponse(null, 'User deleted successfully'));
  })
);

// 获取角色统计信息（管理员）
adminRouter.get(
  '/roles/stats',
  authenticateJWT,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const stats = await getRoleStats();
    res.status(200).json(createResponse(stats));
  })
);

export default adminRouter;
