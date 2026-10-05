import { defineStore } from 'pinia'
import api from '../services/api'

const CACHE_KEY = 'cache_categories'

export const useCategoriesStore = defineStore('categories', {
    state: () => ({
        items: JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'),
        loading: false,
        error: null
    }),

    actions: {
        _cache() {
            localStorage.setItem(CACHE_KEY, JSON.stringify(this.items))
        },

        async fetchAll() {
            this.loading = true
            this.error = null
            try {
                const { data } = await api.get('/categories')
                this.items = data
                this._cache()
            } catch (err) {
                // Offline or unreachable — keep showing whatever was cached.
                this.error = err.response?.data?.message || 'Could not load categories.'
            } finally {
                this.loading = false
            }
        },

        async create(name, color) {
            const { data } = await api.post('/categories', { name, color })
            this.items.push(data)
            this._cache()
            return data
        },

        async update(id, name, color) {
            const { data } = await api.put(`/categories/${id}`, { name, color })
            const idx = this.items.findIndex(c => c.id === id)
            if (idx !== -1) this.items[idx] = data
            this._cache()
            return data
        },

        async remove(id) {
            await api.delete(`/categories/${id}`)
            this.items = this.items.filter(c => c.id !== id)
            this._cache()
        }
    }
})
