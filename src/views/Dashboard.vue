<template>
    <div class="page">
        <div class="page-header">
            <div>
                <h2 class="page-title">{{ greeting }}</h2>
                <p class="page-sub">{{ today }}</p>
            </div>
            <RouterLink to="/todos" class="btn"><Plus :size="18" aria-hidden="true" /> Add a todo</RouterLink>
        </div>

        <section class="stats" aria-label="Summary">
            <div v-for="s in stats" :key="s.label" class="stat card">
                <span class="stat-icon" :class="s.tone" aria-hidden="true"><component :is="s.icon" :size="20" /></span>
                <div>
                    <p class="stat-value">{{ s.value }}</p>
                    <p class="stat-label">{{ s.label }}</p>
                </div>
            </div>
        </section>

        <div class="grid">
            <section class="card">
                <h3 class="card-title">Progress</h3>
                <div class="progress" role="progressbar" :aria-valuenow="progressPct" aria-valuemin="0" aria-valuemax="100" aria-label="Todos completed">
                    <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
                </div>
                <p class="muted progress-text">{{ todos.completedCount }} of {{ todos.openCount + todos.completedCount }} todos done ({{ progressPct }}%)</p>

                <h3 class="card-title chart-title">Open todos by priority</h3>
                <apexchart v-if="todos.openCount > 0" type="donut" height="240" :options="chartOptions" :series="chartSeries" />
                <EmptyState v-else :icon="ListChecks" title="All clear" text="No open todos right now." />
            </section>

            <div class="stack">
                <section class="card">
                    <div class="card-head">
                        <h3 class="card-title">Upcoming meetings</h3>
                        <RouterLink to="/meetings">View all</RouterLink>
                    </div>
                    <EmptyState v-if="nextMeetings.length === 0" :icon="CalendarDays" title="No meetings coming up" text="Scheduled meetings will show here." />
                    <ul v-else class="meetings">
                        <li v-for="m in nextMeetings" :key="m.id">
                            <span class="m-date" aria-hidden="true">
                                <strong>{{ new Date(m.startsAt).getDate() }}</strong>
                                {{ new Date(m.startsAt).toLocaleDateString(undefined, { month: 'short' }) }}
                            </span>
                            <span class="m-info">
                                <span class="m-title">{{ m.title }}</span>
                                <span class="muted">{{ formatTime(m.startsAt) }} – {{ formatTime(m.endsAt) }}<template v-if="m.location"> · {{ m.location }}</template></span>
                            </span>
                        </li>
                    </ul>
                </section>

                <section class="card">
                    <div class="card-head">
                        <h3 class="card-title">Spending · {{ monthLabel(thisMonth) }}</h3>
                        <RouterLink to="/budget">Open budget</RouterLink>
                    </div>
                    <EmptyState v-if="spend.expenseCents === 0 && budgetTotalCents === 0" :icon="Wallet" title="No spending yet" text="Log an expense to track your month." />
                    <template v-else>
                        <p class="spend-total">{{ money(spend.expenseCents) }}
                            <span v-if="budgetTotalCents" class="muted"> of {{ money(budgetTotalCents) }} budgeted</span>
                        </p>
                        <div v-if="budgetTotalCents" class="progress" role="progressbar" :aria-valuenow="spendPct" aria-valuemin="0" aria-valuemax="100" aria-label="Budget used this month">
                            <div class="progress-fill" :class="{ over: spendPct >= 100 }" :style="{ width: Math.min(100, spendPct) + '%' }"></div>
                        </div>
                        <p class="muted progress-text">Income {{ money(spend.incomeCents) }} · Net {{ money(spend.netCents) }}</p>
                    </template>
                </section>
            </div>
        </div>

        <section class="card">
            <h3 class="card-title">Recent activity</h3>
            <EmptyState v-if="activity.length === 0" :icon="Activity" title="Nothing yet" text="Create a todo, note or meeting and it will appear here." />
            <ul v-else class="feed">
                <li v-for="a in activity" :key="a.key">
                    <span class="feed-icon" aria-hidden="true"><component :is="a.icon" :size="16" /></span>
                    <span class="feed-text"><strong>{{ a.kind }}</strong> {{ a.title }}</span>
                    <time class="muted" :datetime="a.at">{{ formatDateTime(a.at) }}</time>
                </li>
            </ul>
        </section>
    </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { Plus, ListChecks, CheckCheck, AlarmClock, StickyNote, CalendarDays, Activity, Wallet } from 'lucide-vue-next'
import EmptyState from '../components/EmptyState.vue'
import { useAuthStore } from '../stores/auth'
import { useTodosStore } from '../stores/todos'
import { useNotesStore } from '../stores/notes'
import { useMeetingsStore } from '../stores/meetings'
import { useCategoriesStore } from '../stores/categories'
import { useTransactionsStore } from '../stores/transactions'
import { useBudgetsStore } from '../stores/budgets'
import { useChartTheme } from '../composables/useChartTheme'
import { useCurrency } from '../composables/useCurrency'
import { formatTime, formatDateTime } from '../utils/dates'
import { currentMonthKey, monthLabel, summarize, toCents, fromCents } from '../utils/finance'

// Charts are only needed here, so keep the library out of the main bundle.
const apexchart = defineAsyncComponent(() => import('vue3-apexcharts'))

