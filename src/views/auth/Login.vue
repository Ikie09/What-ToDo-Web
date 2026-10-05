<template>
    <div class="auth-page">
        <div class="auth-aside" aria-hidden="true">
            <BrandLogo :size="52" />
            <h2>Plan the day.<br />Keep the notes.<br />Never lose a thing.</h2>
            <p>Todos, meetings and notes that stay in sync — even offline.</p>
        </div>

        <main class="auth-main">
            <form class="auth-card" @submit.prevent="login">
                <div class="auth-head">
                    <BrandLogo :size="36" class="mobile-logo" />
                    <h1>Welcome back</h1>
                    <p class="muted">Sign in to continue to What To Do.</p>
                </div>

                <div class="field">
                    <label for="email">Email</label>
                    <input id="email" v-model="email" type="email" autocomplete="email" placeholder="you@example.com" required />
                </div>

                <div class="field">
                    <label for="password">Password</label>
                    <input id="password" v-model="password" type="password" autocomplete="current-password" placeholder="Your password" required />
                </div>

                <p v-if="auth.error" class="form-error" role="alert">{{ auth.error }}</p>

                <button type="submit" class="btn" :disabled="auth.loading">
                    {{ auth.loading ? 'Signing in…' : 'Sign in' }}
                </button>

                <p class="switch">
                    New here?
                    <RouterLink to="/auth/register">Create an account</RouterLink>
                </p>
            </form>
            <ThemeCorner />
        </main>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import BrandLogo from '../../components/BrandLogo.vue'
import ThemeCorner from '../../components/ThemeCorner.vue'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const email = ref('')
const password = ref('')

auth.error = null

const login = async () => {
    const ok = await auth.login(email.value, password.value)
    if (ok) router.push('/')
}
</script>

<style src="./auth.css" scoped></style>
