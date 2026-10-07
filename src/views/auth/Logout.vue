<template>
    <div class="auth-page">
        <div class="auth-card card" role="status">
            <BrandLogo :size="44" />
            <h1>Signing you out…</h1>
            <p class="muted">{{ message }}</p>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BrandLogo from '../../components/BrandLogo.vue'
import { useAuthStore } from '../../stores/auth'
import { useSyncStore } from '../../stores/sync'
import { useTodosStore } from '../../stores/todos'
import { useNotesStore } from '../../stores/notes'
import { useMeetingsStore } from '../../stores/meetings'
import { useCategoriesStore } from '../../stores/categories'
import { useTransactionsStore } from '../../stores/transactions'
import { useBudgetsStore } from '../../stores/budgets'
import { usePushStore } from '../../stores/push'

const router = useRouter()
const auth = useAuthStore()
const sync = useSyncStore()
const message = ref('Saving any pending changes first.')

// Per-user data only: theme, sidebar and reminder preferences are kept.
const USER_KEYS = [
    'cache_todos', 'cache_notes', 'cache_categories', 'cache_meetings', 'cache_transactions', 'cache_budgets',
    'sync_queue', 'sync_last_time', 'sync_temp_id_counter', 'reminders_notified'
]

onMounted(async () => {
    if (sync.pendingCount > 0) {
        const pushed = await sync.flush()
        if (!pushed && !window.confirm('You have changes that have not synced yet. Signing out will discard them. Sign out anyway?')) {
            router.replace('/')
            return
        }
    }

    // Stop pushing this account's reminders to this browser (needs the token, so before it is cleared).
    await usePushStore().disable().catch(() => {})

    auth.logout()
    USER_KEYS.forEach((key) => localStorage.removeItem(key))
    // Stores re-read their (now empty) cache, so the next account never sees this one's data.
    ;[useTodosStore(), useNotesStore(), useMeetingsStore(), useCategoriesStore(), useTransactionsStore(), useBudgetsStore(), sync]
        .forEach((s) => s.$reset())
    router.replace('/auth/login')
})
</script>

<style scoped>
.auth-page {
    display: grid;
    place-items: center;
    min-height: 100vh;
    padding: 1rem;
}

.auth-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    width: min(380px, 100%);
    padding: 2rem;
    text-align: center;
}

h1 { font-size: 1.25rem; }
</style>
