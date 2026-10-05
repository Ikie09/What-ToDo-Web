import { defineStore } from 'pinia'
import api from '../services/api'
import { useSyncStore, tempId } from './sync'

const CACHE_KEY = 'cache_meetings'

export const useMeetingsStore = defineStore('meetings', {
    state: () => ({
        items: JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'),
        loading: false,
        error: null
    }),

    getters: {
        sorted: (state) => [...state.items].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)),
        // Meetings that haven't finished yet, soonest first.
        upcoming() {
            const now = Date.now()
            return this.sorted.filter(m => new Date(m.endsAt).getTime() >= now)
        }
    },

    actions: {
        _cache() {
            localStorage.setItem(CACHE_KEY, JSON.stringify(this.items))
        },

        _upsertLocal(meeting) {
            const idx = this.items.findIndex(m => m.id === meeting.id)
            if (idx !== -1) this.items[idx] = meeting
            else this.items.push(meeting)
            this._cache()
            return meeting
        },

        _toSyncDto(m) {
            return {
                id: m.id,
                title: m.title,
                description: m.description ?? null,
                location: m.location ?? null,
                startsAt: m.startsAt,
                endsAt: m.endsAt,
                meetingNotes: m.meetingNotes ?? null,
                updatedAt: new Date().toISOString(),
                isDeleted: !!m.isDeleted
            }
        },

        async fetchAll() {
            this.loading = true
            this.error = null
            try {
                const { data } = await api.get('/meetings')
                this.items = data
                this._cache()
            } catch (err) {
                this.error = err.response?.data?.message || 'Could not load meetings — showing offline copy.'
            } finally {
                this.loading = false
            }
        },

        async create(payload) {
            if (!navigator.onLine) {
                const now = new Date().toISOString()
                const local = this._upsertLocal({ id: tempId(), createdAt: now, updatedAt: now, ...payload })
                useSyncStore().enqueue('meeting', this._toSyncDto(local))
                return local
            }
            const { data } = await api.post('/meetings', payload)
            return this._upsertLocal(data)
        },

        async update(id, payload) {
            const existing = this.items.find(m => m.id === id)
            const merged = { ...existing, ...payload }
            if (!navigator.onLine || id < 0) {
                const local = this._upsertLocal({ ...merged, updatedAt: new Date().toISOString() })
                useSyncStore().enqueue('meeting', this._toSyncDto(local))
                return local
            }
            const { data } = await api.put(`/meetings/${id}`, {
                title: merged.title,
                description: merged.description ?? null,
                location: merged.location ?? null,
                startsAt: merged.startsAt,
                endsAt: merged.endsAt,
                meetingNotes: merged.meetingNotes ?? null
            })
            return this._upsertLocal(data)
        },

        async remove(id) {
            const existing = this.items.find(m => m.id === id)
            const sync = useSyncStore()

            if (id < 0) {
                sync.dequeue('meeting', id)
            } else if (!navigator.onLine) {
                if (existing) sync.enqueue('meeting', this._toSyncDto({ ...existing, isDeleted: true }))
            } else {
                await api.delete(`/meetings/${id}`)
            }
            this.items = this.items.filter(m => m.id !== id)
            this._cache()
        }
    }
})
