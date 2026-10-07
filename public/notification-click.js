// Imported into the generated service worker (see workbox.importScripts in vite.config.js).
// Handles push messages from the API (shown even when the app is closed) and clicks on any notification.

self.addEventListener('push', (event) => {
    let data = {}
    try {
        data = event.data ? event.data.json() : {}
    } catch {
        data = { body: event.data ? event.data.text() : '' }
    }

    // Browsers require every push to show a notification (userVisibleOnly), so always show one.
    event.waitUntil(
        self.registration.showNotification(data.title || 'What To Do', {
            body: data.body || '',
            tag: data.tag || undefined,
            icon: '/favicon.svg',
            badge: '/favicon.svg',
            data: { url: data.url || '/' }
        })
    )
})

// Only ever navigate within this app, whatever the payload says.
function targetUrl(notification) {
    try {
        const url = new URL((notification.data && notification.data.url) || '/', self.location.origin)
        return url.origin === self.location.origin ? url.href : self.location.origin + '/'
    } catch {
        return self.location.origin + '/'
    }
}

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const url = targetUrl(event.notification)

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
            for (const client of windows) {
                if ('focus' in client) {
                    await client.focus()
                    if ('navigate' in client && client.url !== url) {
                        try { await client.navigate(url) } catch { /* not controllable; focusing is enough */ }
                    }
                    return
                }
            }
            return self.clients.openWindow(url)
        })
    )
})