const auth = useAuthStore()
const todos = useTodosStore()
const notes = useNotesStore()
const meetings = useMeetingsStore()
const categories = useCategoriesStore()
const transactions = useTransactionsStore()
const budgets = useBudgetsStore()
const chart = useChartTheme()
const { format } = useCurrency()

onMounted(() => {
    todos.fetchAll()
    notes.fetchAll()
    meetings.fetchAll()
    categories.fetchAll()
    transactions.fetchAll()
    budgets.fetchAll()
})

const thisMonth = currentMonthKey()
const money = (cents) => format(fromCents(cents))
const spend = computed(() => summarize(transactions.items, thisMonth))
const budgetTotalCents = computed(() => budgets.items.reduce((sum, b) => sum + toCents(b.monthlyLimit), 0))
const spendPct = computed(() => budgetTotalCents.value ? Math.round((spend.value.expenseCents / budgetTotalCents.value) * 100) : 0)

const greeting = computed(() => {
    const hour = new Date().getHours()
    const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
    const name = auth.user?.email?.split('@')[0]
    return name ? `${part}, ${name}` : part
})

const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

const stats = computed(() => [
    { label: 'Open todos', value: todos.openCount, icon: ListChecks, tone: 'tone-green' },
    { label: 'Done', value: todos.completedCount, icon: CheckCheck, tone: 'tone-green' },
    { label: 'Overdue', value: todos.overdueCount, icon: AlarmClock, tone: todos.overdueCount ? 'tone-red' : 'tone-green' },
    { label: 'Upcoming meetings', value: meetings.upcoming.length, icon: CalendarDays, tone: 'tone-green' },
    { label: 'Notes', value: notes.items.length, icon: StickyNote, tone: 'tone-green' }
])

const progressPct = computed(() => {
    const total = todos.openCount + todos.completedCount
    return total === 0 ? 0 : Math.round((todos.completedCount / total) * 100)
})

const nextMeetings = computed(() => meetings.upcoming.slice(0, 4))

const chartSeries = computed(() => {
    const p = todos.byPriority
    return [p.High || 0, p.Medium || 0, p.Low || 0]
})

const chartOptions = computed(() => {
    const c = chart.colors.value
    return chart.options({
        labels: ['High', 'Medium', 'Low'],
        colors: [c.danger, c.warning, c.soft],
        stroke: { width: 2, colors: [c.surface] },
        plotOptions: { pie: { donut: { size: '68%' } } }
    })
})

const activity = computed(() => {
    const rows = [
        ...todos.items.map(t => ({ key: `t${t.id}`, kind: t.status === 'Done' ? 'Completed' : 'Todo', title: t.title, at: t.updatedAt || t.createdAt, icon: ListChecks })),
        ...notes.items.map(n => ({ key: `n${n.id}`, kind: 'Note', title: n.title, at: n.updatedAt, icon: StickyNote })),
        ...meetings.items.map(m => ({ key: `m${m.id}`, kind: 'Meeting', title: m.title, at: m.updatedAt, icon: CalendarDays }))
    ]
    return rows.filter(r => r.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8)
})
</script>

<style scoped>
.stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 1rem;
}

.stat { display: flex; align-items: center; gap: 0.9rem; padding: 1rem; }
.stat-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: var(--radius); }
.tone-green { color: var(--primary-text); background: var(--primary-soft); }
.tone-red { color: var(--danger); background: var(--danger-soft); }
.stat-value { font-size: 1.6rem; font-weight: 800; line-height: 1.1; }
.stat-label { font-size: 0.8rem; color: var(--text-muted); }

.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; align-items: start; }
.stack { display: flex; flex-direction: column; gap: 1.25rem; }
.spend-total { margin-bottom: 0.6rem; font-size: 1.5rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.spend-total .muted { font-size: 0.85rem; font-weight: 500; }
.progress-fill.over { background: var(--danger); }

.card-head { display: flex; align-items: baseline; justify-content: space-between; }
.card-head .card-title { margin-bottom: 1rem; }
.chart-title { margin-top: 1.5rem; }

.progress { height: 12px; overflow: hidden; background: var(--surface-3); border-radius: 999px; }
.progress-fill { height: 100%; background: linear-gradient(90deg, var(--jg-500), var(--jg-400)); border-radius: 999px; transition: width 0.4s ease; }
.progress-text { margin-top: 0.5rem; font-size: 0.85rem; }

.meetings { display: flex; flex-direction: column; gap: 0.75rem; }
.meetings li { display: flex; align-items: center; gap: 0.85rem; }
.m-date {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 46px;
    padding: 0.35rem 0;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--primary-text);
    background: var(--primary-soft);
    border-radius: var(--radius-sm);
}
.m-date strong { font-size: 1.1rem; line-height: 1.1; }
.m-info { display: flex; flex-direction: column; min-width: 0; font-size: 0.85rem; }
.m-title { font-weight: 600; font-size: 0.95rem; }

.feed { display: flex; flex-direction: column; }
.feed li { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0; border-top: 1px solid var(--border); }
.feed li:first-child { border-top: 0; }
.feed-icon { display: grid; place-items: center; width: 30px; height: 30px; color: var(--primary-text); background: var(--primary-soft); border-radius: 50%; flex: none; }
.feed-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.feed time { font-size: 0.78rem; white-space: nowrap; }

@media (max-width: 900px) {
    .grid { grid-template-columns: minmax(0, 1fr); }
    .feed time { display: none; }
}
</style>
