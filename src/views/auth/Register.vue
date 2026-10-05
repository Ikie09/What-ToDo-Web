<template>
    <div class="auth-page">
        <div class="auth-aside" aria-hidden="true">
            <BrandLogo :size="52" />
            <h2>Plan the day.<br />Keep the notes.<br />Never lose a thing.</h2>
            <p>Todos, meetings and notes that stay in sync — even offline.</p>
        </div>

        <main class="auth-main">
            <form class="auth-card" @submit.prevent="register">
                <div class="auth-head">
                    <BrandLogo :size="36" class="mobile-logo" />
                    <h1>Create your account</h1>
                    <p class="muted">It takes a few seconds.</p>
                </div>

                <div class="field">
                    <label for="name">Name</label>
                    <input id="name" v-model="name" type="text" autocomplete="name" placeholder="Your name" required />
                </div>

                <div class="field">
                    <label for="email">Email</label>
                    <input id="email" v-model="email" type="email" autocomplete="email" placeholder="you@example.com" required />
                </div>

                <div class="field">
                    <label for="password">Password</label>
                    <input id="password" v-model="password" type="password" autocomplete="new-password" placeholder="At least 8 characters" required minlength="8" />
                </div>

                <p v-if="auth.error" class="form-error" role="alert">{{ auth.error }}</p>

                <button type="submit" class="btn" :disabled="auth.loading">
                    {{ auth.loading ? 'Creating account…' : 'Create account' }}
                </button>

                <p class="switch">
                    Already have an account?
                    <RouterLink to="/auth/login">Sign in</RouterLink>
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
const name = ref('')
const email = ref('')
const password = ref('')

auth.error = null

const register = async () => {
    const ok = await auth.register(email.value, password.value, name.value)
    if (ok) router.push('/')
}
</script>

<style src="./auth.css" scoped></style>
