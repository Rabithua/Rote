// =======================================

// Public Key:
// BKcP-BjX4_BSiMW5bBDpjbRKwBjeKcbCRGf_joXYdPG3CkNZ20KHXYBAdfkx9qiVYh4QQDoEQjQ_Q6o9kiMRwn8

// =======================================

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

const saveSubscription = async (subscription) => {
    let data = {
        userId: "65f2f28eaa85f74b004888a8",
        subScription: subscription
    }
    const response = await fetch('https://altas.rote.ink/v1/api/addSwSubScription', {
        method: 'post',
        headers: { 'Content-type': "application/json" },
        body: JSON.stringify(data)
    })
    // console.log(subscription, response)
}

self.addEventListener("activate", async (e) => {

    const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array("BKcP-BjX4_BSiMW5bBDpjbRKwBjeKcbCRGf_joXYdPG3CkNZ20KHXYBAdfkx9qiVYh4QQDoEQjQ_Q6o9kiMRwn8")
    })

    const response = await saveSubscription(subscription)
    // console.log(response)
})

self.addEventListener("push", e => {
    try {
        let notice = JSON.parse(e.data.text())
        let notification = {
            body: notice.body || '未设置body',
            icon: notice.icon || 'https://rote-r2.zzfw.cc/others/logo.png',
            timestamp: Date.now(),
            tag: notice.tag || 'default',
            badge: 'https://rote-r2.zzfw.cc/others/logo.png',
            image: notice.image && notice.image,
            vibrate: [300],
            data: notice.data && notice.data
        }
        self.registration.showNotification(
            notice.title ? notice.title : "Rote笔记",
            notification
        )

    } catch (error) {
        let notification = {
            body: '未设置body',
            icon: 'https://rote-r2.zzfw.cc/others/logo.png',
            timestamp: Date.now(),
            tag: 'default',
            badge: 'https://rote-r2.zzfw.cc/others/logo.png',
            image: '',
            vibrate: [300],
            data: ''
        }
        self.registration.showNotification("Rote笔记",
            notification
        )
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