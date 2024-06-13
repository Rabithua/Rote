// =======================================

// 如果使用webpush需要保持客户端和服务端VAPID统一

// =======================================
require("dotenv").config();

const VAPID = process.env.VAPID_PUBLIC_KEY

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

    switch (method) {
        case "subNotice":
            const subscription = await self.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID)
            })

            event.source.postMessage({
                method: 'subNoticeResponse',
                payload: JSON.stringify(subscription),
            });

            break;

        default:
            break;
    }
});

self.addEventListener("push", e => {
    try {
        let notice = JSON.parse(e.data.text())
        let notification = {
            body: notice.body || '未设置消息内容',
            icon: notice.icon || undefined,
            timestamp: Date.now(),
            tag: notice.tag || 'default',
            badge: undefined,
            image: notice.image || undefined,
            vibrate: [300],
            data: notice.data || undefined
        }
        self.registration.showNotification(
            notice.title ? notice.title : "Rote笔记",
            notification
        )
    } catch (error) {
        console.log(error)
    }
})

self.addEventListener('notificationclick', function (event) {
    let url = event.notification.data.url;
    event.notification.close(); // Android needs explicit close.

    event.waitUntil(
        self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(windowClients => {
            // Check if there is already a window/tab open with the target URL
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                // If so, just focus it.
                if (client.url === url && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, then open the target URL in a new window/tab.
            if (self.clients.openWindow) {
                return self.clients.openWindow(url);
            }
        })
    );
});