<template>
    <router-view />
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch } from 'vue'
import { useAuthStore } from './stores/auth'
import { usePushStore } from './stores/push'
import { useSyncStore } from './stores/sync'
import { useTodosStore } from './stores/todos'
import { useNotesStore } from './stores/notes'
import { useMeetingsStore } from './stores/meetings'
import { useCategoriesStore } from './stores/categories'
import { useTransactionsStore } from './stores/transactions'
import { useBudgetsStore } from './stores/budgets'
import { useRemindersStore } from './stores/reminders'

const sync = useSyncStore()
const todos = useTodosStore()
const notes = useNotesStore()
const meetings = useMeetingsStore()
const categories = useCategoriesStore()
const transactions = useTransactionsStore()
const budgets = useBudgetsStore()
const reminders = useRemindersStore()
const auth = useAuthStore()
const push = usePushStore()

// The push endpoints need a signed-in user, so (re)check support once there is a token.
watch(() => auth.isAuthenticated, (signedIn) => { if (signedIn) push.init() }, { immediate: true })

onMounted(() => {
    // After queued offline edits are pushed, refetch canonical data so every view
    // shows the reconciled server state (and temp ids become real ids).
    sync.init(() => {
        todos.fetchAll()
        notes.fetchAll()
        meetings.fetchAll()
        categories.fetchAll()
        transactions.fetchAll()
        budgets.fetchAll()
    })
    reminders.start()
})

onBeforeUnmount(() => reminders.stop())
</script>
