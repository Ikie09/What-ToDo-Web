<template>
    <div class="page">
        <div class="page-header">
            <div>
                <h2 class="page-title">Notes</h2>
                <p class="page-sub">{{ store.items.length }} note{{ store.items.length === 1 ? '' : 's' }}</p>
            </div>
            <button type="button" class="btn" @click="openCreate">
                <Plus :size="18" aria-hidden="true" /> New note
            </button>
        </div>

        <div class="search">
            <Search :size="16" aria-hidden="true" />
            <label class="sr-only" for="note-search">Search notes</label>
            <input id="note-search" v-model="search" type="search" placeholder="Search notes" />
        </div>

        <p v-if="store.error" class="form-error" role="alert">{{ store.error }}</p>

        <section v-if="filtered.length === 0" class="card">
            <EmptyState
                :icon="StickyNote"
                :title="search ? 'No notes match your search' : 'No notes yet'"
                :text="search ? 'Try a different word.' : 'Capture ideas, lists and anything you want to remember — type or dictate.'"
            >
                <button v-if="!search" type="button" class="btn" @click="openCreate">Write your first note</button>
            </EmptyState>
        </section>

        <ul v-else class="grid">
            <li v-for="n in filtered" :key="n.id" class="note card">
                <header>
                    <h3>{{ n.title }}</h3>
                    <div class="note-actions">
                        <button type="button" class="icon-btn" :aria-label="`Edit “${n.title}”`" @click="openEdit(n)">
                            <Pencil :size="16" aria-hidden="true" />
                        </button>
                        <button type="button" class="icon-btn danger" :aria-label="`Delete “${n.title}”`" @click="remove(n)">
                            <Trash2 :size="16" aria-hidden="true" />
                        </button>
                    </div>
                </header>
                <p class="body">{{ n.body }}</p>
                <time class="stamp" :datetime="n.updatedAt">Updated {{ formatDateTime(n.updatedAt) }}</time>
            </li>
        </ul>

        <AppModal v-model:open="modalOpen" :title="editing ? 'Edit note' : 'New note'">
            <form class="form" @submit.prevent="save">
                <div class="field">
                    <label for="n-title">Title</label>
                    <input id="n-title" v-model="form.title" type="text" required maxlength="255" autofocus />
                </div>
                <div class="field">
                    <label for="n-body">Note</label>
                    <textarea id="n-body" ref="bodyEl" v-model="form.body" rows="8" placeholder="Write or dictate…"></textarea>
                </div>
                <DictateButton @transcript="onTranscript" />
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" @click="modalOpen = false">Cancel</button>
                    <button type="submit" class="btn">{{ editing ? 'Save changes' : 'Add note' }}</button>
                </div>
            </form>
        </AppModal>
    </div>
</template>

<script setup>
import { reactive, ref, computed, nextTick, onMounted } from 'vue'
import { Plus, Search, Pencil, Trash2, StickyNote } from 'lucide-vue-next'
import AppModal from '../components/AppModal.vue'
import EmptyState from '../components/EmptyState.vue'
import DictateButton from '../components/DictateButton.vue'
import { useNotesStore } from '../stores/notes'
import { formatDateTime } from '../utils/dates'
import { insertAtCursor } from '../utils/text'

const store = useNotesStore()
const search = ref('')
const modalOpen = ref(false)
const editing = ref(null)
const bodyEl = ref(null)
const form = reactive({ title: '', body: '' })

onMounted(() => store.fetchAll())

// Searched locally so it also works offline.
const filtered = computed(() => {
    const s = search.value.trim().toLowerCase()
    const sorted = [...store.items].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    if (!s) return sorted
    return sorted.filter(n => n.title.toLowerCase().includes(s) || (n.body || '').toLowerCase().includes(s))
})

function openCreate() {
    editing.value = null
    Object.assign(form, { title: '', body: '' })
    modalOpen.value = true
}

function openEdit(note) {
    editing.value = note
    Object.assign(form, { title: note.title, body: note.body || '' })
    modalOpen.value = true
}

async function onTranscript(text) {
    const { value, caret } = insertAtCursor(bodyEl.value, form.body, text)
    form.body = value
    await nextTick()
    bodyEl.value?.setSelectionRange(caret, caret)
}

async function save() {
    const payload = { title: form.title.trim(), body: form.body.trim() || null }
    if (editing.value) await store.update(editing.value.id, payload)
    else await store.create(payload)
    modalOpen.value = false
}

async function remove(note) {
    if (window.confirm(`Delete “${note.title}”?`)) await store.remove(note.id)
}
</script>

<style scoped>
.search { position: relative; max-width: 360px; }
.search svg { position: absolute; left: 0.7rem; top: 50%; transform: translateY(-50%); color: var(--text-faint); pointer-events: none; }
.search input { padding-left: 2.2rem; }

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1rem;
}

.note { display: flex; flex-direction: column; gap: 0.5rem; }
.note header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
.note h3 { font-size: 1rem; word-break: break-word; }
.note-actions { display: flex; flex: none; }

.body {
    flex: 1;
    font-size: 0.9rem;
    color: var(--text-muted);
    white-space: pre-wrap;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 8;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.stamp { font-size: 0.75rem; color: var(--text-faint); }

.form { display: flex; flex-direction: column; gap: 0.9rem; }
.form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
</style>
