<template>
    <div class="page">
        <div class="page-header">
            <div>
                <h2 class="page-title">Insights</h2>
                <p class="page-sub">{{ rangeLabel }}</p>
            </div>
            <div class="segmented" role="group" aria-label="Time range">
                <button v-for="r in ranges" :key="r.value" type="button" :aria-pressed="range === r.value" @click="range = r.value">
                    {{ r.label }}
                </button>
            </div>
        </div>

        <section class="kpis" aria-label="Key numbers">
            <div v-for="k in kpis" :key="k.label" class="kpi card">
                <span class="kpi-icon" aria-hidden="true"><component :is="k.icon" :size="20" /></span>
                <div>
                    <p class="kpi-value" :class="k.tone">{{ k.value }}</p>
                    <p class="kpi-label">{{ k.label }}</p>
                    <p v-if="k.hint" class="kpi-hint">{{ k.hint }}</p>
                </div>
            </div>
        </section>

        <div class="grid">
            <section class="card" aria-labelledby="c1">
                <h3 id="c1" class="card-title">Todos completed</h3>
                <apexchart v-if="completed.total" :key="chart.key(completedSeriesData, completedOptions.xaxis.categories)" type="bar" height="250" :options="completedOptions" :series="completedSeriesData" />
                <EmptyState v-else :icon="ListChecks" title="Nothing completed in this range" text="Finish a todo and it shows up here." />
            </section>

            <section class="card" aria-labelledby="c2">
                <h3 id="c2" class="card-title">Todos by category</h3>
                <apexchart v-if="categories.length" :key="chart.key(categorySeries, categories)" type="bar" height="250" :options="categoryOptions" :series="categorySeries" />
                <EmptyState v-else :icon="Tags" title="No todos yet" text="Add todos with categories to compare them." />
            </section>

            <section class="card" aria-labelledby="c3">
                <h3 id="c3" class="card-title">Meeting hours</h3>
                <apexchart v-if="meetingTotal > 0" :key="chart.key(meetingSeriesData, meetingOptions.xaxis.categories)" type="bar" height="250" :options="meetingOptions" :series="meetingSeriesData" />
                <EmptyState v-else :icon="CalendarDays" title="No meetings in this range" text="Scheduled meetings add up here." />
            </section>

            <section class="card" aria-labelledby="c4">
                <h3 id="c4" class="card-title">Spending vs limits · {{ monthLabel(thisMonth) }}</h3>
                <apexchart v-if="spendRows.length" :key="chart.key(spendSeries, spendRows, currency)" type="bar" height="250" :options="spendOptions" :series="spendSeries" />
                <EmptyState v-else :icon="Wallet" title="No spending yet" text="Log expenses (and set limits) on the Budget page.">
                    <RouterLink to="/budget" class="btn btn-secondary">Open Budget</RouterLink>
                </EmptyState>
            </section>
        </div>

        <section class="card" aria-labelledby="c5">
            <h3 id="c5" class="card-title">Net cash flow · last 6 months</h3>
            <apexchart :key="chart.key(flowSeries, currency)" type="area" height="260" :options="flowOptions" :series="flowSeries" />
        </section>
    </div>
</template>

