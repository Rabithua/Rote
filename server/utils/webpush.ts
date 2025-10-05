// Web Push notification service for PWA
import webpush from 'web-push';
import { NotificationConfig } from '../types/config';
import { getGlobalConfig } from './config';

// 动态获取 VAPID 配置并初始化 webpush
function getWebPushInstance() {
  const config = getGlobalConfig<NotificationConfig>('notification');
  if (config && config.vapidPublicKey && config.vapidPrivateKey) {
    webpush.setVapidDetails(
      'mailto:rabit.hua@gmail.com',
      config.vapidPublicKey,
      config.vapidPrivateKey
    );
    return webpush;
  }
  return null;
}

// 导出动态获取的 webpush 实例
export default getWebPushInstance();
