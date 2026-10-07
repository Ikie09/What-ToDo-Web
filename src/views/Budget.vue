<template>
    <div class="page">
        <div class="page-header">
            <div>
                <h2 class="page-title">Budget</h2>
                <p class="page-sub">{{ summary.count }} transaction{{ summary.count === 1 ? '' : 's' }} in {{ monthLabel(month) }}</p>
            </div>

            <div class="header-actions">
                <div class="month-nav" role="group" aria-label="Month">
                    <button type="button" class="icon-btn" aria-label="Previous month" @click="month = shiftMonth(month, -1)">
                        <ChevronLeft :size="18" aria-hidden="true" />
                    </button>
                    <span class="month-label" aria-live="polite">{{ monthLabel(month) }}</span>
                    <button type="button" class="icon-btn" aria-label="Next month" @click="month = shiftMonth(month, 1)">
                        <ChevronRight :size="18" aria-hidden="true" />
                    </button>
                </div>
                <button v-if="month !== thisMonth" type="button" class="btn btn-ghost btn-sm" @click="month = thisMonth">This month</button>
                <button type="button" class="btn btn-secondary" @click="openLimits">
                    <Target :size="16" aria-hidden="true" /> Monthly limits
                </button>
                <button type="button" class="btn" @click="openCreate('Expense')">
                    <Plus :size="18" aria-hidden="true" /> Add transaction
                </button>
            </div>
        </div>

        <p v-if="txStore.error" class="form-error" role="alert">{{ txStore.error }}</p>

        <section class="stats" aria-label="Month summary">
            <div class="stat card">
                <span class="stat-icon income" aria-hidden="true"><ArrowDownLeft :size="20" /></span>
                <div><p class="stat-value">{{ money(summary.incomeCents) }}</p><p class="stat-label">Income</p></div>
            </div>
            <div class="stat card">
                <span class="stat-icon expense" aria-hidden="true"><ArrowUpRight :size="20" /></span>
                <div><p class="stat-value">{{ money(summary.expenseCents) }}</p><p class="stat-label">Expenses</p></div>
            </div>
            <div class="stat card">
                <span class="stat-icon" :class="summary.netCents < 0 ? 'expense' : 'income'" aria-hidden="true"><Scale :size="20" /></span>
                <div>
                    <p class="stat-value" :class="{ negative: summary.netCents < 0 }">{{ money(summary.netCents) }}</p>
                    <p class="stat-label">Net</p>
                </div>
            </div>
            <div class="stat card">
                <span class="stat-icon income" aria-hidden="true"><PiggyBank :size="20" /></span>
                <div>
                    <p class="stat-value">{{ summary.savingsRate === null ? '—' : Math.round(summary.savingsRate * 100) + '%' }}</p>
                    <p class="stat-label">Savings rate</p>
                </div>
            </div>
        </section>

        <div class="grid">
            <section class="card" aria-labelledby="limits-title">
                <div class="card-head">
                    <h3 id="limits-title" class="card-title">Monthly limits</h3>
                    <button v-if="progress.length" type="button" class="btn btn-ghost btn-sm" @click="openLimits">Edit</button>
                </div>
                <EmptyState
                    v-if="progress.length === 0"
                    :icon="Target"
                    title="No limits yet"
                    text="Set a monthly limit per category to see how much you have left."
                >
                    <button type="button" class="btn btn-secondary" @click="openLimits">Set limits</button>
                </EmptyState>
                <ul v-else class="limits">
                    <li v-for="p in progress" :key="p.id">
                        <div class="limit-row">
                            <span class="limit-name">{{ p.category }}</span>
                            <span class="limit-amount" :class="p.status">
                                {{ money(p.spentCents) }} <span class="muted">of {{ money(p.limitCents) }}</span>
                            </span>
                        </div>
                        <div
                            class="bar"
                            role="progressbar"
                            :aria-valuenow="Math.min(100, Math.round(p.pct * 100))"
                            aria-valuemin="0"
                            aria-valuemax="100"
                            :aria-label="`${p.category} budget used`"
                        >
                            <div class="bar-fill" :class="p.status" :style="{ width: Math.min(100, p.pct * 100) + '%' }"></div>
                        </div>
                        <p class="limit-note" :class="p.status">
                            {{ p.remainingCents >= 0 ? `${money(p.remainingCents)} left` : `${money(-p.remainingCents)} over` }}
                        </p>
                    </li>
                </ul>
            </section>

            <section class="card" aria-labelledby="split-title">
                <h3 id="split-title" class="card-title">Where it went</h3>
                <apexchart v-if="byCategory.length" :key="chart.key(donutSeries, currency, byCategory)" type="donut" height="260" :options="donutOptions" :series="donutSeries" />
                <EmptyState v-else :icon="PieChart" title="No expenses this month" text="Add an expense to see the breakdown." />
            </section>
        </div>

        <section class="card" aria-labelledby="trend-title">
            <h3 id="trend-title" class="card-title">Income vs expenses · last 6 months</h3>
            <apexchart :key="chart.key(trendSeries, currency)" type="bar" height="260" :options="trendOptions" :series="trendSeries" />
        </section>

        <section class="card" aria-labelledby="tx-title">
            <div class="card-head">
                <h3 id="tx-title" class="card-title">Transactions</h3>
            </div>

            <div class="filters">
                <div class="segmented" role="group" aria-label="Type">
                    <button v-for="t in typeFilters" :key="t.value" type="button" :aria-pressed="typeFilter === t.value" @click="typeFilter = t.value">
                        {{ t.label }}
                    </button>
                </div>
                <label class="sr-only" for="tx-cat">Category</label>
                <select id="tx-cat" v-model="categoryFilter">
                    <option value="">All categories</option>
                    <option v-for="c in monthCategories" :key="c" :value="c">{{ c }}</option>
                </select>
                <div class="search">
                    <Search :size="16" aria-hidden="true" />
                    <label class="sr-only" for="tx-search">Search transactions</label>
                    <input id="tx-search" v-model="search" type="search" placeholder="Search notes" />
                </div>
            </div>

            <EmptyState
                v-if="rows.length === 0"
                :icon="Wallet"
                :title="monthRows.length ? 'Nothing matches your filters' : 'No transactions this month'"
                :text="monthRows.length ? 'Try clearing a filter.' : 'Add income and expenses to see your month take shape.'"
            >
                <button v-if="!monthRows.length" type="button" class="btn" @click="openCreate('Expense')">Add a transaction</button>
            </EmptyState>

            <ul v-else class="tx-list">
                <li v-for="t in rows" :key="t.id" class="tx">
                    <span class="tx-date">{{ formatDueDate(t.date) }}</span>
                    <span class="tx-main">
                        <span class="tx-category">{{ t.category }}</span>
                        <span v-if="t.note" class="tx-note">{{ t.note }}</span>
                    </span>
                    <span class="tx-amount" :class="t.type.toLowerCase()">
                        {{ t.type === 'Income' ? '+' : '−' }}{{ format(t.amount) }}
                    </span>
                    <span class="tx-actions">
                        <button type="button" class="icon-btn" :aria-label="`Edit ${t.category} ${t.type.toLowerCase()}`" @click="openEdit(t)">
                            <Pencil :size="16" aria-hidden="true" />
                        </button>
                        <button type="button" class="icon-btn danger" :aria-label="`Delete ${t.category} ${t.type.toLowerCase()}`" @click="remove(t)">
                            <Trash2 :size="16" aria-hidden="true" />
                        </button>
                    </span>
                </li>
            </ul>
        </section>

        <AppModal v-model:open="txOpen" :title="editing ? 'Edit transaction' : 'Add transaction'">
            <form class="form" @submit.prevent="saveTransaction">
                <div class="segmented wide" role="group" aria-label="Transaction type">
                    <button type="button" :aria-pressed="form.type === 'Expense'" @click="form.type = 'Expense'">Expense</button>
                    <button type="button" :aria-pressed="form.type === 'Income'" @click="form.type = 'Income'">Income</button>
                </div>

                <div class="field">
                    <label for="tx-amount">Amount ({{ symbol }})</label>
                    <div class="amount-row">
                        <input id="tx-amount" v-model="form.amount" type="number" inputmode="decimal" step="0.01" min="0.01" required autofocus />
                        <button type="button" class="icon-btn calc-btn" aria-label="Open calculator for the amount" title="Calculator" @click="askCalculator">
                            <Calculator :size="18" aria-hidden="true" />
                        </button>
                    </div>
                </div>

                <div class="grid-2">
                    <div class="field">
                        <label for="tx-category">Category</label>
                        <input id="tx-category" v-model="form.category" type="text" list="tx-category-list" maxlength="100" required autocomplete="off" />
                        <datalist id="tx-category-list">
                            <option v-for="c in suggestions" :key="c" :value="c"></option>
                        </datalist>
                    </div>
                    <div class="field">
                        <label for="tx-date">Date</label>
                        <input id="tx-date" v-model="form.date" type="date" required />
                    </div>
                </div>

                <div class="field">
                    <label for="tx-note">Note</label>
                    <input id="tx-note" v-model="form.note" type="text" maxlength="500" />
                </div>

                <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" @click="txOpen = false">Cancel</button>
                    <button type="submit" class="btn">{{ editing ? 'Save changes' : 'Add' }}</button>
                </div>
            </form>
        </AppModal>

        <AppModal v-model:open="limitsOpen" title="Monthly limits">
            <form class="form" @submit.prevent="saveLimits">
                <p class="muted small">Set the most you want to spend per category each month. Leave a limit empty for no budget.</p>
                <ul class="limit-edit">
                    <li v-for="(row, i) in limitRows" :key="row.category">
                        <label :for="`lim-${i}`">{{ row.category }}</label>
                        <div class="limit-input">
                            <span class="prefix" aria-hidden="true">{{ symbol }}</span>
                            <input :id="`lim-${i}`" v-model="row.limit" type="number" min="0" step="1" inputmode="decimal" placeholder="No limit" />
                        </div>
                    </li>
                </ul>
                <div class="add-category">
                    <label class="sr-only" for="new-cat">New category</label>
                    <input id="new-cat" v-model="newCategory" type="text" maxlength="100" placeholder="Add another category" @keydown.enter.prevent="addCategoryRow" />
                    <button type="button" class="btn btn-secondary" :disabled="!newCategory.trim()" @click="addCategoryRow">Add</button>
                </div>
                <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" @click="limitsOpen = false">Cancel</button>
                    <button type="submit" class="btn">Save limits</button>
                </div>
            </form>
        </AppModal>
    </div>
