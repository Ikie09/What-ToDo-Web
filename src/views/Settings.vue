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

        <section class="card" aria-labelledby="money">
            <h3 id="money" class="card-title">Money</h3>
            <div class="row">
                <div class="field currency">
                    <label for="currency">Currency</label>
                    <select id="currency" :value="currency" @change="setCurrency($event.target.value)">
                        <option v-for="o in currencies" :key="o.code" :value="o.code">{{ o.label }}</option>
                    </select>
                </div>
                <p class="muted small">Example: <strong>{{ format(1234.5) }}</strong>. This only changes how amounts are shown on this device — nothing is converted.</p>
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

                <div v-if="reminders.active || push.active" class="row">
                    <div class="field lead">
                        <label for="lead">Remind me before a meeting</label>
                        <select id="lead" :value="reminders.leadMinutes" @change="reminders.setLeadMinutes(Number($event.target.value))">
                            <option v-for="m in [5, 10, 15, 30, 60]" :key="m" :value="m">{{ m }} minutes</option>
                        </select>
                    </div>
                    <button v-if="reminders.active && !push.active" type="button" class="btn btn-secondary" @click="reminders.sendTest()">Send a test</button>
                </div>
            </template>

            <div class="push" aria-labelledby="push-title">
                <div class="row">
                    <div>
                        <p id="push-title" class="row-title">Push notifications <span class="badge badge-muted">Works when the app is closed</span></p>
                        <p class="muted small" role="status">{{ pushStatus }}</p>
                    </div>
                    <button v-if="!push.subscribed" type="button" class="btn" :disabled="!pushCanToggle || push.busy" @click="turnOnPush">
                        <BellRing :size="16" aria-hidden="true" /> {{ push.busy ? 'Turning on…' : 'Turn on' }}
                    </button>
                    <button v-else type="button" class="btn btn-secondary" :disabled="push.busy" @click="push.disable()">
                        <BellOff :size="16" aria-hidden="true" /> Turn off
                    </button>
                </div>

                <div v-if="push.subscribed" class="row">
                    <p class="muted small">Todos are announced at 08:00 on the due date (and once the next morning if still open); meetings shortly before they start.</p>
                    <button type="button" class="btn btn-secondary" @click="sendPushTest">Send a test push</button>
                </div>

                <p v-if="pushMessage" class="status" role="status">{{ pushMessage }}</p>
                <p v-if="push.error" class="status error" role="alert">{{ push.error }}</p>
            </div>

            <p class="muted small note">
                While push is on for this device, the in-app alerts pause here so you are not notified twice. Push is sent by your server, so it only arrives while the API is running.
            </p>
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
                        <button type="button" class="btn btn-secondary" :disabled="busy" @click="run('Transactions CSV', exportTransactionsCsv)">
                            <Table :size="16" aria-hidden="true" /> Transactions (CSV)
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
                        <button type="button" class="btn btn-secondary" :disabled="busy" @click="run('Budget PDF', () => exportPdf('budget'))">
                            <FileText :size="16" aria-hidden="true" /> This month's budget (PDF)
                        </button>
                    </div>
                    <div class="btn-row">
                        <button type="button" class="btn btn-secondary" :disabled="busy" @click="run('Notes Markdown', () => exportAllNotes('md'))">
                            <FileText :size="16" aria-hidden="true" /> Notes (.md)
                        </button>
                        <button type="button" class="btn btn-secondary" :disabled="busy" @click="run('Notes Word', () => exportAllNotes('docx'))">
                            <FileType :size="16" aria-hidden="true" /> Notes (.docx)
                        </button>
                        <button type="button" class="btn btn-secondary" :disabled="busy" @click="run('Meeting notes Markdown', () => exportAllMeetingNotes('md'))">
                            <FileText :size="16" aria-hidden="true" /> Meeting notes (.md)
                        </button>
                        <button type="button" class="btn btn-secondary" :disabled="busy" @click="run('Meeting notes Word', () => exportAllMeetingNotes('docx'))">
                            <FileType :size="16" aria-hidden="true" /> Meeting notes (.docx)
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
                        <button type="button" class="btn btn-secondary" :disabled="busy" @click="txCsvInput.click()">
                            <Upload :size="16" aria-hidden="true" /> Import transactions (CSV)
                        </button>
                        <button type="button" class="btn btn-secondary" :disabled="busy" @click="docInput.click()">
                            <Upload :size="16" aria-hidden="true" /> Import notes (.md, .txt, .docx)
                        </button>
                    </div>
                    <input ref="txCsvInput" type="file" accept="text/csv,.csv" class="sr-only" tabindex="-1" aria-label="Choose a transactions CSV file" @change="onFile($event, 'Transactions import', importTransactionsCsv)" />
                    <input ref="docInput" type="file" multiple accept=".md,.markdown,.txt,.docx" class="sr-only" tabindex="-1" aria-label="Choose Markdown, text or Word files to import as notes" @change="onFile($event, 'Notes import', importDocuments, true)" />
                    <input ref="jsonInput" type="file" accept="application/json,.json" class="sr-only" tabindex="-1" aria-label="Choose a JSON backup file" @change="onFile($event, 'Backup import', importJson)" />
                    <input ref="csvInput" type="file" accept="text/csv,.csv" class="sr-only" tabindex="-1" aria-label="Choose a CSV file" @change="onFile($event, 'CSV import', importTodosCsv)" />
                    <p class="muted small">Todo CSV columns: title, notes, status, priority, dueDate (YYYY-MM-DD), category. Transaction CSV columns: date (YYYY-MM-DD), type (Income/Expense), amount, category, note. Each imported .md/.txt/.docx file becomes one note.</p>
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
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Monitor, Sun, Moon, Bell, BellOff, BellRing, FileJson, FileText, FileType, Table, Upload, LogOut } from 'lucide-vue-next'
import { useTheme } from '../composables/useTheme'
import { useCurrency, currencyOptions } from '../composables/useCurrency'
import { useRemindersStore } from '../stores/reminders'
import { usePushStore } from '../stores/push'
import { useAuthStore } from '../stores/auth'
import {
    exportJson, importJson, exportTodosCsv, importTodosCsv, exportTransactionsCsv, importTransactionsCsv, exportPdf
} from '../services/exportService'
import { exportAllNotes, exportAllMeetingNotes, importDocuments } from '../services/documentService'

