// Web Push notification service for PWA
import webpush from 'web-push';
import { getGlobalConfig, subscribeConfigChange } from './config';
import { NotificationConfig } from '../types/config';

// 配置管理
let apiKeys = {
  publicKey: '',
  privateKey: '',
};

// 初始化 WebPush 配置
function initializeWebPushConfig() {
  const config = getGlobalConfig<NotificationConfig>('notification');
  if (config && config.vapidPublicKey && config.vapidPrivateKey) {
    apiKeys = {
      publicKey: config.vapidPublicKey,
      privateKey: config.vapidPrivateKey,
    };
    webpush.setVapidDetails('mailto:rabit.hua@gmail.com', apiKeys.publicKey, apiKeys.privateKey);
  } else {
    console.info('VAPID keys are not provided');
  }
}

// 订阅配置变更
subscribeConfigChange('notification', (group, newConfig: NotificationConfig) => {
  console.log('WebPush configuration updated');
  if (newConfig.vapidPublicKey && newConfig.vapidPrivateKey) {
    apiKeys = {
      publicKey: newConfig.vapidPublicKey,
      privateKey: newConfig.vapidPrivateKey,
    };
    webpush.setVapidDetails('mailto:rabit.hua@gmail.com', apiKeys.publicKey, apiKeys.privateKey);
  }
});

// 初始化配置
initializeWebPushConfig();

export default apiKeys.publicKey && apiKeys.privateKey ? webpush : null;