</template>

<script setup>
import { reactive, ref, computed, defineAsyncComponent, onMounted } from 'vue'
import {
    Plus, ChevronLeft, ChevronRight, Target, Search, Pencil, Trash2, Wallet, PieChart, Calculator,
    ArrowDownLeft, ArrowUpRight, Scale, PiggyBank
} from 'lucide-vue-next'
import AppModal from '../components/AppModal.vue'
import EmptyState from '../components/EmptyState.vue'
import { useTransactionsStore } from '../stores/transactions'
import { useBudgetsStore } from '../stores/budgets'
import { useCurrency } from '../composables/useCurrency'
import { useCalculator } from '../composables/useCalculator'
import { useChartTheme } from '../composables/useChartTheme'
import { formatDueDate, dueDateToInput, inputToDueDate, localToday } from '../utils/dates'
import {
    currentMonthKey, shiftMonth, monthLabel, monthKey, summarize, expensesByCategory, budgetProgress,
    monthlySeries, categorySuggestions, fromCents
} from '../utils/finance'

// Loaded on demand so the chart library stays out of the main bundle.
const apexchart = defineAsyncComponent(() => import('vue3-apexcharts'))

const txStore = useTransactionsStore()
const budgetStore = useBudgetsStore()
const { currency, format, formatCompact, symbol } = useCurrency()
const calculator = useCalculator()
const chart = useChartTheme()

