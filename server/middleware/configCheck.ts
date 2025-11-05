import { NextFunction, Request, Response } from 'express';
import { NotificationConfig, SecurityConfig, StorageConfig } from '../types/config';
import { getGlobalConfig } from '../utils/config';
import { createResponse } from '../utils/main';

/**
 * 检查存储配置是否可用
 */
export function requireStorageConfig(req: Request, res: Response, next: NextFunction) {
  const storageConfig = getGlobalConfig<StorageConfig>('storage');

  if (
    !storageConfig ||
    !storageConfig.endpoint ||
    !storageConfig.accessKeyId ||
    !storageConfig.secretAccessKey ||
    !storageConfig.bucket
  ) {
    return res
      .status(503)
      .json(
        createResponse(
          null,
          'Storage service is not configured. Please complete the storage configuration first.'
        )
      );
  }

  next();
}

/**
 * 检查安全配置是否可用
 */
export function requireSecurityConfig(req: Request, res: Response, next: NextFunction) {
  const securityConfig = getGlobalConfig<SecurityConfig>('security');

  if (!securityConfig || !securityConfig.jwtSecret || !securityConfig.jwtRefreshSecret) {
    return res
      .status(503)
      .json(
        createResponse(
          null,
          'Security service is not configured. Please complete the security configuration first.'
        )
      );
  }

  next();
}

/**
 * 检查通知配置是否可用
 */
export function requireNotificationConfig(req: Request, res: Response, next: NextFunction) {
  const notificationConfig = getGlobalConfig<NotificationConfig>('notification');

  if (
    !notificationConfig ||
    !notificationConfig.vapidPublicKey ||
    !notificationConfig.vapidPrivateKey
  ) {
    return res
      .status(503)
      .json(
        createResponse(
          null,
          'Notification service is not configured. Please complete the notification configuration first.'
        )
      );
  }

  next();
}

/**
 * 组合中间件：检查多个配置
 */
export function requireConfigs(...configTypes: ('storage' | 'security' | 'notification')[]) {
  return (req: Request, res: Response, next: NextFunction) => {
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
      return res
        .status(503)
        .json(
          createResponse(
            null,
            `Required services are not configured: ${errors.join(', ')}. Please complete the configuration first.`
          )
        );
    }

    next();
  };
}
