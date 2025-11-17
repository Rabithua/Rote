import { NotificationConfig, SecurityConfig, StorageConfig } from '../types/config';
import { HonoContext } from '../types/hono';
import { getGlobalConfig } from '../utils/config';
import { createResponse } from '../utils/main';

/**
 * 检查存储配置是否可用
 */
export async function requireStorageConfig(c: HonoContext, next: () => Promise<void>) {
  const storageConfig = getGlobalConfig<StorageConfig>('storage');

  if (
    !storageConfig ||
    !storageConfig.endpoint ||
    !storageConfig.accessKeyId ||
    !storageConfig.secretAccessKey ||
    !storageConfig.bucket
  ) {
    return c.json(
      createResponse(
        null,
        'Storage service is not configured. Please complete the storage configuration first.'
      ),
      503
    );
  }

  await next();
}

/**
 * 检查安全配置是否可用
 */
export async function requireSecurityConfig(c: HonoContext, next: () => Promise<void>) {
  const securityConfig = getGlobalConfig<SecurityConfig>('security');

  if (!securityConfig || !securityConfig.jwtSecret || !securityConfig.jwtRefreshSecret) {
    return c.json(
      createResponse(
        null,
        'Security service is not configured. Please complete the security configuration first.'
      ),
      503
    );
  }

  await next();
}

/**
 * 检查通知配置是否可用
 */
export async function requireNotificationConfig(c: HonoContext, next: () => Promise<void>) {
  const notificationConfig = getGlobalConfig<NotificationConfig>('notification');

  if (
    !notificationConfig ||
    !notificationConfig.vapidPublicKey ||
    !notificationConfig.vapidPrivateKey
  ) {
    return c.json(
      createResponse(
        null,
        'Notification service is not configured. Please complete the notification configuration first.'
      ),
      503
    );
  }

  await next();
}

/**
 * 组合中间件：检查多个配置
 */
export function requireConfigs(...configTypes: ('storage' | 'security' | 'notification')[]) {
  return async (c: HonoContext, next: () => Promise<void>) => {
    const errors: string[] = [];

    if (configTypes.includes('storage')) {
      const storageConfig = getGlobalConfig<StorageConfig>('storage');
      if (
        !storageConfig ||
        !storageConfig.endpoint ||
        !storageConfig.accessKeyId ||
        !storageConfig.secretAccessKey ||
        !storageConfig.bucket
      ) {
        errors.push('Storage service is not configured');
      }
    }

    if (configTypes.includes('security')) {
      const securityConfig = getGlobalConfig<SecurityConfig>('security');
      if (!securityConfig || !securityConfig.jwtSecret || !securityConfig.jwtRefreshSecret) {
        errors.push('Security service is not configured');
      }
    }

    if (configTypes.includes('notification')) {
      const notificationConfig = getGlobalConfig<NotificationConfig>('notification');
      if (
        !notificationConfig ||
        !notificationConfig.vapidPublicKey ||
        !notificationConfig.vapidPrivateKey
      ) {
        errors.push('Notification service is not configured');
      }
    }

    if (errors.length > 0) {
      return c.json(
        createResponse(
          null,
          `Required services are not configured: ${errors.join(', ')}. Please complete the configuration first.`
        ),
        503
      );
    }

    await next();
  };
}
