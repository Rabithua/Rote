import { Hono } from 'hono';
import mainJson from '../../json/main.json';
import type {
  InitializationStatus,
  NotificationConfig,
  SecurityConfig,
  SetupRequest,
  SetupResponse,
} from '../../types/config';
import type { HonoContext, HonoVariables } from '../../types/hono';
import {
  initializeSecurityKeys,
  getConfig,
  getMissingRequiredConfigs,
  isInitialized,
  setConfig,
} from '../../utils/config';
import { ConfigTester } from '../../utils/configTester';
import {
  checkDatabaseConnection,
  createAdminUser,
  findUserByUsernameOrEmail,
  getLatestMigrationVersion,
  hasAdminUser,
} from '../../utils/dbMethods';
import { createResponse } from '../../utils/main';
import { buildSetupGeneratedKeysResponse } from '../../utils/setupSecurity';
import {
  getStorageFriendlyError,
  logStorageTestResult,
  logStorageTestStart,
} from './adminStorageUtils';

const adminSetupRouter = new Hono<{ Variables: HonoVariables }>();

adminSetupRouter.get('/status', async (c: HonoContext) => {
  try {
    const initialized = await isInitialized();
    const missingRequiredConfigs = await getMissingRequiredConfigs();
    const databaseConnected = await checkDatabaseConnection();
    const hasAdmin = await hasAdminUser();
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

    const status: InitializationStatus = {
      isInitialized: initialized,
      missingRequiredConfigs,
      warnings,
    };

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
            frontendUrl: (siteConfig as any)?.frontendUrl || 'Not set',
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

adminSetupRouter.post('/setup', async (c: HonoContext) => {
  try {
    const alreadyInitialized = await isInitialized();
    if (alreadyInitialized) {
      return c.json(createResponse(null, 'System has already been initialized'), 400);
    }

    const body = await c.req.json();
    const setupData: SetupRequest = body;

    if (!setupData.site || !setupData.ui || !setupData.admin) {
      return c.json(createResponse(null, 'Missing required configuration data'), 400);
    }

    if (!setupData.site.name || !setupData.site.frontendUrl) {
      return c.json(createResponse(null, 'Site name and frontend URL are required'), 400);
    }

    if (setupData.storage) {
      if (
        !setupData.storage.endpoint ||
        !setupData.storage.bucket ||
        !setupData.storage.accessKeyId ||
        !setupData.storage.secretAccessKey ||
        !setupData.storage.urlPrefix
      ) {
        return c.json(createResponse(null, 'Storage configuration is incomplete'), 400);
      }

      logStorageTestStart('setup', setupData.storage);
      const storageTest = await ConfigTester.testStorage(setupData.storage);
      logStorageTestResult('setup', storageTest);
      if (!storageTest.success) {
        const friendlyMessage = getStorageFriendlyError(storageTest.details, storageTest.message);
        return c.json(
          createResponse(null, `Storage configuration test failed: ${friendlyMessage}`),
          400
        );
      }
    }

    if (
      setupData.ui.allowRegistration === undefined ||
      setupData.ui.allowUploadFile === undefined ||
      !setupData.ui.defaultUserRole ||
      setupData.ui.apiRateLimit === undefined ||
      setupData.ui.maxVideoUploadSizeMB === undefined
    ) {
      return c.json(createResponse(null, 'UI configuration is incomplete'), 400);
    }
    if (typeof setupData.ui.apiRateLimit !== 'number' || setupData.ui.apiRateLimit < 10) {
      return c.json(createResponse(null, 'API rate limit must be a number and at least 10'), 400);
    }
    if (
      typeof setupData.ui.maxVideoUploadSizeMB !== 'number' ||
      setupData.ui.maxVideoUploadSizeMB < 1
    ) {
      return c.json(
        createResponse(null, 'Video upload size limit must be a number and at least 1 MB'),
        400
      );
    }
    if (!['user', 'moderator'].includes(setupData.ui.defaultUserRole)) {
      return c.json(
        createResponse(null, 'Default user role must be either "user" or "moderator"'),
        400
      );
    }

    if (!setupData.admin.username || !setupData.admin.email || !setupData.admin.password) {
      return c.json(createResponse(null, 'Admin user information is incomplete'), 400);
    }

    if (setupData.admin.password.length < 6) {
      return c.json(createResponse(null, 'Password must be at least 6 characters'), 400);
    }
    if (setupData.admin.password.length > 128) {
      return c.json(createResponse(null, 'Password cannot exceed 128 characters'), 400);
    }

    const { safeRoutes } = mainJson;
    if (safeRoutes.includes(setupData.admin.username.toLowerCase())) {
      return c.json(
        createResponse(
          null,
          'This username is reserved and cannot be used. Please choose another username.'
        ),
        400
      );
    }

    const hasExistingAdmin = await hasAdminUser();
    const existingUser = await findUserByUsernameOrEmail({
      username: setupData.admin.username,
      email: setupData.admin.email,
    });

    let adminUser: {
      id: string;
      username: string;
      email: string;
      role: string;
    };
    let reusedExistingAdmin = false;

    if (existingUser) {
      const isExistingAdmin = ['admin', 'super_admin'].includes(existingUser.role);
      const isSameAdminIdentity =
        existingUser.username === setupData.admin.username &&
        existingUser.email === setupData.admin.email;

      if (!isExistingAdmin || !isSameAdminIdentity) {
        return c.json(createResponse(null, 'Username or email already exists'), 400);
      }

      adminUser = existingUser;
      reusedExistingAdmin = true;
    } else if (hasExistingAdmin) {
      return c.json(
        createResponse(
          null,
          'An admin user already exists. Please use the existing admin username and email to finish setup.'
        ),
        400
      );
    } else {
      adminUser = await createAdminUser({
        username: setupData.admin.username,
        email: setupData.admin.email,
        password: setupData.admin.password,
        nickname: setupData.admin.nickname,
      });
    }

    await setConfig(
      'site',
      {
        name: setupData.site.name,
        frontendUrl: setupData.site.frontendUrl,
        description: setupData.site.description || '',
        defaultLanguage: setupData.site.defaultLanguage || 'zh-CN',
      },
      { isRequired: true, isInitialized: true }
    );

    if (setupData.storage) {
      await setConfig('storage', setupData.storage, { isRequired: false, isInitialized: true });
    }

    await setConfig('ui', setupData.ui, { isRequired: false, isInitialized: true });

    const securityKeysGenerated = await initializeSecurityKeys();
    if (!securityKeysGenerated) {
      throw new Error('Failed to generate security keys');
    }

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

    const securityConfig = await getConfig<SecurityConfig>('security');
    const notificationConfig = await getConfig<NotificationConfig>('notification');

    const response: SetupResponse = {
      success: true,
      message: reusedExistingAdmin
        ? 'System initialization completed using the existing admin user. The existing password was not changed.'
        : 'System initialization completed successfully',
      data: {
        adminUser,
        generatedKeys: buildSetupGeneratedKeysResponse(securityConfig, notificationConfig),
      },
    };

    return c.json(createResponse(response.data, response.message), 200);
  } catch (error: any) {
    console.error('System initialization failed:', error);
    return c.json(createResponse(null, `System initialization failed: ${error.message}`), 500);
  }
});

export default adminSetupRouter;
