// Budget maths on plain arrays. Amounts are summed in integer cents so totals never drift
// (0.1 + 0.2 style errors). Transaction dates are date-only values stored as UTC midnight,
// so months are read from the ISO string, not from a local Date.

export const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Housing', 'Utilities', 'Health', 'Entertainment', 'Shopping', 'Education', 'Other']
export const INCOME_CATEGORIES = ['Salary', 'Business', 'Gift', 'Investment', 'Other']

export const toCents = (amount) => Math.round(Number(amount) * 100)
export const fromCents = (cents) => cents / 100

export function monthKey(iso) {
    return iso.slice(0, 7)
}

export function currentMonthKey(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonth(key, delta) {
    const [y, m] = key.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1 + delta, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key, options = { month: 'long', year: 'numeric' }) {
    const [y, m] = key.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { ...options, timeZone: 'UTC' })
}

const sameCategory = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

function inMonth(transactions, key) {
    return transactions.filter(t => monthKey(t.date) === key)
}

export function summarize(transactions, key) {
    let income = 0
    let expense = 0
    const rows = inMonth(transactions, key)
    for (const t of rows) {
        if (t.type === 'Income') income += toCents(t.amount)
        else expense += toCents(t.amount)
    }
    return {
        incomeCents: income,
        expenseCents: expense,
        netCents: income - expense,
        savingsRate: income > 0 ? (income - expense) / income : null,
        count: rows.length
    }
}

export function expensesByCategory(transactions, key) {
    const totals = new Map()
    for (const t of inMonth(transactions, key)) {
        if (t.type !== 'Expense') continue
        const name = t.category.trim()
        const entry = totals.get(name.toLowerCase()) || { category: name, cents: 0 }
        entry.cents += toCents(t.amount)
        totals.set(name.toLowerCase(), entry)
    }
    return [...totals.values()].sort((a, b) => b.cents - a.cents)
}

// status: ok (< 80%), warn (80–100%), over (> 100%)
export function budgetProgress(budgets, transactions, key) {
    const spentBy = new Map(expensesByCategory(transactions, key).map(e => [e.category.toLowerCase(), e.cents]))

    return budgets
        .map(b => {
            const limitCents = toCents(b.monthlyLimit)
            const spentCents = spentBy.get(b.category.trim().toLowerCase()) || 0
            const pct = limitCents > 0 ? spentCents / limitCents : spentCents > 0 ? Infinity : 0
            const status = pct > 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok'
            return { id: b.id, category: b.category, limitCents, spentCents, remainingCents: limitCents - spentCents, pct, status }
        })
        .sort((a, b) => a.category.localeCompare(b.category))
}

// Oldest month first, ending at `endKey`.
export function monthlySeries(transactions, endKey, count = 6) {
    const series = []
    for (let i = count - 1; i >= 0; i--) {
        const key = shiftMonth(endKey, -i)
        const s = summarize(transactions, key)
        series.push({ key, label: monthLabel(key, { month: 'short' }), ...s })
    }
    return series
}

// Existing names first (so spelling stays consistent), then defaults, de-duplicated case-insensitively.
export function categorySuggestions(transactions, budgets, type = 'Expense') {
    const seen = new Set()
    const out = []
    const add = (name) => {
        const key = name.trim().toLowerCase()
        if (key && !seen.has(key)) { seen.add(key); out.push(name.trim()) }
    }
    transactions.filter(t => t.type === type).forEach(t => add(t.category))
    if (type === 'Expense') budgets.forEach(b => add(b.category))
    ;(type === 'Expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).forEach(add)
    return out
}

export { sameCategory }
