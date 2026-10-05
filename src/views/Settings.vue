<template>
    <div class="page">
        <div class="page-header">
            <div>
                <h2 class="page-title">Settings</h2>
                <p class="page-sub">Appearance, reminders and your data.</p>
            </div>
        </div>

        <section class="card" aria-labelledby="appearance">
            <h3 id="appearance" class="card-title">Appearance</h3>
            <div class="theme-options" role="radiogroup" aria-label="Theme">
                <label v-for="o in themeOptions" :key="o.value" class="theme-option" :class="{ selected: mode === o.value }">
                    <input type="radio" name="theme" class="sr-only" :value="o.value" :checked="mode === o.value" @change="setMode(o.value)" />
                    <component :is="o.icon" :size="22" aria-hidden="true" />
                    <span class="o-label">{{ o.label }}</span>
                    <span class="o-hint">{{ o.hint }}</span>
                </label>
            </div>
        </section>

        <section class="card" aria-labelledby="reminders">
            <h3 id="reminders" class="card-title">Reminders</h3>

            <p v-if="!reminders.supported" class="muted">This browser does not support notifications.</p>
            <template v-else>
                <div class="row">
                    <div>
                        <p class="row-title">Notify me about due todos and meetings</p>
                        <p class="muted small">
                            <template v-if="reminders.permission === 'denied'">Notifications are blocked for this site. Allow them in your browser's site settings, then come back.</template>
                            <template v-else-if="reminders.active">On — you'll be notified on the due date and shortly before meetings.</template>
                            <template v-else>Off</template>
                        </p>
                    </div>
                    <button
                        v-if="!reminders.enabled"
                        type="button"
                        class="btn"
                        :disabled="reminders.permission === 'denied'"
                        @click="turnOn"
                    >
                        <Bell :size="16" aria-hidden="true" /> Turn on
                    </button>
                    <button v-else type="button" class="btn btn-secondary" @click="reminders.disable()">
                        <BellOff :size="16" aria-hidden="true" /> Turn off
                    </button>
                </div>

                <div v-if="reminders.active" class="row">
                    <div class="field lead">
                        <label for="lead">Remind me before a meeting</label>
                        <select id="lead" :value="reminders.leadMinutes" @change="reminders.setLeadMinutes(Number($event.target.value))">
                            <option v-for="m in [5, 10, 15, 30, 60]" :key="m" :value="m">{{ m }} minutes</option>
                        </select>
                    </div>
                    <button type="button" class="btn btn-secondary" @click="reminders.sendTest()">Send a test</button>
                </div>

                <p class="muted small note">
                    Reminders are delivered while the app is open or installed on this device. Alerts when the app is fully closed need push notifications, which are planned.
                </p>
            </template>
        </section>

        <section class="card" aria-labelledby="data">
            <h3 id="data" class="card-title">Your data</h3>

            <div class="data-grid">
                <div>
                    <h4>Export</h4>
                    <div class="btn-row">
                        <button type="button" class="btn btn-secondary" :disabled="busy" @click="run('JSON backup', exportJson)">
                            <FileJson :size="16" aria-hidden="true" /> Full backup (JSON)
                        </button>
                        <button type="button" class="btn btn-secondary" :disabled="busy" @click="run('Todos CSV', exportTodosCsv)">
                            <Table :size="16" aria-hidden="true" /> Todos (CSV)
                        </button>
                    </div>
                    <div class="btn-row">
                        <button type="button" class="btn btn-secondary" :disabled="busy" @click="run('Todos PDF', () => exportPdf('todos'))">
                            <FileText :size="16" aria-hidden="true" /> Todos (PDF)
                        </button>
                        <button type="button" class="btn btn-secondary" :disabled="busy" @click="run('Notes PDF', () => exportPdf('notes'))">
                            <FileText :size="16" aria-hidden="true" /> Notes (PDF)
                        </button>
                        <button type="button" class="btn btn-secondary" :disabled="busy" @click="run('Meetings PDF', () => exportPdf('meetings'))">
                            <FileText :size="16" aria-hidden="true" /> Meetings (PDF)
                        </button>
                    </div>
                </div>

                <div>
                    <h4>Import</h4>
                    <p class="muted small">Imported items are added as new — nothing existing is changed.</p>
                    <div class="btn-row">
                        <button type="button" class="btn btn-secondary" :disabled="busy" @click="jsonInput.click()">
                            <Upload :size="16" aria-hidden="true" /> Restore backup (JSON)
                        </button>
                        <button type="button" class="btn btn-secondary" :disabled="busy" @click="csvInput.click()">
                            <Upload :size="16" aria-hidden="true" /> Import todos (CSV)
                        </button>
                    </div>
                    <input ref="jsonInput" type="file" accept="application/json,.json" class="sr-only" tabindex="-1" aria-label="Choose a JSON backup file" @change="onFile($event, 'Backup import', importJson)" />
                    <input ref="csvInput" type="file" accept="text/csv,.csv" class="sr-only" tabindex="-1" aria-label="Choose a CSV file" @change="onFile($event, 'CSV import', importTodosCsv)" />
                    <p class="muted small">CSV columns: title, notes, status, priority, dueDate (YYYY-MM-DD), category.</p>
                </div>
            </div>

            <p v-if="message" class="status" :class="{ error: messageIsError }" :role="messageIsError ? 'alert' : 'status'">{{ message }}</p>
        </section>

        <section class="card" aria-labelledby="account">
            <h3 id="account" class="card-title">Account</h3>
            <div class="row">
                <p>Signed in as <strong>{{ auth.user?.email }}</strong></p>
                <RouterLink to="/auth/logout" class="btn btn-danger"><LogOut :size="16" aria-hidden="true" /> Log out</RouterLink>
            </div>
        </section>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Monitor, Sun, Moon, Bell, BellOff, FileJson, FileText, Table, Upload, LogOut } from 'lucide-vue-next'