const { mode, setMode } = useTheme()
const { currency, setCurrency, format } = useCurrency()
const currencies = currencyOptions()
const reminders = useRemindersStore()
const push = usePushStore()
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

// ---- push ---------------------------------------------------------------------------------
const pushMessage = ref('')

const pushCanToggle = computed(() => push.available || (push.supported && push.hasServiceWorker && push.serverEnabled && push.permission === 'default'))

const pushStatus = computed(() => {
    if (push.needsHomeScreen && !push.supported) return 'On iPhone/iPad, add this app to your Home Screen first (Share → Add to Home Screen), then open it from there.'
    if (!push.supported) return 'This browser does not support push notifications.'
    if (!push.hasServiceWorker) return 'Push needs the installed app or the production build — no service worker is active here (they are off during npm run dev and in some embedded browsers).'
    if (!push.serverEnabled) return 'Push is not set up on the server yet (the API needs VAPID keys — see its README).'
    if (push.permission === 'denied') return 'Notifications are blocked for this site. Allow them in your browser settings, then come back.'
    if (push.subscribed) return 'On for this device — reminders arrive even when the app is closed.'
    return 'Off. Turn it on to get due-todo and meeting reminders when the app is closed.'
})

async function turnOnPush() {
    pushMessage.value = ''
    if (await push.enable()) {
        const result = await push.sendTest()
        pushMessage.value = result?.sent ? 'Push is on — a test notification was sent.' : ''
    }
}

async function sendPushTest() {
    pushMessage.value = ''
    const result = await push.sendTest()
    if (result?.sent) pushMessage.value = 'Test notification sent.'
    else if (result) pushMessage.value = 'The test could not be delivered — try turning push off and on again.'
}

const busy = ref(false)
const message = ref('')
const messageIsError = ref(false)
const jsonInput = ref(null)
const csvInput = ref(null)
const txCsvInput = ref(null)
const docInput = ref(null)

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

// Copy the files out first: resetting the input empties its (live) FileList.
async function onFile(event, label, fn, multiple = false) {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    if (files.length) await run(label, () => (multiple ? fn(files) : fn(files[0])))
}
</script>

<style scoped>
.theme-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; }
.currency { min-width: min(320px, 100%); }
.push { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border); }
.push .status { margin-top: 0.5rem; }

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
