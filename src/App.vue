<template>
    <router-view />
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { useSyncStore } from './stores/sync'
import { useTodosStore } from './stores/todos'
import { useNotesStore } from './stores/notes'
import { useMeetingsStore } from './stores/meetings'
import { useCategoriesStore } from './stores/categories'
import { useRemindersStore } from './stores/reminders'

const sync = useSyncStore()
const todos = useTodosStore()
const notes = useNotesStore()
const meetings = useMeetingsStore()
const categories = useCategoriesStore()
const reminders = useRemindersStore()

onMounted(() => {
    // After queued offline edits are pushed, refetch canonical data so every view
    // shows the reconciled server state (and temp ids become real ids).
    sync.init(() => {
        todos.fetchAll()
        notes.fetchAll()
        meetings.fetchAll()
        categories.fetchAll()
    })
    reminders.start()
})

onBeforeUnmount(() => reminders.stop())
</script>
