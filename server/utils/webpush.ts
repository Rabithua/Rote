// Web Push notification service for PWA
import webpush from 'web-push';
import { NotificationConfig } from '../types/config';
import { getGlobalConfig } from './config';

// 确保 VAPID 配置已设置（每次调用时重新配置）
function ensureVapidConfigured() {
  const config = getGlobalConfig<NotificationConfig>('notification');
  if (config && config.vapidPublicKey && config.vapidPrivateKey) {
    webpush.setVapidDetails(
      'mailto:rabit.hua@gmail.com',
      config.vapidPublicKey,
      config.vapidPrivateKey
    );
    return true;
  }
  return false;
}

// 获取配置好的 webpush 实例（每次调用时动态配置）
function getWebPushInstance() {
  if (!ensureVapidConfigured()) {
    return null;
  }
  return webpush;
}

// 创建一个包装对象，每次访问方法时都重新配置
const webpushWrapper = new Proxy({} as any, {
  get(_target, prop: string | symbol) {
    const instance = getWebPushInstance();
    if (!instance) {
      return null;
    }
    const value = (instance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

// 导出包装对象，每次使用时都会重新配置 VAPID
export default webpushWrapper;
