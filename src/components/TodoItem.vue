<template>
    <article class="todo" :class="[variant, { done: todo.status === 'Done' }]">
        <input
            v-if="variant === 'row'"
            type="checkbox"
            class="check"
            :checked="todo.status === 'Done'"
            :aria-label="`Mark “${todo.title}” as ${todo.status === 'Done' ? 'not done' : 'done'}`"
            @change="emit('toggle', todo)"
        />

        <div class="main">
            <p class="todo-title">{{ todo.title }}</p>
            <p v-if="todo.notes" class="todo-notes">{{ todo.notes }}</p>

            <div class="meta">
                <span class="badge" :class="'badge-' + todo.priority.toLowerCase()">{{ todo.priority }}</span>
                <span v-if="todo.categoryName" class="badge category">
                    <span class="swatch" :style="{ background: todo.categoryColor || 'var(--accent)' }" aria-hidden="true"></span>
                    {{ todo.categoryName }}
                </span>
                <span v-if="todo.dueDate" class="due" :class="{ overdue }">
                    <CalendarClock :size="14" aria-hidden="true" />
                    {{ overdue ? 'Overdue · ' : '' }}{{ formatDueDate(todo.dueDate) }}
                </span>
            </div>
        </div>

        <div class="actions">
            <label v-if="variant === 'card'" class="move">
                <span class="sr-only">Move “{{ todo.title }}” to</span>
                <select :value="todo.status" @change="onMove">
                    <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
                </select>
            </label>
            <button type="button" class="icon-btn" :aria-label="`Edit “${todo.title}”`" @click="emit('edit', todo)">
                <Pencil :size="16" aria-hidden="true" />
            </button>
            <button type="button" class="icon-btn danger" :aria-label="`Delete “${todo.title}”`" @click="emit('remove', todo)">
                <Trash2 :size="16" aria-hidden="true" />
            </button>
        </div>
    </article>
</template>

<script setup>
import { computed } from 'vue'
import { CalendarClock, Pencil, Trash2 } from 'lucide-vue-next'
import { STATUSES, STATUS_LABELS } from '../stores/todos'
import { formatDueDate, isOverdue } from '../utils/dates'

const props = defineProps({
    todo: { type: Object, required: true },
    variant: { type: String, default: 'row' }
})
const emit = defineEmits(['toggle', 'edit', 'remove', 'move'])

const overdue = computed(() => isOverdue(props.todo))

function onMove(event) {
    emit('move', props.todo, event.target.value)
}
</script>

<style scoped>
.todo {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.8rem 0.9rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
}

.todo.card {
    flex-direction: column;
    box-shadow: var(--shadow-sm);
    cursor: grab;
}

.todo.card:active { cursor: grabbing; }

.check { margin-top: 3px; flex: none; }

.main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.35rem; width: 100%; }

.todo-title { font-weight: 600; word-break: break-word; }
.todo.done .todo-title { color: var(--text-faint); text-decoration: line-through; }

.todo-notes {
    font-size: 0.85rem;
    color: var(--text-muted);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }

.category { background: var(--surface-2); color: var(--text-muted); }
.swatch { width: 8px; height: 8px; border-radius: 50%; }

.due {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
}
.due.overdue { color: var(--danger); }

.actions { display: flex; align-items: center; gap: 0.15rem; flex: none; }
.todo.card .actions { width: 100%; justify-content: flex-end; }

.move select {
    min-height: 32px;
    width: auto;
    margin-right: auto;
    padding: 0.2rem 0.4rem;
    font-size: 0.78rem;
}
.todo.card .move { margin-right: auto; }
</style>
