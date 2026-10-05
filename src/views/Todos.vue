<template>
    <div class="page">
        <div class="page-header">
            <div>
                <h2 class="page-title">Todos</h2>
                <p class="page-sub">{{ store.openCount }} open · {{ store.completedCount }} done</p>
            </div>

            <div class="header-actions">
                <div class="segmented" role="group" aria-label="View">
                    <button type="button" :aria-pressed="view === 'board'" @click="setView('board')">
                        <Columns3 :size="16" aria-hidden="true" /> Board
                    </button>
                    <button type="button" :aria-pressed="view === 'list'" @click="setView('list')">
                        <List :size="16" aria-hidden="true" /> List
                    </button>
                </div>
                <button type="button" class="btn" @click="openCreate()">
                    <Plus :size="18" aria-hidden="true" /> New todo
                </button>
            </div>
        </div>

        <form class="quick card" @submit.prevent="quickAdd">
            <label class="sr-only" for="quick-title">Quick add a todo</label>
            <input id="quick-title" v-model="quickTitle" type="text" placeholder="Quick add a todo…" />
            <button type="submit" class="btn btn-secondary" :disabled="!quickTitle.trim()">Add</button>
        </form>

        <div class="filters">
            <div class="search">
                <Search :size="16" aria-hidden="true" />
                <label class="sr-only" for="todo-search">Search todos</label>
                <input id="todo-search" v-model="search" type="search" placeholder="Search todos" />
            </div>
            <label class="sr-only" for="f-prio">Priority</label>
            <select id="f-prio" v-model="priorityFilter">
                <option value="">All priorities</option>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
            </select>
            <label class="sr-only" for="f-cat">Category</label>
            <select id="f-cat" v-model="categoryFilter">
                <option value="">All categories</option>
                <option v-for="c in categories.items" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <button v-if="filtersActive" type="button" class="btn btn-ghost btn-sm" @click="clearFilters">
                <X :size="14" aria-hidden="true" /> Clear
            </button>
        </div>

        <p v-if="store.error" class="form-error" role="alert">{{ store.error }}</p>

        <KanbanBoard
            v-if="view === 'board'"
            :todos="filtered"
            :locked="filtersActive"
            @add="openCreate"
            @edit="openEdit"
            @remove="remove"
            @move="move"
            @reorder="store.setColumns"
        />

        <section v-else class="card list">
            <EmptyState
                v-if="listItems.length === 0"
                :icon="ListChecks"
                title="Nothing here yet"
                text="Add a todo above, or clear the filters to see everything."
            />
            <ul v-else class="rows">
                <li v-for="todo in listItems" :key="todo.id">
                    <TodoItem :todo="todo" @toggle="store.toggle($event.id)" @edit="openEdit" @remove="remove" />
                </li>
            </ul>
        </section>

        <AppModal v-model:open="modalOpen" :title="editing ? 'Edit todo' : 'New todo'">
            <form class="form" @submit.prevent="save">
                <div class="field">
                    <label for="t-title">Title</label>
                    <input id="t-title" v-model="form.title" type="text" required maxlength="255" autofocus />
                </div>
                <div class="field">
                    <label for="t-notes">Notes</label>
                    <textarea id="t-notes" v-model="form.notes" rows="3"></textarea>
                </div>
                <div class="grid">
                    <div class="field">
                        <label for="t-status">Status</label>
                        <select id="t-status" v-model="form.status">
                            <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
                        </select>
                    </div>
                    <div class="field">
                        <label for="t-prio">Priority</label>
                        <select id="t-prio" v-model="form.priority">
                            <option>Low</option>
                            <option>Medium</option>
                            <option>High</option>
                        </select>
                    </div>
                    <div class="field">
                        <label for="t-cat">Category</label>
                        <select id="t-cat" v-model="form.categoryId">
                            <option :value="null">No category</option>
                            <option v-for="c in categories.items" :key="c.id" :value="c.id">{{ c.name }}</option>
                        </select>
                    </div>
                    <div class="field">
                        <label for="t-due">Due date</label>
                        <input id="t-due" v-model="form.dueDate" type="date" />
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" @click="modalOpen = false">Cancel</button>
                    <button type="submit" class="btn">{{ editing ? 'Save changes' : 'Add todo' }}</button>
                </div>
            </form>
        </AppModal>
    </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { Columns3, List, Plus, Search, X, ListChecks } from 'lucide-vue-next'