const thisMonth = currentMonthKey()
const month = ref(thisMonth)

onMounted(() => {
    txStore.fetchAll()
    budgetStore.fetchAll()
})

const money = (cents) => format(fromCents(cents))

// ---- derived data -----------------------------------------------------------------------
const summary = computed(() => summarize(txStore.items, month.value))
const byCategory = computed(() => expensesByCategory(txStore.items, month.value))
const progress = computed(() => budgetProgress(budgetStore.items, txStore.items, month.value))
const series = computed(() => monthlySeries(txStore.items, month.value, 6))

const monthRows = computed(() => txStore.sorted.filter(t => monthKey(t.date) === month.value))
const monthCategories = computed(() => [...new Set(monthRows.value.map(t => t.category.trim()))].sort((a, b) => a.localeCompare(b)))

const typeFilter = ref('All')
const categoryFilter = ref('')
const search = ref('')
const typeFilters = [{ value: 'All', label: 'All' }, { value: 'Expense', label: 'Expenses' }, { value: 'Income', label: 'Income' }]

const rows = computed(() => {
    const s = search.value.trim().toLowerCase()
    return monthRows.value.filter(t => {
        if (typeFilter.value !== 'All' && t.type !== typeFilter.value) return false
        if (categoryFilter.value && t.category.trim() !== categoryFilter.value) return false
        if (s && !t.category.toLowerCase().includes(s) && !(t.note || '').toLowerCase().includes(s)) return false
        return true
    })
})

