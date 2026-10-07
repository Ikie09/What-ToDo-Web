<template>
    <div class="page">
        <div class="page-header">
            <div>
                <h2 class="page-title">Meetings</h2>
                <p class="page-sub">{{ summary }}</p>
            </div>
            <button type="button" class="btn" @click="openCreate">
                <Plus :size="18" aria-hidden="true" /> Schedule meeting
            </button>
        </div>

        <p v-if="store.error" class="form-error" role="alert">{{ store.error }}</p>

        <div class="layout">
            <section class="agenda" aria-label="Agenda">
                <div v-if="store.items.length === 0" class="card">
                    <EmptyState
                        :icon="CalendarDays"
                        title="No meetings scheduled"
                        text="Schedule one and take notes while it happens — you can dictate them too."
                    >
                        <button type="button" class="btn" @click="openCreate">Schedule a meeting</button>
                    </EmptyState>
                </div>

                <template v-else>
                    <div v-for="group in groups" :key="group.key" class="group">
                        <h3 class="group-title">{{ group.label }}</h3>
                        <ul class="items">
                            <li v-for="m in group.items" :key="m.id">
                                <button
                                    type="button"
                                    class="meeting"
                                    :class="{ active: m.id === selectedId, finished: isFinished(m) }"
                                    :aria-pressed="m.id === selectedId"
                                    @click="select(m)"
                                >
                                    <span class="when">
                                        <strong>{{ formatTime(m.startsAt) }}</strong>
                                        <span>{{ formatTime(m.endsAt) }}</span>
                                    </span>
                                    <span class="info">
                                        <span class="m-title">{{ m.title }}</span>
                                        <span v-if="m.location" class="m-loc">
                                            <MapPin :size="13" aria-hidden="true" /> {{ m.location }}
                                        </span>
                                        <span v-if="group.key !== 'today'" class="m-day">{{ shortDay(m.startsAt) }}</span>
                                    </span>
                                    <span v-if="m.meetingNotes" class="has-notes" title="Has notes">
                                        <NotebookPen :size="15" aria-hidden="true" />
                                        <span class="sr-only">Has notes</span>
                                    </span>
                                </button>
                            </li>
                        </ul>
                    </div>
                </template>
            </section>

            <section class="detail card" aria-label="Meeting details">
                <EmptyState
                    v-if="!selected"
                    :icon="NotebookPen"
                    title="Pick a meeting"
                    text="Select a meeting to see the details and write its notes."
                />

                <template v-else>
                    <header class="detail-head">
                        <div>
                            <h3>{{ selected.title }}</h3>
                            <p class="muted">{{ formatDay(selected.startsAt) }} · {{ formatTime(selected.startsAt) }} – {{ formatTime(selected.endsAt) }}</p>
                            <p v-if="selected.location" class="muted loc"><MapPin :size="14" aria-hidden="true" /> {{ selected.location }}</p>
                        </div>
                        <div class="detail-actions">
                            <ExportMenu :label="`Export “${selected.title}”`" :items="exportItems" @error="exportError = $event" />
                            <button type="button" class="icon-btn" :aria-label="`Edit “${selected.title}”`" @click="openEdit(selected)">
                                <Pencil :size="16" aria-hidden="true" />
                            </button>
                            <button type="button" class="icon-btn danger" :aria-label="`Delete “${selected.title}”`" @click="remove(selected)">
                                <Trash2 :size="16" aria-hidden="true" />
                            </button>
                        </div>
                    </header>

                    <p v-if="exportError" class="form-error" role="alert">{{ exportError }}</p>
                    <p v-if="selected.description" class="description">{{ selected.description }}</p>

                    <div class="notes">
                        <div class="notes-head">
                            <label for="meeting-notes">Meeting notes</label>
                            <span class="save-state" role="status" aria-live="polite">{{ saveLabel }}</span>
                        </div>
                        <textarea
                            id="meeting-notes"
                            ref="notesEl"
                            v-model="draft"
                            rows="12"
                            placeholder="Agenda, decisions, action items… type or dictate."
                            @input="scheduleSave"
                            @blur="saveNow"
                        ></textarea>
                        <div class="speech-tools">
                            <DictateButton @transcript="onTranscript" />
                            <TranscribeButton @transcript="onTranscript" />
                        </div>
                    </div>
                </template>
            </section>
        </div>

        <AppModal v-model:open="modalOpen" :title="editing ? 'Edit meeting' : 'Schedule meeting'">
            <form class="form" @submit.prevent="save">
                <div class="field">
                    <label for="m-title">Title</label>
                    <input id="m-title" v-model="form.title" type="text" required maxlength="255" autofocus />
                </div>
                <div class="grid">
                    <div class="field">
                        <label for="m-start">Starts</label>
                        <input id="m-start" v-model="form.start" type="datetime-local" required />
                    </div>
                    <div class="field">
                        <label for="m-end">Ends</label>
                        <input id="m-end" v-model="form.end" type="datetime-local" required />
                    </div>
                </div>
                <div class="field">
                    <label for="m-loc">Location or link</label>
                    <input id="m-loc" v-model="form.location" type="text" maxlength="255" />
                </div>
                <div class="field">
                    <label for="m-desc">Description</label>
                    <textarea id="m-desc" v-model="form.description" rows="3"></textarea>
                </div>
                <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" @click="modalOpen = false">Cancel</button>
                    <button type="submit" class="btn">{{ editing ? 'Save changes' : 'Schedule' }}</button>
                </div>
            </form>
        </AppModal>
    </div>
