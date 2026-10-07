import { defineStore } from 'pinia'
import api from '../services/api'
import { useRemindersStore } from './reminders'
import { urlBase64ToUint8Array, bufferToBase64Url, isIos, isStandalone } from '../utils/push'

const canPush = () =>
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// Service workers are only registered by the production build, and `ready` would wait forever without one.
async function getRegistration() {
    if (!('serviceWorker' in navigator)) return null
    return (await navigator.serviceWorker.getRegistration()) || null
}

function describe(err) {
    return err?.response?.data?.message || err?.message || 'Something went wrong.'
}

export const usePushStore = defineStore('push', {
    state: () => ({
        supported: canPush(),
        needsHomeScreen: isIos() && !isStandalone(),
        hasServiceWorker: false,
        serverEnabled: false,
        publicKey: null,
        subscribed: false,
        permission: 'Notification' in window ? Notification.permission : 'denied',
        busy: false,
        error: ''
    }),

    getters: {
        // This device receives pushes, so the in-page timer must not notify as well.
        active: (state) => state.subscribed && state.permission === 'granted',
        // Can the user switch push on right now?
        available: (state) => state.supported && state.hasServiceWorker && state.serverEnabled && state.permission !== 'denied'
    },

    actions: {
        async init() {
            this.permission = 'Notification' in window ? Notification.permission : 'denied'
            if (!this.supported) return

            const registration = await getRegistration()
            this.hasServiceWorker = !!registration

            try {
                const { data } = await api.get('/push/public-key')
                this.serverEnabled = !!data.enabled
                this.publicKey = data.publicKey
            } catch {
                this.serverEnabled = false // offline or API down: the toggle just stays unavailable
            }

            if (!registration) return
            const existing = await registration.pushManager.getSubscription()
            this.subscribed = !!existing

            // Quietly refresh the server copy (lead time, time zone, or a server that lost it).
            if (existing && this.serverEnabled && this.permission === 'granted') {
                this._register(existing).catch(() => {})
            }
        },

        async enable() {
            this.error = ''
            this.busy = true
            try {
                if (!this.supported) throw new Error('This browser does not support push notifications.')
                if (!this.serverEnabled) throw new Error('Push notifications are not set up on the server yet.')

                if (Notification.permission === 'default') {
                    this.permission = await Notification.requestPermission()
                } else {
                    this.permission = Notification.permission
                }
                if (this.permission !== 'granted') {
                    throw new Error('Notifications are blocked. Allow them in your browser settings and try again.')
                }

                const registration = await getRegistration()
                if (!registration) throw new Error('Push needs the installed/production build of the app (no service worker is active).')

                let subscription = await registration.pushManager.getSubscription()
                if (!subscription) {
                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(this.publicKey)
                    })
                }

                try {
                    await this._register(subscription)
                } catch (err) {
                    // Keep browser and server in step: no half-enabled state.
                    await subscription.unsubscribe().catch(() => {})
                    throw err
                }

                this.subscribed = true
                return true
            } catch (err) {
                this.error = describe(err)
                this.subscribed = false
                return false
            } finally {
                this.busy = false
            }
        },

        async disable() {
            this.error = ''
            const registration = await getRegistration()
            const subscription = registration ? await registration.pushManager.getSubscription() : null
            if (!subscription) {
                this.subscribed = false
                return
            }

            this.busy = true
            try {
                // Tell the server first (needs the signed-in token), then drop the browser side.
                await api.delete('/push/subscriptions', { data: { endpoint: subscription.endpoint } }).catch(() => {})
                await subscription.unsubscribe()
                this.subscribed = false
            } catch (err) {
                this.error = describe(err)
            } finally {
                this.busy = false
            }
        },

        // Lead time changed in Settings.
        async syncSettings() {
            if (!this.subscribed) return
            const registration = await getRegistration()
            const subscription = registration ? await registration.pushManager.getSubscription() : null
            if (subscription) await this._register(subscription).catch((err) => { this.error = describe(err) })
        },

        async sendTest() {
            this.error = ''
            try {
                const { data } = await api.post('/push/test')
                if (data.removed && !data.sent) this.subscribed = false
                return data
            } catch (err) {
                this.error = describe(err)
                return null
            }
        },

        _register(subscription) {
            const json = subscription.toJSON()
            return api.post('/push/subscriptions', {
                endpoint: subscription.endpoint,
                p256dh: json.keys?.p256dh || bufferToBase64Url(subscription.getKey('p256dh')),
                auth: json.keys?.auth || bufferToBase64Url(subscription.getKey('auth')),
                leadMinutes: useRemindersStore().leadMinutes,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            })
        }
    }
})