// ---- charts -----------------------------------------------------------------------------
const donutSeries = computed(() => byCategory.value.map(c => fromCents(c.cents)))
const donutOptions = computed(() => {
    const c = chart.colors.value
    const shades = [c.primary, c.soft, c.warning, c.danger, '#74CBA8', '#A8E0C8', '#B54708', '#5B7A6D', '#134A3B']
    return chart.options({
        labels: byCategory.value.map(x => x.category),
        colors: shades,
        stroke: { width: 2, colors: [c.surface] },
        plotOptions: { pie: { donut: { size: '66%' } } },
        tooltip: { y: { formatter: (v) => format(v) } }
    })
})

const trendSeries = computed(() => [
    { name: 'Income', data: series.value.map(m => fromCents(m.incomeCents)) },
    { name: 'Expenses', data: series.value.map(m => fromCents(m.expenseCents)) }
])
const trendOptions = computed(() => {
    const c = chart.colors.value
    return chart.options({
        colors: [c.income, c.expense],
        xaxis: { categories: series.value.map(m => m.label) },
        yaxis: { labels: { formatter: (v) => formatCompact(v) } },
        plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
        tooltip: { y: { formatter: (v) => format(v) } }
    })
})

// ---- transaction dialog -----------------------------------------------------------------
const txOpen = ref(false)
const editing = ref(null)
const formError = ref('')
const form = reactive({ type: 'Expense', amount: '', category: '', date: '', note: '' })

const suggestions = computed(() => categorySuggestions(txStore.items, budgetStore.items, form.type))

function defaultDate() {
    return month.value === thisMonth ? localToday() : `${month.value}-01`
}

function openCreate(type = 'Expense') {
    editing.value = null
    formError.value = ''
    Object.assign(form, { type, amount: '', category: '', date: defaultDate(), note: '' })
    txOpen.value = true
}

function openEdit(t) {
    editing.value = t
    formError.value = ''
    Object.assign(form, { type: t.type, amount: String(t.amount), category: t.category, date: dueDateToInput(t.date), note: t.note || '' })
    txOpen.value = true
}

function askCalculator() {
    calculator.open({ onUse: (value) => { form.amount = String(Math.round(value * 100) / 100) } })
}

async function saveTransaction() {
    const amount = Number(form.amount)
    if (!(amount > 0)) {
        formError.value = 'Enter an amount greater than 0.'
        return
    }
    const payload = {
        type: form.type,
        amount: Math.round(amount * 100) / 100,
        category: form.category.trim(),
        note: form.note.trim() || null,
        date: inputToDueDate(form.date)
    }
    try {
        if (editing.value) await txStore.update(editing.value.id, payload)
        else await txStore.create(payload)
        // Jump to the month the transaction landed in so it is visible straight away.
        month.value = monthKey(payload.date)
        txOpen.value = false
    } catch (err) {
        formError.value = err.response?.data?.message || 'Could not save the transaction.'
    }
}

async function remove(t) {
    if (window.confirm(`Delete this ${t.type.toLowerCase()} of ${format(t.amount)} (${t.category})?`)) await txStore.remove(t.id)
}

// ---- limits dialog ----------------------------------------------------------------------
const limitsOpen = ref(false)
const limitRows = ref([])
const newCategory = ref('')
let originalLimits = new Map()

function openLimits() {
    formError.value = ''
    const names = categorySuggestions(txStore.items, budgetStore.items, 'Expense')
    const existing = new Map(budgetStore.items.map(b => [b.category.trim().toLowerCase(), b]))

    limitRows.value = names.map(name => {
        const b = existing.get(name.toLowerCase())
        return { category: b ? b.category : name, limit: b ? String(b.monthlyLimit) : '' }
    })
    originalLimits = new Map(limitRows.value.map(r => [r.category, r.limit]))
    newCategory.value = ''
    limitsOpen.value = true
}