</template>

<script setup>
import { reactive, ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Plus, MapPin, Pencil, Trash2, CalendarDays, NotebookPen, FileText, FileType } from 'lucide-vue-next'
import AppModal from '../components/AppModal.vue'
import EmptyState from '../components/EmptyState.vue'
import DictateButton from '../components/DictateButton.vue'
import ExportMenu from '../components/ExportMenu.vue'
import TranscribeButton from '../components/TranscribeButton.vue'
import { exportMeeting } from '../services/documentService'
import { useMeetingsStore } from '../stores/meetings'
import { formatTime, formatDay, toLocalInput, fromLocalInput, startOfLocalDay } from '../utils/dates'
import { insertAtCursor } from '../utils/text'

const store = useMeetingsStore()

const selectedId = ref(null)
const selected = computed(() => store.items.find(m => m.id === selectedId.value) || null)

onMounted(async () => {
    await store.fetchAll()
    const next = store.upcoming[0] || store.sorted[store.sorted.length - 1]
    if (next && !selectedId.value) select(next)
})

const summary = computed(() => {
    const n = store.upcoming.length
    return n === 0 ? 'Nothing coming up' : `${n} upcoming`
})

function isFinished(m) {
    return new Date(m.endsAt).getTime() < Date.now()
}

function shortDay(iso) {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

const groups = computed(() => {
    const today = startOfLocalDay().getTime()
    const tomorrow = today + 86_400_000
    const buckets = { today: [], upcoming: [], past: [] }

    for (const m of store.sorted) {
        const start = new Date(m.startsAt).getTime()
        if (start >= tomorrow) buckets.upcoming.push(m)
        else if (start >= today) buckets.today.push(m)
        else buckets.past.push(m)
    }
    buckets.past.reverse()

    return [
        { key: 'today', label: 'Today', items: buckets.today },
        { key: 'upcoming', label: 'Upcoming', items: buckets.upcoming },
        { key: 'past', label: 'Past', items: buckets.past }
    ].filter(g => g.items.length > 0)
})

// ---- Export ------------------------------------------------------------------------------------
const exportError = ref('')

// Exports what is on screen, including notes that have not finished autosaving.
const exportItems = computed(() => [
    { label: 'Markdown (.md)', icon: FileText, run: () => { exportError.value = ''; return exportMeeting({ ...selected.value, meetingNotes: draft.value }, 'md') } },
    { label: 'Word (.docx)', icon: FileType, run: () => { exportError.value = ''; return exportMeeting({ ...selected.value, meetingNotes: draft.value }, 'docx') } }
])

// ---- Meeting notes editor (autosave) -------------------------------------------------------
const draft = ref('')
const notesEl = ref(null)
const saveState = ref('idle') // idle | dirty | saving | saved | local
let saveTimer = null
let loadedFor = null

const saveLabel = computed(() => ({
    idle: '',
    dirty: 'Unsaved changes',
    saving: 'Saving…',
    saved: 'Saved',
    local: 'Saved on this device — will sync when online'
}[saveState.value]))

// Load the draft only when switching meetings, so a background refetch never clobbers typing.
watch(selected, (m) => {
    if (m && m.id !== loadedFor) {
        loadedFor = m.id
        draft.value = m.meetingNotes || ''
        saveState.value = 'idle'
    }
    if (!m) loadedFor = null
}, { immediate: true })

function scheduleSave() {
    saveState.value = 'dirty'
    clearTimeout(saveTimer)
    saveTimer = setTimeout(saveNow, 800)
}

async function saveNow() {
    clearTimeout(saveTimer)
    const m = selected.value
    if (!m || saveState.value !== 'dirty') return
    saveState.value = 'saving'
    try {
        const wasOffline = !navigator.onLine || m.id < 0
        await store.update(m.id, { meetingNotes: draft.value })
        saveState.value = wasOffline ? 'local' : 'saved'
    } catch {
        saveState.value = 'dirty'
    }
}

async function select(m) {
    if (m.id === selectedId.value) return
    await saveNow()
    selectedId.value = m.id
}

async function onTranscript(text) {
    const { value, caret } = insertAtCursor(notesEl.value, draft.value, text)
    draft.value = value
    scheduleSave()
    await nextTick()
    notesEl.value?.setSelectionRange(caret, caret)
}

onBeforeUnmount(() => { saveNow() })

// ---- Create / edit dialog -------------------------------------------------------------------
const modalOpen = ref(false)
const editing = ref(null)
const formError = ref('')
const form = reactive({ title: '', start: '', end: '', location: '', description: '' })

function openCreate() {
    const start = new Date()
    start.setMinutes(0, 0, 0)
    start.setHours(start.getHours() + 1)
    const end = new Date(start.getTime() + 60 * 60_000)

    editing.value = null
    formError.value = ''
    Object.assign(form, {
        title: '', start: toLocalInput(start), end: toLocalInput(end), location: '', description: ''
    })
    modalOpen.value = true
}

function openEdit(m) {
    editing.value = m
    formError.value = ''
    Object.assign(form, {
        title: m.title,
        start: toLocalInput(m.startsAt),
        end: toLocalInput(m.endsAt),
        location: m.location || '',
        description: m.description || ''
    })
    modalOpen.value = true
}

async function save() {
    if (new Date(form.end) < new Date(form.start)) {
        formError.value = 'The end time must be after the start time.'
        return
    }
    const payload = {
        title: form.title.trim(),
        startsAt: fromLocalInput(form.start),
        endsAt: fromLocalInput(form.end),
        location: form.location.trim() || null,
        description: form.description.trim() || null
    }
    if (editing.value) {
        await store.update(editing.value.id, payload)
    } else {
        const created = await store.create({ ...payload, meetingNotes: null })
        selectedId.value = created.id
    }
    modalOpen.value = false
}

async function remove(m) {
    if (!window.confirm(`Delete “${m.title}” and its notes?`)) return
    await store.remove(m.id)
    selectedId.value = null
}
</script>

<style scoped>
.layout {
    display: grid;
    grid-template-columns: minmax(280px, 380px) minmax(0, 1fr);
    gap: 1.25rem;
    align-items: start;
}

.agenda { display: flex; flex-direction: column; gap: 1.25rem; }
.group-title {
    margin-bottom: 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
}
.items { display: flex; flex-direction: column; gap: 0.5rem; }

.meeting {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    width: 100%;
    padding: 0.75rem 0.9rem;
    text-align: left;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
}
.meeting:hover { border-color: var(--accent); }
.meeting.active { border-color: var(--accent); background: var(--primary-soft); box-shadow: inset 3px 0 0 var(--accent); }
.meeting.finished .m-title { color: var(--text-muted); }

.when { display: flex; flex-direction: column; min-width: 64px; font-size: 0.8rem; color: var(--text-muted); }
.when strong { color: var(--text); font-size: 0.9rem; }

.info { display: flex; flex-direction: column; gap: 0.15rem; flex: 1; min-width: 0; }
.m-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-loc, .m-day { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; color: var(--text-muted); }
.has-notes { color: var(--primary-text); display: grid; place-items: center; }

.detail { display: flex; flex-direction: column; gap: 1rem; min-height: 320px; }
.detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.detail-head h3 { font-size: 1.25rem; font-weight: 800; }
.loc { display: inline-flex; align-items: center; gap: 0.3rem; margin-top: 0.15rem; }
.detail-actions { display: flex; flex: none; }
.description { color: var(--text-muted); white-space: pre-wrap; }

.notes { display: flex; flex-direction: column; gap: 0.5rem; }
.speech-tools { display: flex; flex-direction: column; gap: 0.6rem; }
.notes-head { display: flex; align-items: center; justify-content: space-between; }
.notes-head label { font-size: 0.85rem; font-weight: 700; }
.save-state { font-size: 0.78rem; color: var(--text-muted); }

.form { display: flex; flex-direction: column; gap: 0.9rem; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.9rem; }
.form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }

@media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
    .grid { grid-template-columns: 1fr; }
}
</style>
