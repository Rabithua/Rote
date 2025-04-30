// =======================================

// 如果使用webpush需要保持客户端和服务端VAPID统一

// =======================================


const VAPID = "BDYfGAEoJIRguFfy8ZX4Gw1YdFgbTv-C8TKGpJ-CXJX-fPUFWVjAmPKwwWikLAmvYDh5ht1Mi8ac_qFFrc8Oz4g"

/* eslint-disable no-restricted-globals */
const urlBase64ToUint8Array = base64String => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}


self.addEventListener('message', async event => {
    const { method } = event.data;

    console.log("收到消息", event.data);

    switch (method) {
        case "subNotice":
            const subscription = await self.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID)
            })

            console.log("订阅成功", subscription);

            // 兼容 event.source 可能为 undefined 的情况
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

        default:
            break;
    }
});

// 参考： https://developer.mozilla.org/zh-CN/docs/Web/API/ServiceWorkerRegistration/showNotification
self.addEventListener("push", e => {
    try {
        console.log("收到推送消息", e.data.text())

        let notice
        try {
            notice = JSON.parse(e.data.text())
        } catch (error) {
            console.info('Error parsing notification data:', error);
            notice = {
                title: 'Rote Notification',
                body: e.data.text(),
                tag: 'default',
            }
        }

        let notification = {
            body: notice.body || '未设置消息内容',
            icon: notice.icon || undefined,
            timestamp: Date.now(),
            tag: notice.tag || 'default',
            badge: undefined,
            image: notice.image || undefined,
            vibrate: [300],
            data: notice.data || undefined,
            silent: false,
            requireInteraction: false,
            actions: [
                {
                    action: 'open',
                    title: '打开',
                },
                {
                    action: 'close',
                    title: '关闭',
                },
            ],
        }
        console.log("准备显示通知:", notice.title, notification);
        self.registration.showNotification(
            notice.title ? notice.title : "Rote Notification",
            notification,
        );
        console.log("通知已显示");
    } catch (error) {
        console.log(error)
    }
})

self.addEventListener('notificationclick', function (event) {
    try {
        const notification = event.notification;
        const data = notification.data;

        // 总是关闭通知
        notification.close();

        if (!data) {
            console.warn('Notification clicked but no data provided');
            return;
        }

        event.waitUntil(
            (async () => {

                const windowClients = await clients.matchAll({
                    type: 'window',
                    includeUncontrolled: true
                });

                switch (data.type) {
                    case 'openUrl':
                        try {
                            let targetUrl;
                            try {
                                targetUrl = new URL(data.url);
                            } catch (e) {
                                console.error('Invalid URL in notification data:', url);
                                return;
                            }

                            // 查找匹配的客户端
                            const existingClient = windowClients.find(client => {
                                try {
                                    const clientUrl = new URL(client.url);
                                    return clientUrl.host === targetUrl.host &&
                                        clientUrl.pathname === targetUrl.pathname;
                                } catch {
                                    return false;
                                }
                            });

                            if (existingClient && 'focus' in existingClient) {
                                await existingClient.focus();
                            } else {
                                if (windowClients.length > 0) {
                                    existingClient.navigate(data.url);
                                } else {
                                    await clients.openWindow(data.url);
                                }
                            }
                        } catch (error) {
                            console.error('Error handling notification click:', error);
                        }
                        return

                    default:
                        break;
                }


            })()
        );
    } catch (error) {
        console.error('Error in notificationclick handler:', error);
    }
});