<script setup>
import { ref, computed, defineAsyncComponent, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { CheckCheck, Timer, Hourglass, CalendarDays, Wallet, ListChecks, Tags } from 'lucide-vue-next'
import EmptyState from '../components/EmptyState.vue'
import { useTodosStore } from '../stores/todos'
import { useMeetingsStore } from '../stores/meetings'
import { useTransactionsStore } from '../stores/transactions'
import { useBudgetsStore } from '../stores/budgets'
import { useCurrency } from '../composables/useCurrency'
import { useChartTheme } from '../composables/useChartTheme'
import {
    rangeBounds, completedInRange, completedSeries, todosByCategory, onTimeRate, avgDaysToComplete,
    meetingHoursTotal, meetingHoursSeries
} from '../utils/analytics'
import { currentMonthKey, monthLabel, summarize, budgetProgress, expensesByCategory, monthlySeries, fromCents } from '../utils/finance'

const apexchart = defineAsyncComponent(() => import('vue3-apexcharts'))

const todos = useTodosStore()
const meetings = useMeetingsStore()
const transactions = useTransactionsStore()
const budgets = useBudgetsStore()
const { currency, format, formatCompact } = useCurrency()
const chart = useChartTheme()

onMounted(() => {
    todos.fetchAll()
    meetings.fetchAll()
    transactions.fetchAll()
    budgets.fetchAll()
})

const ranges = [
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
    { value: 'month', label: 'This month' }
]
const range = ref(localStorage.getItem('insights_range') || '30d')
const bounds = computed(() => {
    localStorage.setItem('insights_range', range.value)
    return rangeBounds(range.value)
})
const rangeLabel = computed(() => {
    const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const last = new Date(bounds.value.end.getTime() - 86_400_000)
    return `${fmt(bounds.value.start)} – ${fmt(last)}`
})

const thisMonth = currentMonthKey()

// ---- KPIs ---------------------------------------------------------------------------------
const doneInRange = computed(() => completedInRange(todos.items, bounds.value))
const onTime = computed(() => onTimeRate(todos.items, bounds.value))
const avgDays = computed(() => avgDaysToComplete(todos.items, bounds.value))
const hours = computed(() => meetingHoursTotal(meetings.items, bounds.value))
const net = computed(() => summarize(transactions.items, thisMonth).netCents)

const kpis = computed(() => [
    { label: 'Completed', value: doneInRange.value.length, icon: CheckCheck },
    {
        label: 'Finished on time',
        value: onTime.value.rate === null ? '—' : `${Math.round(onTime.value.rate * 100)}%`,
        hint: onTime.value.total ? `${onTime.value.total} with a due date` : 'No due dates in range',
        icon: Timer
    },
    {
        label: 'Avg. time to finish',
        value: avgDays.value === null ? '—' : avgDays.value < 1 ? '< 1 day' : `${avgDays.value.toFixed(1)} days`,
        icon: Hourglass
    },
    { label: 'Meeting hours', value: `${hours.value.toFixed(1)} h`, icon: CalendarDays },
    { label: `Net · ${monthLabel(thisMonth, { month: 'short' })}`, value: format(fromCents(net.value)), tone: net.value < 0 ? 'negative' : '', icon: Wallet }
])

// ---- charts -------------------------------------------------------------------------------
function bucketLabels(buckets, weekly) {
    return buckets.map(b => b.date.toLocaleDateString(undefined, weekly
        ? { month: 'short', day: 'numeric' }
        : { weekday: 'short', day: 'numeric' }))
}

// A category axis draws every label, so only every Nth is kept; the tooltip still shows the full one.
function sparse(labels, max = 7) {
    const step = Math.max(1, Math.ceil(labels.length / max))
    return labels.map((label, i) => (i % step === 0 ? label : ''))
}

const completed = computed(() => {
    const s = completedSeries(todos.items, bounds.value)
    return { ...s, total: s.buckets.reduce((sum, b) => sum + b.value, 0) }
})
const completedSeriesData = computed(() => [{ name: 'Completed', data: completed.value.buckets.map(b => b.value) }])
const completedOptions = computed(() => {
    const labels = bucketLabels(completed.value.buckets, completed.value.weekly)
    return chart.options({
        colors: [chart.colors.value.primary],
        xaxis: { categories: sparse(labels), labels: { rotate: 0 }, tooltip: { enabled: false } },
        yaxis: { labels: { formatter: (v) => Math.round(v) }, forceNiceScale: true, decimalsInFloat: 0 },
        plotOptions: { bar: { borderRadius: 3, columnWidth: '60%' } },
        tooltip: {
            x: { formatter: (_, { dataPointIndex }) => labels[dataPointIndex] },
            y: { formatter: (v) => `${v} todo${v === 1 ? '' : 's'}` }
        }
    })
})

const categories = computed(() => todosByCategory(todos.items))
const categorySeries = computed(() => [
    { name: 'Open', data: categories.value.map(c => c.open) },
    { name: 'Done', data: categories.value.map(c => c.done) }
])
const categoryOptions = computed(() => chart.options({
    colors: [chart.colors.value.warning, chart.colors.value.primary],
    chart: { stacked: true },
    plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: '60%' } },
    xaxis: { categories: categories.value.map(c => c.name), labels: { formatter: (v) => Math.round(v) }, stepSize: 1, decimalsInFloat: 0 }
}))

