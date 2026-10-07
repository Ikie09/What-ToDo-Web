import { defineStore } from 'pinia'
import api from '../services/api'
import { useSyncStore, tempId } from './sync'

const CACHE_KEY = 'cache_transactions'

export const useTransactionsStore = defineStore('transactions', {
    state: () => ({
        items: JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'),
        loading: false,
        error: null
    }),

    getters: {
        // Newest first, ties broken by id so the order is stable.
        sorted: (state) => [...state.items].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    },

    actions: {
        _cache() {
            localStorage.setItem(CACHE_KEY, JSON.stringify(this.items))
        },

        _upsertLocal(tx) {
            const idx = this.items.findIndex(t => t.id === tx.id)
            if (idx !== -1) this.items[idx] = tx
            else this.items.push(tx)
            this._cache()
            return tx
        },

        _toSyncDto(t) {
            return {
                id: t.id,
                type: t.type,
                amount: t.amount,
                category: t.category,
                note: t.note ?? null,
                date: t.date,
                updatedAt: new Date().toISOString(),
                isDeleted: !!t.isDeleted
            }
        },

        async fetchAll() {
            this.loading = true
            this.error = null
            try {
                const { data } = await api.get('/transactions')
                this.items = data
                this._cache()
            } catch (err) {
                this.error = err.response?.data?.message || 'Could not load transactions — showing offline copy.'
            } finally {
                this.loading = false
            }
        },

        async create(payload) {
            if (!navigator.onLine) {
                const now = new Date().toISOString()
                const local = this._upsertLocal({ id: tempId(), createdAt: now, updatedAt: now, ...payload })
                useSyncStore().enqueue('transaction', this._toSyncDto(local))
                return local
            }
            const { data } = await api.post('/transactions', payload)
            return this._upsertLocal(data)
        },

        async update(id, payload) {
            const existing = this.items.find(t => t.id === id)
            const merged = { ...existing, ...payload }
            if (!navigator.onLine || id < 0) {
                const local = this._upsertLocal({ ...merged, updatedAt: new Date().toISOString() })
                useSyncStore().enqueue('transaction', this._toSyncDto(local))
                return local
            }
            const { data } = await api.put(`/transactions/${id}`, {
                type: merged.type,
                amount: merged.amount,
                category: merged.category,
                note: merged.note ?? null,
                date: merged.date
            })
            return this._upsertLocal(data)
        },

        async remove(id) {
            const existing = this.items.find(t => t.id === id)
            const sync = useSyncStore()

            if (id < 0) {
                sync.dequeue('transaction', id)
            } else if (!navigator.onLine) {
                if (existing) sync.enqueue('transaction', this._toSyncDto({ ...existing, isDeleted: true }))
            } else {
                await api.delete(`/transactions/${id}`)
            }
            this.items = this.items.filter(t => t.id !== id)
            this._cache()
        }
    }
})
