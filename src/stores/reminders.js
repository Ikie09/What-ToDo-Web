import { defineStore } from 'pinia'
import { useTodosStore } from './todos'
import { useMeetingsStore } from './meetings'
import { useAuthStore } from './auth'
import { dueDateToInput, localToday } from '../utils/dates'

const ENABLED_KEY = 'reminders_enabled'
const LEAD_KEY = 'reminders_lead_minutes'
const NOTIFIED_KEY = 'reminders_notified'
const CHECK_EVERY_MS = 30_000

const supported = typeof window !== 'undefined' && 'Notification' in window

function loadNotified() {
    try {
        return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]')
    } catch {
        return []
    }
}

let timer = null

export const useRemindersStore = defineStore('reminders', {
    state: () => ({
        supported,
        enabled: localStorage.getItem(ENABLED_KEY) === 'true',
        leadMinutes: parseInt(localStorage.getItem(LEAD_KEY) || '10', 10),
        permission: supported ? Notification.permission : 'denied'
    }),

    getters: {
        active: (state) => state.supported && state.enabled && state.permission === 'granted'
    },

    actions: {
        async enable() {
            if (!this.supported) return false
            if (Notification.permission === 'default') {
                this.permission = await Notification.requestPermission()
            } else {
                this.permission = Notification.permission
            }
            this.enabled = this.permission === 'granted'
            localStorage.setItem(ENABLED_KEY, String(this.enabled))
            if (this.enabled) this.check()
            return this.enabled
        },

        disable() {
            this.enabled = false
            localStorage.setItem(ENABLED_KEY, 'false')
        },

        setLeadMinutes(minutes) {
            this.leadMinutes = minutes
            localStorage.setItem(LEAD_KEY, String(minutes))
        },

        // Timers only run while the app (or installed PWA) is open — closed-app delivery needs Web Push.
        start() {
            if (timer) return
            this.check()
            timer = setInterval(() => this.check(), CHECK_EVERY_MS)
        },

        stop() {
            clearInterval(timer)
            timer = null
        },

        async check() {
            if (!this.supported) return
            this.permission = Notification.permission
            if (!this.active || !useAuthStore().isAuthenticated) return

            const notified = new Set(loadNotified())
            const fresh = []
            const remember = (key) => { notified.add(key); fresh.push(key) }

            const today = localToday()
            for (const todo of useTodosStore().items) {
                if (todo.status === 'Done' || !todo.dueDate || todo.id < 0) continue
                const due = dueDateToInput(todo.dueDate)
                const key = `todo:${todo.id}:${due}`
                if (due <= today && !notified.has(key)) {
                    remember(key)
                    await this.show(
                        due < today ? 'Overdue task' : 'Due today',
                        todo.title,
                        key
                    )
                }
            }

            const now = Date.now()
            const lead = this.leadMinutes * 60_000
            for (const meeting of useMeetingsStore().items) {
                if (meeting.id < 0) continue
                const start = new Date(meeting.startsAt).getTime()
                const key = `meeting:${meeting.id}:${meeting.startsAt}`
                if (start > now && start - now <= lead && !notified.has(key)) {
                    remember(key)
                    const mins = Math.max(1, Math.round((start - now) / 60_000))
                    await this.show(
                        `Meeting in ${mins} min`,
                        meeting.location ? `${meeting.title} · ${meeting.location}` : meeting.title,
                        key
                    )
                }
            }

            if (fresh.length > 0) {
                localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified].slice(-300)))
            }
        },

        async show(title, body, tag) {
            const options = { body, tag, icon: '/favicon.svg', badge: '/favicon.svg' }
            try {
                // Prefer the service worker so notifications work from an installed PWA.
                const registration = await navigator.serviceWorker?.getRegistration()
                if (registration) {
                    await registration.showNotification(title, options)
                    return
                }
            } catch { /* fall through to the page-level API */ }
            new Notification(title, options)
        },

        async sendTest() {
            if (!this.active) return false
            await this.show('Reminders are on', 'You will be notified about due tasks and upcoming meetings.', 'test')
            return true
        }
    }
})
