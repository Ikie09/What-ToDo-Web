import { defineStore } from 'pinia'
import api from '../services/api'
import { useSyncStore, tempId } from './sync'
import { isOverdue } from '../utils/dates'

const CACHE_KEY = 'cache_todos'

export const STATUSES = ['Todo', 'InProgress', 'Done']
export const STATUS_LABELS = { Todo: 'To do', InProgress: 'In progress', Done: 'Done' }

// Older cached rows and server rows from before the Kanban upgrade have no status.
function normalize(t) {
    const status = t.status || (t.isCompleted ? 'Done' : 'Todo')
    return { ...t, status, isCompleted: status === 'Done', sortOrder: t.sortOrder ?? 0 }
}

function loadCache() {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]').map(normalize)
}

export const useTodosStore = defineStore('todos', {
    state: () => ({
        items: loadCache(),
        loading: false,
        error: null
    }),

    getters: {
        openCount: (state) => state.items.filter(t => t.status !== 'Done').length,
        completedCount: (state) => state.items.filter(t => t.status === 'Done').length,
        overdueCount: (state) => state.items.filter(isOverdue).length,
        byPriority: (state) => {
            const counts = { Low: 0, Medium: 0, High: 0 }
            for (const t of state.items) {
                if (t.status !== 'Done') counts[t.priority] = (counts[t.priority] || 0) + 1
            }
            return counts
        },
        // Items of one column, in board order.
        column: (state) => (status) =>
            state.items
                .filter(t => t.status === status)
                .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    },

    actions: {
        _cache() {
            localStorage.setItem(CACHE_KEY, JSON.stringify(this.items))
        },

        _upsertLocal(todo) {
            const normalized = normalize(todo)
            const idx = this.items.findIndex(t => t.id === normalized.id)
            if (idx !== -1) this.items[idx] = normalized
            else this.items.unshift(normalized)
            this._cache()
            return normalized
        },

        _nextSortOrder(status) {
            const orders = this.items.filter(t => t.status === status).map(t => t.sortOrder)
            return orders.length ? Math.max(...orders) + 1 : 0
        },

        _toSyncDto(todo) {
            return {
                id: todo.id,
                title: todo.title,
                notes: todo.notes ?? null,
                isCompleted: todo.status === 'Done',
                status: todo.status,
                sortOrder: todo.sortOrder ?? 0,
                priority: todo.priority,
                dueDate: todo.dueDate ?? null,
                categoryId: todo.categoryId ?? null,
                updatedAt: new Date().toISOString(),
                isDeleted: !!todo.isDeleted
            }
        },

        async fetchAll() {
            this.loading = true
            this.error = null
            try {
                const { data } = await api.get('/todos')
                this.items = data.map(normalize)
                this._cache()
            } catch (err) {
                this.error = err.response?.data?.message || 'Could not load todos — showing offline copy.'
            } finally {
                this.loading = false
            }
        },

        async create(payload) {
            const status = payload.status || 'Todo'
            const body = { ...payload, status, sortOrder: this._nextSortOrder(status) }
            if (!navigator.onLine) {
                const local = this._upsertLocal({
                    id: tempId(),
                    createdAt: new Date().toISOString(),
                    ...body
                })
                useSyncStore().enqueue('todo', this._toSyncDto(local))
                return local
            }
            const { data } = await api.post('/todos', body)
            return this._upsertLocal(data)
        },

        async update(id, payload) {
            const existing = this.items.find(t => t.id === id)
            const merged = { ...existing, ...payload }
            const status = merged.status || 'Todo'
            const body = {
                title: merged.title,
                notes: merged.notes ?? null,
                priority: merged.priority,
                dueDate: merged.dueDate ?? null,
                categoryId: merged.categoryId ?? null,
                status,
                isCompleted: status === 'Done',
                sortOrder: merged.sortOrder ?? 0
            }
            if (!navigator.onLine || id < 0) {
                const local = this._upsertLocal({ ...merged, status })
                useSyncStore().enqueue('todo', this._toSyncDto(local))
                return local
            }
            const { data } = await api.put(`/todos/${id}`, body)
            return this._upsertLocal(data)
        },

        async toggle(id) {
            const existing = this.items.find(t => t.id === id)
            if (!existing) return
            if (!navigator.onLine || id < 0) {
                const local = this._upsertLocal({
                    ...existing,
                    status: existing.status === 'Done' ? 'Todo' : 'Done'
                })
                useSyncStore().enqueue('todo', this._toSyncDto(local))
                return local
            }
            const { data } = await api.patch(`/todos/${id}/toggle`)
            return this._upsertLocal(data)
        },

        // Apply a drag-and-drop result. `columns` maps status -> ordered ids for every column the
        // drop touched, e.g. { Todo: [3, 1], InProgress: [2] }. The UI updates immediately; the
        // server (or the offline queue) gets one batch with only the cards that actually moved.
        async setColumns(columns) {
            const changes = []
            for (const [status, ids] of Object.entries(columns)) {
                ids.forEach((id, index) => {
                    const todo = this.items.find(t => t.id === id)
                    if (todo && (todo.status !== status || todo.sortOrder !== index)) {
                        todo.status = status
                        todo.isCompleted = status === 'Done'
                        todo.sortOrder = index
                        changes.push({ id, status, sortOrder: index })
                    }
                })
            }
            if (changes.length === 0) return
            this._cache()

            const sync = useSyncStore()
            const hasTempIds = changes.some(c => c.id < 0)

            if (!navigator.onLine || hasTempIds) {
                for (const c of changes) {
                    sync.enqueue('todo', this._toSyncDto(this.items.find(t => t.id === c.id)))
                }
                if (navigator.onLine && (await sync.flush())) await this.fetchAll()
                return
            }

            try {
                await api.post('/todos/reorder', changes)
            } catch {
                this.error = 'Could not save the new order — reloaded from the server.'
                await this.fetchAll()
            }
        },

        async remove(id) {
            const existing = this.items.find(t => t.id === id)
            const sync = useSyncStore()

            if (id < 0) {
                // Never reached the server: forget it instead of syncing a create + delete.
                sync.dequeue('todo', id)
            } else if (!navigator.onLine) {
                if (existing) sync.enqueue('todo', this._toSyncDto({ ...existing, isDeleted: true }))
            } else {
                await api.delete(`/todos/${id}`)
            }
            this.items = this.items.filter(t => t.id !== id)
            this._cache()
        }
    }
})