import { useTheme } from '../composables/useTheme'
import { useRemindersStore } from '../stores/reminders'
import { useAuthStore } from '../stores/auth'
import { exportJson, importJson, exportTodosCsv, importTodosCsv, exportPdf } from '../services/exportService'

const { mode, setMode } = useTheme()
const reminders = useRemindersStore()
const auth = useAuthStore()

const themeOptions = [
    { value: 'system', label: 'System', hint: 'Match my device', icon: Monitor },
    { value: 'light', label: 'Light', hint: 'Always light', icon: Sun },
    { value: 'dark', label: 'Dark', hint: 'Easy on the eyes', icon: Moon }
]

async function turnOn() {
    const ok = await reminders.enable()
    if (ok) reminders.sendTest()
}

const busy = ref(false)
const message = ref('')
const messageIsError = ref(false)
const jsonInput = ref(null)
const csvInput = ref(null)

function describe(result) {
    if (typeof result === 'number') return `${result} item${result === 1 ? '' : 's'}`
    if (result && typeof result === 'object') {
        return Object.entries(result).map(([k, v]) => `${v} ${k}`).join(', ')
    }
    return ''
}

async function run(label, fn) {
    busy.value = true
    message.value = ''
    try {
        const result = await fn()
        messageIsError.value = false
        message.value = `${label} done — ${describe(result)}.`
    } catch (err) {
        messageIsError.value = true
        message.value = err.response?.data?.message || err.message || `${label} failed.`
    } finally {
        busy.value = false
    }
}

async function onFile(event, label, fn) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) await run(label, () => fn(file))
}
</script>

<style scoped>
.theme-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; }

.theme-option {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
    padding: 0.9rem;
    color: var(--text-muted);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    cursor: pointer;
}
.theme-option:hover { border-color: var(--accent); }
.theme-option:has(input:focus-visible) { outline: 2px solid var(--ring); outline-offset: 2px; }
.theme-option.selected { color: var(--primary-text); background: var(--primary-soft); border-color: var(--accent); }
.o-label { margin-top: 0.3rem; font-weight: 700; color: var(--text); }
.o-hint { font-size: 0.78rem; }

.row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding: 0.4rem 0; }
.row-title { font-weight: 600; }
.small { font-size: 0.82rem; }
.note { margin-top: 0.75rem; }
.lead { min-width: 220px; }

.data-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem; }
.data-grid h4 { margin-bottom: 0.5rem; font-size: 0.9rem; }
.btn-row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem; }

.status {
    margin-top: 1rem;
    padding: 0.6rem 0.8rem;
    font-size: 0.88rem;
    color: var(--primary-text);
    background: var(--primary-soft);
    border-radius: var(--radius-sm);
}
.status.error { color: var(--danger); background: var(--danger-soft); }

@media (max-width: 700px) {
    .theme-options { grid-template-columns: 1fr; }
    .data-grid { grid-template-columns: 1fr; }
}
</style>