import KanbanBoard from '../components/KanbanBoard.vue'
import TodoItem from '../components/TodoItem.vue'
import AppModal from '../components/AppModal.vue'
import EmptyState from '../components/EmptyState.vue'
import { useTodosStore, STATUSES, STATUS_LABELS } from '../stores/todos'
import { useCategoriesStore } from '../stores/categories'
import { dueDateToInput, inputToDueDate } from '../utils/dates'

const store = useTodosStore()
const categories = useCategoriesStore()

const view = ref(localStorage.getItem('todos_view') === 'list' ? 'list' : 'board')
function setView(next) {
    view.value = next
    localStorage.setItem('todos_view', next)
}

const search = ref('')
const priorityFilter = ref('')
const categoryFilter = ref('')
const filtersActive = computed(() => !!(search.value.trim() || priorityFilter.value || categoryFilter.value))

function clearFilters() {
    search.value = ''
    priorityFilter.value = ''
    categoryFilter.value = ''
}

const filtered = computed(() => {
    const s = search.value.trim().toLowerCase()
    return store.items.filter(t => {
        if (priorityFilter.value && t.priority !== priorityFilter.value) return false
        if (categoryFilter.value && t.categoryId !== categoryFilter.value) return false
        if (s && !t.title.toLowerCase().includes(s) && !(t.notes || '').toLowerCase().includes(s)) return false
        return true
    })
})

const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 }
const listItems = computed(() =>
    [...filtered.value].sort((a, b) => {
        if ((a.status === 'Done') !== (b.status === 'Done')) return a.status === 'Done' ? 1 : -1
        const ad = a.dueDate ? dueDateToInput(a.dueDate) : '9999'
        const bd = b.dueDate ? dueDateToInput(b.dueDate) : '9999'
        return ad.localeCompare(bd) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    })
)

onMounted(() => {
    store.fetchAll()
    categories.fetchAll()
})

// Quick add
const quickTitle = ref('')
async function quickAdd() {
    const title = quickTitle.value.trim()
    if (!title) return
    await store.create({ title, priority: 'Medium', notes: null, categoryId: null, dueDate: null })
    quickTitle.value = ''
}

// Create / edit dialog
const modalOpen = ref(false)
const editing = ref(null)
const form = reactive({ title: '', notes: '', status: 'Todo', priority: 'Medium', categoryId: null, dueDate: '' })

function openCreate(status = 'Todo') {
    editing.value = null
    Object.assign(form, { title: '', notes: '', status, priority: 'Medium', categoryId: null, dueDate: '' })
    modalOpen.value = true
}

function openEdit(todo) {
    editing.value = todo
    Object.assign(form, {
        title: todo.title,
        notes: todo.notes || '',
        status: todo.status,
        priority: todo.priority,
        categoryId: todo.categoryId ?? null,
        dueDate: dueDateToInput(todo.dueDate)
    })
    modalOpen.value = true
}

async function save() {
    const payload = {
        title: form.title.trim(),
        notes: form.notes.trim() || null,
        status: form.status,
        priority: form.priority,
        categoryId: form.categoryId,
        dueDate: inputToDueDate(form.dueDate)
    }
    if (editing.value) {
        const moved = payload.status !== editing.value.status
        // A status change from the dialog goes to the bottom of the new column.
        if (moved) payload.sortOrder = store.column(payload.status).length
        await store.update(editing.value.id, payload)
    } else {
        await store.create(payload)
    }
    modalOpen.value = false
}

async function remove(todo) {
    if (window.confirm(`Delete “${todo.title}”?`)) await store.remove(todo.id)
}

// "Move to" menu: append to the target column (full column, so hidden cards keep their place).
function move(todo, status) {
    const ids = store.column(status).map(t => t.id)
    store.setColumns({ [status]: [...ids, todo.id] })
}
</script>

<style scoped>
.header-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }

.quick { display: flex; gap: 0.5rem; padding: 0.6rem; }

.filters { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.filters select { width: auto; min-width: 150px; }

.search { position: relative; flex: 1 1 220px; max-width: 320px; }
.search svg { position: absolute; left: 0.7rem; top: 50%; transform: translateY(-50%); color: var(--text-faint); pointer-events: none; }
.search input { padding-left: 2.2rem; }

.list { padding: 0.75rem; }
.rows { display: flex; flex-direction: column; gap: 0.5rem; }

.form { display: flex; flex-direction: column; gap: 0.9rem; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.9rem; }
.form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem; }

@media (max-width: 520px) {
    .grid { grid-template-columns: 1fr; }
}
</style>
