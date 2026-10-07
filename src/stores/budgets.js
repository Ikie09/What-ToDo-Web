import { defineStore } from 'pinia'
import api from '../services/api'
import { useSyncStore, tempId } from './sync'

const CACHE_KEY = 'cache_budgets'

const sameCategory = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

export const useBudgetsStore = defineStore('budgets', {
    state: () => ({
        items: JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'),
        loading: false,
        error: null
    }),

    getters: {
        sorted: (state) => [...state.items].sort((a, b) => a.category.localeCompare(b.category))
    },

    actions: {
        _cache() {
            localStorage.setItem(CACHE_KEY, JSON.stringify(this.items))
        },

        _upsertLocal(budget) {
            const idx = this.items.findIndex(b => b.id === budget.id)
            if (idx !== -1) this.items[idx] = budget
            else this.items.push(budget)
            this._cache()
            return budget
        },

        _toSyncDto(b) {
            return {
                id: b.id,
                category: b.category,
                monthlyLimit: b.monthlyLimit,
                updatedAt: new Date().toISOString(),
                isDeleted: !!b.isDeleted
            }
        },

        async fetchAll() {
            this.loading = true
            this.error = null
            try {
                const { data } = await api.get('/budgets')
                this.items = data
                this._cache()
            } catch (err) {
                this.error = err.response?.data?.message || 'Could not load budgets — showing offline copy.'
            } finally {
                this.loading = false
            }
        },

        async create(payload) {
            if (!navigator.onLine) {
                const now = new Date().toISOString()
                const local = this._upsertLocal({ id: tempId(), createdAt: now, updatedAt: now, ...payload })
                useSyncStore().enqueue('budget', this._toSyncDto(local))
                return local
            }
            const { data } = await api.post('/budgets', payload)
            return this._upsertLocal(data)
        },

        async update(id, payload) {
            const existing = this.items.find(b => b.id === id)
            const merged = { ...existing, ...payload }
            if (!navigator.onLine || id < 0) {
                const local = this._upsertLocal({ ...merged, updatedAt: new Date().toISOString() })
                useSyncStore().enqueue('budget', this._toSyncDto(local))
                return local
            }
            const { data } = await api.put(`/budgets/${id}`, {
                category: merged.category,
                monthlyLimit: merged.monthlyLimit
            })
            return this._upsertLocal(data)
        },

        async remove(id) {
            const existing = this.items.find(b => b.id === id)
            const sync = useSyncStore()

            if (id < 0) {
                sync.dequeue('budget', id)
            } else if (!navigator.onLine) {
                if (existing) sync.enqueue('budget', this._toSyncDto({ ...existing, isDeleted: true }))
            } else {
                await api.delete(`/budgets/${id}`)
            }
            this.items = this.items.filter(b => b.id !== id)
            this._cache()
        },

        // One budget per category: create it, change its limit, or remove it when the limit is empty/0.
        async setLimit(category, limit) {
            const name = category.trim()
            const existing = this.items.find(b => sameCategory(b.category, name))
            const amount = Number(limit)

            if (!amount || amount <= 0) {
                if (existing) await this.remove(existing.id)
                return null
            }
            if (existing) {
                if (existing.monthlyLimit === amount) return existing
                return this.update(existing.id, { monthlyLimit: amount })
            }
            return this.create({ category: name, monthlyLimit: amount })
        }
    }
})