const meetingTotal = computed(() => hours.value)
const meetingSeries = computed(() => meetingHoursSeries(meetings.items, bounds.value))
const meetingSeriesData = computed(() => [{ name: 'Hours', data: meetingSeries.value.buckets.map(b => Math.round(b.value * 10) / 10) }])
const meetingOptions = computed(() => {
    const labels = bucketLabels(meetingSeries.value.buckets, meetingSeries.value.weekly)
    return chart.options({
        colors: [chart.colors.value.soft],
        xaxis: { categories: sparse(labels), labels: { rotate: 0 }, tooltip: { enabled: false } },
        yaxis: { labels: { formatter: (v) => `${Math.round(v * 10) / 10} h` } },
        plotOptions: { bar: { borderRadius: 3, columnWidth: '60%' } },
        tooltip: {
            x: { formatter: (_, { dataPointIndex }) => labels[dataPointIndex] },
            y: { formatter: (v) => `${v} h` }
        }
    })
})

// Spending vs limit per category for the current month (categories with a limit or any spend).
const spendRows = computed(() => {
    const spent = expensesByCategory(transactions.items, thisMonth)
    const limits = budgetProgress(budgets.items, transactions.items, thisMonth)
    const names = new Map()
    for (const s of spent) names.set(s.category.toLowerCase(), { category: s.category, spent: fromCents(s.cents), limit: null })
    for (const l of limits) {
        const key = l.category.toLowerCase()
        const row = names.get(key) || { category: l.category, spent: 0, limit: null }
        row.limit = fromCents(l.limitCents)
        names.set(key, row)
    }
    return [...names.values()].sort((a, b) => b.spent - a.spent).slice(0, 8)
})
const spendSeries = computed(() => [
    { name: 'Spent', data: spendRows.value.map(r => r.spent) },
    { name: 'Limit', data: spendRows.value.map(r => r.limit ?? 0) }
])
const spendOptions = computed(() => chart.options({
    colors: [chart.colors.value.expense, chart.colors.value.muted],
    xaxis: { categories: spendRows.value.map(r => r.category), labels: { rotate: -30, trim: true } },
    yaxis: { labels: { formatter: (v) => formatCompact(v) } },
    plotOptions: { bar: { borderRadius: 3, columnWidth: '60%' } },
    tooltip: { y: { formatter: (v) => format(v) } }
}))

const flow = computed(() => monthlySeries(transactions.items, thisMonth, 6))
const flowSeries = computed(() => [{ name: 'Net', data: flow.value.map(m => fromCents(m.netCents)) }])
const flowOptions = computed(() => chart.options({
    colors: [chart.colors.value.primary],
    stroke: { curve: 'smooth', width: 3 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.02 } },
    xaxis: { categories: flow.value.map(m => m.label) },
    yaxis: { labels: { formatter: (v) => formatCompact(v) } },
    tooltip: { y: { formatter: (v) => format(v) } }
}))
</script>

<style scoped>
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 1rem; }
.kpi { display: flex; align-items: center; gap: 0.9rem; padding: 1rem; }
.kpi-icon { display: grid; place-items: center; width: 42px; height: 42px; flex: none; color: var(--primary-text); background: var(--primary-soft); border-radius: var(--radius); }
.kpi-value { font-size: 1.5rem; font-weight: 800; line-height: 1.15; font-variant-numeric: tabular-nums; }
.kpi-value.negative { color: var(--danger); }
.kpi-label { font-size: 0.8rem; color: var(--text-muted); }
.kpi-hint { font-size: 0.72rem; color: var(--text-faint); }

.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; }

@media (max-width: 900px) {
    .grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