function addCategoryRow() {
    const name = newCategory.value.trim()
    if (!name) return
    if (!limitRows.value.some(r => r.category.toLowerCase() === name.toLowerCase())) {
        limitRows.value.push({ category: name, limit: '' })
        originalLimits.set(name, '')
    }
    newCategory.value = ''
}

async function saveLimits() {
    try {
        for (const row of limitRows.value) {
            if (String(row.limit) === originalLimits.get(row.category)) continue
            await budgetStore.setLimit(row.category, row.limit)
        }
        limitsOpen.value = false
    } catch (err) {
        formError.value = err.response?.data?.message || 'Could not save the limits.'
    }
}

</script>

<style scoped>
.header-actions { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }

.month-nav {
    display: inline-flex;
    align-items: center;
    padding: 2px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
}
.month-label { min-width: 130px; text-align: center; font-weight: 600; font-size: 0.9rem; }

.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 1rem; }
.stat { display: flex; align-items: center; gap: 0.9rem; padding: 1rem; }
.stat-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: var(--radius); flex: none; }
.stat-icon.income { color: var(--primary-text); background: var(--primary-soft); }
.stat-icon.expense { color: var(--danger); background: var(--danger-soft); }
.stat-value { font-size: 1.35rem; font-weight: 800; line-height: 1.15; font-variant-numeric: tabular-nums; }
.stat-value.negative { color: var(--danger); }
.stat-label { font-size: 0.8rem; color: var(--text-muted); }

.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; }
.card-head .card-title { margin-bottom: 1rem; }

.limits { display: flex; flex-direction: column; gap: 1rem; }
.limit-row { display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.35rem; }
.limit-name { font-weight: 600; }
.limit-amount { font-size: 0.85rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.limit-amount.over, .limit-note.over { color: var(--danger); }
.limit-amount.warn, .limit-note.warn { color: var(--warning); }
.limit-note { margin-top: 0.25rem; font-size: 0.78rem; color: var(--text-muted); }

.bar { height: 10px; overflow: hidden; background: var(--surface-3); border-radius: 999px; }
.bar-fill { height: 100%; border-radius: 999px; background: var(--accent); transition: width 0.3s ease; }
.bar-fill.warn { background: var(--warning); }
.bar-fill.over { background: var(--danger); }

.filters { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
.filters select { width: auto; min-width: 160px; }
.search { position: relative; flex: 1 1 200px; max-width: 280px; }
.search svg { position: absolute; left: 0.7rem; top: 50%; transform: translateY(-50%); color: var(--text-faint); pointer-events: none; }
.search input { padding-left: 2.2rem; }

.tx-list { display: flex; flex-direction: column; }
.tx { display: flex; align-items: center; gap: 0.9rem; padding: 0.65rem 0; border-top: 1px solid var(--border); }
.tx:first-child { border-top: 0; }
.tx-date { min-width: 56px; font-size: 0.8rem; color: var(--text-muted); }
.tx-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.tx-category { font-weight: 600; }
.tx-note { font-size: 0.82rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tx-amount { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tx-amount.income { color: var(--primary-text); }
.tx-amount.expense { color: var(--text); }
.tx-actions { display: flex; }

.form { display: flex; flex-direction: column; gap: 0.9rem; }
.grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.9rem; }
.form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
.segmented.wide { display: flex; }
.segmented.wide button { flex: 1; justify-content: center; }
.amount-row { display: flex; gap: 0.4rem; }
.calc-btn { flex: none; width: 40px; height: 40px; border: 1px solid var(--border-strong); }
.small { font-size: 0.85rem; }

.limit-edit { display: flex; flex-direction: column; gap: 0.5rem; max-height: 320px; overflow-y: auto; padding-right: 0.25rem; }
.limit-edit li { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.limit-edit label { font-weight: 600; font-size: 0.9rem; }
.limit-input { position: relative; width: 160px; flex: none; }
.limit-input .prefix { position: absolute; left: 0.7rem; top: 50%; transform: translateY(-50%); font-size: 0.8rem; color: var(--text-faint); }
.limit-input input { padding-left: 2.3rem; text-align: right; }
.add-category { display: flex; gap: 0.5rem; }

@media (max-width: 900px) {
    .grid { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 520px) {
    .grid-2 { grid-template-columns: 1fr; }
    .tx { flex-wrap: wrap; }
    .tx-main { flex-basis: calc(100% - 140px); }
}
</style>
