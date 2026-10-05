import { defineStore } from 'pinia'
import api from '../services/api'
import { useSyncStore, tempId } from './sync'

const CACHE_KEY = 'cache_notes'

export const useNotesStore = defineStore('notes', {
    state: () => ({
        items: JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'),
        loading: false,
        error: null
    }),

    actions: {
        _cache() {
            localStorage.setItem(CACHE_KEY, JSON.stringify(this.items))
        },

        _upsertLocal(note) {
            const idx = this.items.findIndex(n => n.id === note.id)
            if (idx !== -1) this.items[idx] = note
            else this.items.unshift(note)
            this._cache()
            return note
        },

        _toSyncDto(note) {
            return {
                id: note.id,
                title: note.title,
                body: note.body ?? null,
                updatedAt: new Date().toISOString(),
                isDeleted: !!note.isDeleted
            }
        },

        async fetchAll(search) {
            this.loading = true
            this.error = null
            try {
                const { data } = await api.get('/notes', { params: search ? { search } : {} })
                this.items = data
                this._cache()
            } catch (err) {
                this.error = err.response?.data?.message || 'Could not load notes — showing offline copy.'
            } finally {
                this.loading = false
            }
        },

        async create(payload) {
            if (!navigator.onLine) {
                const now = new Date().toISOString()
                const local = this._upsertLocal({ id: tempId(), createdAt: now, updatedAt: now, ...payload })
                useSyncStore().enqueue('note', this._toSyncDto(local))
                return local
            }
            const { data } = await api.post('/notes', payload)
            return this._upsertLocal(data)
        },

        async update(id, payload) {
            const existing = this.items.find(n => n.id === id)
            if (!navigator.onLine || id < 0) {
                const local = this._upsertLocal({ ...existing, ...payload, updatedAt: new Date().toISOString() })
                useSyncStore().enqueue('note', this._toSyncDto(local))
                return local
            }
            const { data } = await api.put(`/notes/${id}`, payload)
            return this._upsertLocal(data)
        },

        async remove(id) {
            const existing = this.items.find(n => n.id === id)
            const sync = useSyncStore()

            if (id < 0) {
                sync.dequeue('note', id)
            } else if (!navigator.onLine) {
                if (existing) sync.enqueue('note', this._toSyncDto({ ...existing, isDeleted: true }))
            } else {
                await api.delete(`/notes/${id}`)
            }
            this.items = this.items.filter(n => n.id !== id)
            this._cache()
        }
    }
})
