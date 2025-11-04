/* eslint-disable */
// 自定义 Service Worker（injectManifest）

self.__WB_DISABLE_DEV_LOGS = true;

self.skipWaiting();
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      if ('navigationPreload' in self.registration) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {}
      }
    })()
  );
});

// 运行时缓存策略（Workbox 在构建时注入 precache 清单）
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';

clientsClaim();

// 预缓存由 VitePWA 注入的资源清单
// 注意：必须存在对 self.__WB_MANIFEST 的引用，injectManifest 构建才会注入
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// r2 静态资源
registerRoute(
  ({ url }) => url.hostname === 'r2.rote.ink',
  new CacheFirst({ cacheName: 'r2-assets' })
);

// API GET 缓存
registerRoute(
  ({ request, url }) => request.method === 'GET' && url.pathname.startsWith('/api/v2/'),
  new StaleWhileRevalidate({ cacheName: 'api-cache' })
);

// 导航回退到 index.html（由 Workbox 预缓存）
const handler = async () => fetch('/index.html');
const navigationRoute = new NavigationRoute(handler, {
  denylist: [/^\/api\//, /\/sw\.js$/],
});
registerRoute(navigationRoute);

// ========== Push & Notification（迁移自原 sw.js） ==========

// 存储 API URL 配置（可以从主线程接收）
let apiUrlConfig = null;

// 获取 API URL（前后端分离项目，必须配置）
function getApiUrl() {
  if (!apiUrlConfig) {
    throw new Error('API URL not configured. Please wait for Service Worker initialization.');
  }
  return apiUrlConfig;
}

// 初始化时从缓存读取 API URL
async function initializeApiUrl() {
  if (apiUrlConfig) {
    return; // 已经设置过，不需要重新读取
  }
  try {
    const cache = await caches.open('api-config-cache');
    const cached = await cache.match('/api-url');
    if (cached) {
      const cachedUrl = await cached.text();
      if (cachedUrl) {
        apiUrlConfig = cachedUrl;
      }
    }
  } catch (err) {
    // 忽略错误，API URL 需要从主线程接收
  }
}

// 动态获取 VAPID public key
async function getVapidPublicKey() {
  try {
    // 如果 API URL 还没初始化，尝试从缓存读取
    if (!apiUrlConfig) {
      await initializeApiUrl();
    }

    // 如果仍然没有 API URL，抛出错误
    if (!apiUrlConfig) {
      throw new Error(
        'API URL not configured. Please ensure Service Worker is properly initialized.'
      );
    }

    // 尝试从缓存获取 VAPID key
    const cache = await caches.open('vapid-cache');
    const cached = await cache.match('/vapid-key');
    if (cached) {
      const cachedData = await cached.json();
      // 缓存 5 分钟，如果没过期则使用缓存
      if (cachedData.timestamp && Date.now() - cachedData.timestamp < 5 * 60 * 1000) {
        return cachedData.key;
      }
    }

    // 从后端 API 获取最新的 VAPID key
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/site/status`);
    if (!response.ok) {
      throw new Error('Failed to fetch site status');
    }
    const data = await response.json();
    const vapidKey = data?.data?.notification?.vapidPublicKey;

    if (!vapidKey) {
      // 如果没有获取到，使用环境变量或默认值作为后备
      return (
        (import.meta && import.meta.env && import.meta.env.VITE_VAPID_PUBLIC) ||
        'BDYfGAEoJIRguFfy8ZX4Gw1YdFgbTv-C8TKGpJ-CXJX-fPUFWVjAmPKwwWikLAmvYDh5ht1Mi8ac_qFFrc8Oz4g'
      );
    }

    // 缓存获取到的 key
    const cacheData = {
      key: vapidKey,
      timestamp: Date.now(),
    };
    await cache.put('/vapid-key', new Response(JSON.stringify(cacheData)));

    return vapidKey;
  } catch (error) {
    console.error('Failed to get VAPID key:', error);
    // 如果获取失败，使用环境变量或默认值作为后备
    return (
      (import.meta && import.meta.env && import.meta.env.VITE_VAPID_PUBLIC) ||
      'BDYfGAEoJIRguFfy8ZX4Gw1YdFgbTv-C8TKGpJ-CXJX-fPUFWVjAmPKwwWikLAmvYDh5ht1Mi8ac_qFFrc8Oz4g'
    );
  }
}

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
};

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // 动态获取最新的 VAPID key
        const vapidKey = await getVapidPublicKey();
        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
        const allClients = await self.clients.matchAll({ includeUncontrolled: true });
        for (const client of allClients) {
          client.postMessage({ method: 'pushsubscriptionchange', payload: JSON.stringify(newSub) });
        }
      } catch (err) {
        console.error('Push subscription change error:', err);
      }
    })()
  );
});

self.addEventListener('message', async (event) => {
  const { method, apiUrl } = event.data || {};
  switch (method) {
    case 'setApiUrl': {
      // 从主线程接收 API URL 配置
      if (apiUrl) {
        apiUrlConfig = apiUrl;
        // 保存到缓存，以便后续使用
        try {
          const cache = await caches.open('api-config-cache');
          await cache.put('/api-url', new Response(apiUrl));
        } catch (err) {
          console.error('Failed to cache API URL:', err);
        }
      }
      break;
    }
    case 'subNotice': {
      // 为避免 applicationServerKey 变更导致 InvalidStateError，先取消旧订阅再重订阅
      try {
        const existing = await self.registration.pushManager.getSubscription();
        if (existing) {
          try {
            await existing.unsubscribe();
          } catch {}
        }
      } catch {}

      try {
        // 动态获取最新的 VAPID key
        const vapidKey = await getVapidPublicKey();
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
        if (event.source) {
          event.source.postMessage({
            method: 'subNoticeResponse',
            payload: JSON.stringify(subscription),
          });
        } else if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            method: 'subNoticeResponse',
            payload: JSON.stringify(subscription),
          });
        }
      } catch (err) {
        console.error('Subscription error:', err);
        // 如果订阅失败，通知客户端
        if (event.source) {
          event.source.postMessage({
            method: 'subNoticeResponse',
            error: 'Failed to subscribe: ' + (err.message || String(err)),
          });
        } else if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            method: 'subNoticeResponse',
            error: 'Failed to subscribe: ' + (err.message || String(err)),
          });
        }
      }
      break;
    }
    default:
      break;
  }
});

self.addEventListener('push', (e) => {
  try {
    // 保持与旧版 sw 一致的日志，便于排查
    try {
      if (e && e.data) {
        // 可能是加密负载，打印原始文本

        console.log('收到推送消息', e.data.text());
      } else {
        console.log('收到推送消息，但无数据');
      }
    } catch {}
    let notice;
    try {
      notice = e.data ? JSON.parse(e.data.text()) : {};
    } catch (error) {
      console.info('Error parsing notification data:', error);
      notice = { title: 'Rote Notification', body: e.data ? e.data.text() : '', tag: 'default' };
    }

    const notification = {
      body: notice.body || '未设置消息内容',
      icon: notice.icon || undefined,
      // 与旧 sw 保持一致，增加时间戳字段（部分平台用于排序/展示）
      timestamp: Date.now(),
      tag: notice.tag || 'default',
      badge: undefined,
      image: notice.image || undefined,
      vibrate: [300],
      data: notice.data || undefined,
      silent: false,
      requireInteraction: false,
      actions: [
        { action: 'open', title: '打开' },
        { action: 'close', title: '关闭' },
      ],
    };
    // 保持与旧版一致的日志

    console.log('准备显示通知:', notice.title, notification);
    self.registration.showNotification(
      notice.title ? notice.title : 'Rote Notification',
      notification
    );

    console.log('通知已显示');
  } catch (error) {}
});

self.addEventListener('notificationclick', function (event) {
  try {
    const notification = event.notification;
    const data = notification.data;
    notification.close();
    if (!data) return;
    event.waitUntil(
      (async () => {
        const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        switch (data.type) {
          case 'openUrl':
            try {
              let targetUrl;
              try {
                targetUrl = new URL(data.url);
              } catch {
                return;
              }
              const existingClient = windowClients.find((client) => {
                try {
                  const clientUrl = new URL(client.url);
                  return (
                    clientUrl.host === targetUrl.host && clientUrl.pathname === targetUrl.pathname
                  );
                } catch {
                  return false;
                }
              });
              if (existingClient && 'focus' in existingClient) {
                await existingClient.focus();
              } else {
                if (windowClients.length > 0) {
                  existingClient && existingClient.navigate && existingClient.navigate(data.url);
                } else {
                  await clients.openWindow(data.url);
                }
              }
            } catch (error) {}
            return;
          default:
            break;
        }
      })()
    );
  } catch (error) {}
});
