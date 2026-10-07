import { defineStore } from 'pinia'
import api from '../services/api'

const LAST_SYNC_KEY = 'sync_last_time'
const QUEUE_KEY = 'sync_queue'
const TEMP_ID_KEY = 'sync_temp_id_counter'

// Queue entry kinds map to the arrays accepted by POST /sync/push.
const KIND_TO_FIELD = { todo: 'todos', note: 'notes', meeting: 'meetings', transaction: 'transactions', budget: 'budgets' }

function loadQueue() {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
}

function saveQueue(queue) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

// Negative placeholder id for records created while offline. The backend ignores it (falls into
// the "not found, so create" branch) and assigns a real id once the queue is pushed. Kept within
// Int32 range and decrementing so ids stay unique for the life of the queue.
export function tempId() {
    const next = parseInt(localStorage.getItem(TEMP_ID_KEY) || '0', 10) - 1
    localStorage.setItem(TEMP_ID_KEY, String(next))
    return next
}

export const useSyncStore = defineStore('sync', {
    state: () => ({
        queue: loadQueue(),
        lastSyncTime: localStorage.getItem(LAST_SYNC_KEY) || null,
        isOnline: navigator.onLine,
        syncing: false
    }),

    getters: {
        pendingCount: (state) => state.queue.length
    },

    actions: {
        // Registers online/offline listeners. `onReconciled` runs after a successful push so stores
        // can refetch canonical data (which also swaps temp ids for the real ones).
        init(onReconciled) {
            const run = () => this.flush().then((ok) => { if (ok && onReconciled) onReconciled() })

            window.addEventListener('online', () => {
                this.isOnline = true
                run()
            })
            window.addEventListener('offline', () => {
                this.isOnline = false
            })

            // The app may be opened while online with edits still queued from an earlier offline session.
            if (navigator.onLine && this.queue.length > 0) run()
        },

        // Keep only the latest change per record: pushing two entries for the same temp id
        // would create two rows on the server.
        enqueue(kind, dto) {
            const idx = this.queue.findIndex(q => q.kind === kind && q.dto.id === dto.id)
            const entry = { kind, dto, queuedAt: new Date().toISOString() }
            if (idx !== -1) this.queue[idx] = entry
            else this.queue.push(entry)
            saveQueue(this.queue)
        },

        // Drop a queued change, e.g. when a record that only ever existed offline is deleted.
        dequeue(kind, id) {
            this.queue = this.queue.filter(q => !(q.kind === kind && q.dto.id === id))
            saveQueue(this.queue)
        },

        // Push queued offline mutations (last-write-wins, per /api/sync/push).
        // Returns true once the queue is confirmed applied server-side.
        async flush() {
            if (!navigator.onLine || this.queue.length === 0) return this.queue.length === 0

            this.syncing = true
            try {
                const body = { todos: [], notes: [], meetings: [], transactions: [], budgets: [] }
                for (const q of this.queue) body[KIND_TO_FIELD[q.kind]].push(q.dto)

                const { data } = await api.post('/sync/push', body)

                this.queue = []
                saveQueue(this.queue)
                this.lastSyncTime = data.serverTime
                localStorage.setItem(LAST_SYNC_KEY, data.serverTime)
                return true
            } catch {
                // Stay offline-safe: leave the queue intact, try again on the next reconnect.
                return false
            } finally {
                this.syncing = false
            }
        }
    }
})
