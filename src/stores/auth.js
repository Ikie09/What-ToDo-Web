import { defineStore } from 'pinia'
import api from '../services/api'
import { decodeJwt } from '../utils/jwt'

function userFromToken(token) {
    const claims = decodeJwt(token)
    if (!claims) return null
    return {
        id: claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || claims.sub,
        email: claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || claims.email
    }
}

export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: localStorage.getItem('auth_token') || null,
        user: JSON.parse(localStorage.getItem('auth_user') || 'null'),
        error: null,
        loading: false
    }),

    getters: {
        isAuthenticated: (state) => !!state.token
    },

    actions: {
        _persist(token) {
            this.token = token
            this.user = userFromToken(token)
            localStorage.setItem('auth_token', token)
            localStorage.setItem('auth_user', JSON.stringify(this.user))
        },

        async login(email, password) {
            this.loading = true
            this.error = null
            try {
                const { data } = await api.post('/auth/login', { email, password })
                this._persist(data.token)
                return true
            } catch (err) {
                this.error = err.response?.data?.message || 'Login failed. Please try again.'
                return false
            } finally {
                this.loading = false
            }
        },

        async register(email, password, displayName) {
            this.loading = true
            this.error = null
            try {
                const { data } = await api.post('/auth/register', {
                    email,
                    password,
                    displayName
                })
                this._persist(data.token)
                return true
            } catch (err) {
                this.error = err.response?.data?.errors?.join(', ') ||
                    err.response?.data?.message ||
                    'Registration failed. Please try again.'
                return false
            } finally {
                this.loading = false
            }
        },

        logout() {
            this.token = null
            this.user = null
            localStorage.removeItem('auth_token')
            localStorage.removeItem('auth_user')
        }
    }
})
