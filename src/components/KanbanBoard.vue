<template>
    <div class="board">
        <p v-if="locked" class="lock-note" role="status">
            <Filter :size="14" aria-hidden="true" />
            Filters are on — clear them to drag cards between columns. You can still use each card's “move to” menu.
        </p>

        <div class="columns">
            <section v-for="status in STATUSES" :key="status" class="column" :aria-label="STATUS_LABELS[status]">
                <header class="column-head">
                    <span class="dot" :style="{ background: COLORS[status] }" aria-hidden="true"></span>
                    <h2>{{ STATUS_LABELS[status] }}</h2>
                    <span class="count">{{ columns[status].length }}</span>
                    <button
                        type="button"
                        class="icon-btn add"
                        :aria-label="`Add a todo to ${STATUS_LABELS[status]}`"
                        @click="emit('add', status)"
                    >
                        <Plus :size="18" aria-hidden="true" />
                    </button>
                </header>

                <draggable
                    v-model="columns[status]"
                    class="drop"
                    group="todos"
                    item-key="id"
                    draggable=".todo"
                    :disabled="locked"
                    :animation="160"
                    :delay="150"
                    :delay-on-touch-only="true"
                    filter="button, select, input, a"
                    :prevent-on-filter="false"
                    ghost-class="ghost"
                    @end="onEnd"
                >
                    <template #item="{ element }">
                        <TodoItem
                            :todo="element"
                            variant="card"
                            @edit="emit('edit', $event)"
                            @remove="emit('remove', $event)"
                            @move="(todo, to) => emit('move', todo, to)"
                        />
                    </template>
                    <template #footer>
                        <p v-if="columns[status].length === 0" class="empty-col">Drop cards here</p>
                    </template>
                </draggable>
            </section>
        </div>
    </div>
</template>

<script setup>
import { reactive, computed, watch, nextTick } from 'vue'
import draggable from 'vuedraggable'
import { Plus, Filter } from 'lucide-vue-next'
import TodoItem from './TodoItem.vue'
import { STATUSES, STATUS_LABELS } from '../stores/todos'

const props = defineProps({
    todos: { type: Array, required: true },
    locked: { type: Boolean, default: false }
})
const emit = defineEmits(['add', 'edit', 'remove', 'move', 'reorder'])

const COLORS = { Todo: 'var(--col-todo)', InProgress: 'var(--col-doing)', Done: 'var(--col-done)' }

function build() {
    const out = {}
    for (const status of STATUSES) {
        out[status] = props.todos
            .filter(t => t.status === status)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    }
    return out
}

// Local column arrays are what vuedraggable mutates; they are rebuilt whenever the store changes.
const columns = reactive(build())

watch(() => props.todos, () => Object.assign(columns, build()), { deep: true })

// One `end` per drag: read the final order of every column and let the store persist what changed.
async function onEnd() {
    await nextTick()
    const result = {}
    for (const status of STATUSES) result[status] = columns[status].map(t => t.id)
    emit('reorder', result)
}
</script>

<style scoped>
.board { display: flex; flex-direction: column; gap: 0.75rem; }

.lock-note {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    color: var(--text-muted);
}

.columns {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    align-items: start;
}

.column {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.75rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
}

.column-head { display: flex; align-items: center; gap: 0.5rem; padding: 0 0.15rem; }
.column-head h2 { font-size: 0.9rem; font-weight: 700; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.count {
    padding: 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-muted);
    background: var(--surface);
    border-radius: 999px;
}
.add { margin-left: auto; width: 30px; height: 30px; }

.drop { display: flex; flex-direction: column; gap: 0.6rem; min-height: 90px; }

.empty-col {
    padding: 1.25rem 0.5rem;
    font-size: 0.82rem;
    text-align: center;
    color: var(--text-faint);
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius);
}

.ghost { opacity: 0.45; }

@media (max-width: 900px) {
    .columns { grid-template-columns: 1fr; }
}
</style>
