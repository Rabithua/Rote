/* eslint-disable */
// 自定义 Service Worker（injectManifest）

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
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';

clientsClaim();

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

const VAPID =
  (import.meta && import.meta.env && import.meta.env.VITE_VAPID_PUBLIC) ||
  'BDYfGAEoJIRguFfy8ZX4Gw1YdFgbTv-C8TKGpJ-CXJX-fPUFWVjAmPKwwWikLAmvYDh5ht1Mi8ac_qFFrc8Oz4g';

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
        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID),
        });
        const allClients = await self.clients.matchAll({ includeUncontrolled: true });
        for (const client of allClients) {
          client.postMessage({ method: 'pushsubscriptionchange', payload: JSON.stringify(newSub) });
        }
      } catch (err) {}
    })()
  );
});

self.addEventListener('message', async (event) => {
  const { method } = event.data || {};
  switch (method) {
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
      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID),
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
