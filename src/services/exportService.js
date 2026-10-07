import api from './api'
import { tempId } from '../stores/sync'
import { useTodosStore, STATUSES, STATUS_LABELS } from '../stores/todos'
import { useNotesStore } from '../stores/notes'
import { useMeetingsStore } from '../stores/meetings'
import { useCategoriesStore } from '../stores/categories'
import { useTransactionsStore } from '../stores/transactions'
import { useBudgetsStore } from '../stores/budgets'
import { useCurrency } from '../composables/useCurrency'
import { dueDateToInput, inputToDueDate, formatDateTime } from '../utils/dates'
import { toCents, fromCents, summarize, budgetProgress, currentMonthKey, monthLabel } from '../utils/finance'

const PRIORITIES = ['Low', 'Medium', 'High']
const MAX_IMPORT_ROWS = 5000

export function download(filename, blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function stamp() {
    return new Date().toISOString().slice(0, 10)
}

async function loadAll() {
    const todos = useTodosStore()
    const notes = useNotesStore()
    const meetings = useMeetingsStore()
    const categories = useCategoriesStore()
    const transactions = useTransactionsStore()
    const budgets = useBudgetsStore()
    await Promise.all([
        todos.fetchAll(), notes.fetchAll(), meetings.fetchAll(), categories.fetchAll(),
        transactions.fetchAll(), budgets.fetchAll()
    ])
    return { todos, notes, meetings, categories, transactions, budgets }
}

async function refreshStores() {
    const s = await loadAll()
    return s
}

// ---------------------------------------------------------------- JSON backup

export async function exportJson() {
    const { todos, notes, meetings, categories, transactions, budgets } = await loadAll()
    const backup = {
        app: 'what-to-do',
        version: 2,
        exportedAt: new Date().toISOString(),
        categories: categories.items.map(c => ({ name: c.name, color: c.color })),
        todos: todos.items.map(t => ({
            title: t.title,
            notes: t.notes ?? null,
            status: t.status,
            sortOrder: t.sortOrder,
            priority: t.priority,
            dueDate: t.dueDate ?? null,
            category: t.categoryName ?? null,
            completedAt: t.completedAt ?? null
        })),
        transactions: transactions.items.map(t => ({
            type: t.type, amount: t.amount, category: t.category, note: t.note ?? null, date: t.date
        })),
        budgets: budgets.items.map(b => ({ category: b.category, monthlyLimit: b.monthlyLimit })),
        notes: notes.items.map(n => ({ title: n.title, body: n.body ?? null })),
        meetings: meetings.items.map(m => ({
            title: m.title,
            description: m.description ?? null,
            location: m.location ?? null,
            startsAt: m.startsAt,
            endsAt: m.endsAt,
            meetingNotes: m.meetingNotes ?? null
        }))
    }
    download(`what-to-do-backup-${stamp()}.json`, new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
    return {
        todos: backup.todos.length,
        notes: backup.notes.length,
        meetings: backup.meetings.length,
        transactions: backup.transactions.length,
        budgets: backup.budgets.length
    }
}

function clean(value, max) {
    return typeof value === 'string' ? value.slice(0, max) : null
}

// "YYYY-MM-DD" that is a real calendar day (2026-13-45 and 2026-02-30 are rejected, not rolled over).
function isRealDay(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
    if (!m) return false
    const [y, mo, d] = m.slice(1).map(Number)
    const date = new Date(Date.UTC(y, mo - 1, d))
    return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

function validIso(value) {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// Restored rows are always created as new records (negative temp ids), never overwriting existing ones.
export async function importJson(file) {
    let data
    try {
        data = JSON.parse(await file.text())
    } catch {
        throw new Error('That file is not valid JSON.')
    }
    if (data?.app !== 'what-to-do' || !Array.isArray(data.todos) || !Array.isArray(data.notes) || !Array.isArray(data.meetings)) {
        throw new Error('That does not look like a What To Do backup.')
    }
    // Backups made before budgeting existed simply have no transactions/budgets.
    const txRows = Array.isArray(data.transactions) ? data.transactions : []
    const budgetRows = Array.isArray(data.budgets) ? data.budgets : []
    if (data.todos.length + data.notes.length + data.meetings.length + txRows.length + budgetRows.length > MAX_IMPORT_ROWS) {
        throw new Error(`Backups are limited to ${MAX_IMPORT_ROWS} items.`)
    }

    const categories = useCategoriesStore()
    await categories.fetchAll()
    const categoryByName = new Map(categories.items.map(c => [c.name.toLowerCase(), c.id]))
    const now = new Date().toISOString()

    const body = {
        todos: data.todos.filter(t => clean(t.title, 255)).map(t => ({
            id: tempId(),
            title: clean(t.title, 255),
            notes: clean(t.notes, 4000),
            isCompleted: t.status === 'Done',
            status: STATUSES.includes(t.status) ? t.status : 'Todo',
            sortOrder: Number.isInteger(t.sortOrder) ? t.sortOrder : 0,
            priority: PRIORITIES.includes(t.priority) ? t.priority : 'Medium',
            dueDate: t.dueDate ? validIso(t.dueDate) : null,
            categoryId: categoryByName.get(String(t.category || '').toLowerCase()) ?? null,
            completedAt: t.status === 'Done' ? (t.completedAt && validIso(t.completedAt)) || now : null,
            updatedAt: now,
            isDeleted: false
        })),
        transactions: txRows.filter(validTransaction).map(t => ({
            id: tempId(),
            type: t.type,
            amount: Math.round(Number(t.amount) * 100) / 100,
            category: clean(t.category, 100).trim(),
            note: clean(t.note, 500),
            date: asDay(validIso(t.date)),
            updatedAt: now,
            isDeleted: false
        })),
        budgets: budgetRows
            .filter(b => clean(b.category, 100)?.trim() && Number(b.monthlyLimit) >= 0 && Number.isFinite(Number(b.monthlyLimit)))
            .map(b => ({
                id: tempId(),
                category: clean(b.category, 100).trim(),
                monthlyLimit: Number(b.monthlyLimit),
                updatedAt: now,
                isDeleted: false
            })),
        notes: data.notes.filter(n => clean(n.title, 255)).map(n => ({
            id: tempId(),
            title: clean(n.title, 255),
            body: clean(n.body, 100000),
            updatedAt: now,
            isDeleted: false
        })),
        meetings: data.meetings
            .filter(m => clean(m.title, 255) && validIso(m.startsAt) && validIso(m.endsAt))
            .map(m => ({
                id: tempId(),
                title: clean(m.title, 255),
                description: clean(m.description, 4000),
                location: clean(m.location, 255),
                startsAt: validIso(m.startsAt),
                endsAt: validIso(m.endsAt),
                meetingNotes: clean(m.meetingNotes, 100000),
                updatedAt: now,
                isDeleted: false
            }))
    }

    await api.post('/sync/push', body)
    await refreshStores()
    return {
        todos: body.todos.length,
        notes: body.notes.length,
        meetings: body.meetings.length,
        transactions: body.transactions.length,
        budgets: body.budgets.length
    }
}

// A restored transaction must be well formed; invalid rows are skipped instead of failing the batch.
function validTransaction(t) {
    const amount = Number(t?.amount)
    return (t?.type === 'Income' || t?.type === 'Expense') &&
        Number.isFinite(amount) && amount > 0 && amount <= 1e12 &&
        !!clean(t.category, 100)?.trim() && !!validIso(t.date)
}

// Re-sync dates to date-only (UTC midnight) like the rest of the app.
const asDay = (iso) => inputToDueDate(dueDateToInput(iso))

// ---------------------------------------------------------------- CSV (todos)

const CSV_HEADERS = ['title', 'notes', 'status', 'priority', 'dueDate', 'category']

// Cells that start with = + - @ can run as formulas when the file is opened in a spreadsheet.
function csvCell(value) {
    let s = value == null ? '' : String(value)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function exportTodosCsv() {
    const { todos } = await loadAll()
    const rows = todos.items.map(t => [
        t.title, t.notes, t.status, t.priority, dueDateToInput(t.dueDate), t.categoryName
    ])
    const csv = [CSV_HEADERS, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
    // BOM so Excel reads UTF-8 correctly.
    download(`what-to-do-todos-${stamp()}.csv`, new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
    return rows.length
}

export function parseCsv(text) {
    const rows = []
    let row = []
    let cell = ''
    let quoted = false

    for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
            else if (ch === '"') quoted = false
            else cell += ch
        } else if (ch === '"') {
            quoted = true
        } else if (ch === ',') {
            row.push(cell); cell = ''
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++
            row.push(cell); cell = ''
            if (row.some(c => c !== '')) rows.push(row)
            row = []
        } else {
            cell += ch
        }
    }
    row.push(cell)
    if (row.some(c => c !== '')) rows.push(row)
    return rows
}

export async function importTodosCsv(file) {
    const text = (await file.text()).replace(/^﻿/, '')
    const rows = parseCsv(text)
    if (rows.length < 2) throw new Error('The CSV has no rows to import.')
    if (rows.length - 1 > MAX_IMPORT_ROWS) throw new Error(`CSV imports are limited to ${MAX_IMPORT_ROWS} rows.`)

    const header = rows[0].map(h => h.trim().toLowerCase())
    const col = (name) => header.indexOf(name)
    if (col('title') === -1) throw new Error('The CSV needs a “title” column.')

    const categories = useCategoriesStore()
    await categories.fetchAll()
    const categoryByName = new Map(categories.items.map(c => [c.name.toLowerCase(), c.id]))
    const now = new Date().toISOString()

    const todos = []
    for (const r of rows.slice(1)) {
        const get = (name) => (col(name) === -1 ? '' : (r[col(name)] || '').trim())
        const title = get('title').replace(/^'(?=[=+\-@])/, '')
        if (!title) continue

        const status = STATUSES.find(s => s.toLowerCase() === get('status').toLowerCase().replace(/[\s_-]/g, '')) || 'Todo'
        const priority = PRIORITIES.find(p => p.toLowerCase() === get('priority').toLowerCase()) || 'Medium'
        const due = get('duedate')

        todos.push({
            id: tempId(),
            title: title.slice(0, 255),
            notes: get('notes').slice(0, 4000) || null,
            isCompleted: status === 'Done',
            status,
            sortOrder: todos.length,
            priority,
            dueDate: isRealDay(due) ? inputToDueDate(due) : null,
            categoryId: categoryByName.get(get('category').toLowerCase()) ?? null,
            updatedAt: now,
            isDeleted: false
        })
    }

    if (todos.length === 0) throw new Error('No valid rows were found.')
    await api.post('/sync/push', { todos })
    await refreshStores()
    return todos.length
}

// ---------------------------------------------------------------- PDF

async function newPdf(title) {
    // Loaded on demand: the PDF libraries are large and rarely used.
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor('#134A3B')
    doc.text(title, 48, 64)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor('#4B6A5E')
    doc.text(`Exported ${formatDateTime(new Date().toISOString())}`, 48, 82)
    return { doc, autoTable, y: 112 }
}

// Writes wrapped text, adding pages as needed. Returns the new y position.
function writeBlock(doc, text, y, { size = 11, bold = false, color = '#0F2A21', gap = 6 } = {}) {
    const width = doc.internal.pageSize.getWidth() - 96
    const bottom = doc.internal.pageSize.getHeight() - 56
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(color)

    for (const line of doc.splitTextToSize(text, width)) {
        if (y > bottom) { doc.addPage(); y = 56 }
        doc.text(line, 48, y)
        y += size * 1.45
    }
    return y + gap
}

export async function exportPdf(kind) {
    const { todos, notes, meetings, transactions, budgets } = await loadAll()

    if (kind === 'todos') {
        const { doc, autoTable, y } = await newPdf('Todos')
        autoTable(doc, {
            startY: y,
            head: [['Title', 'Status', 'Priority', 'Due', 'Category']],
            body: todos.items.map(t => [
                t.title, STATUS_LABELS[t.status] || t.status, t.priority, dueDateToInput(t.dueDate) || '—', t.categoryName || '—'
            ]),
            styles: { font: 'helvetica', fontSize: 9, cellPadding: 6 },
            headStyles: { fillColor: [26, 111, 88] },
            alternateRowStyles: { fillColor: [236, 248, 243] },
            margin: { left: 48, right: 48 }
        })
        doc.save(`what-to-do-todos-${stamp()}.pdf`)
        return todos.items.length
    }

    if (kind === 'notes') {
        const { doc, y: startY } = await newPdf('Notes')
        let y = startY
        for (const n of notes.items) {
            y = writeBlock(doc, n.title, y, { size: 13, bold: true, color: '#1A6F58', gap: 2 })
            y = writeBlock(doc, `Updated ${formatDateTime(n.updatedAt)}`, y, { size: 9, color: '#6B8579', gap: 4 })
            y = writeBlock(doc, n.body || '(empty)', y, { gap: 18 })
        }
        doc.save(`what-to-do-notes-${stamp()}.pdf`)
        return notes.items.length
    }

    if (kind === 'meetings') {
        const { doc, y: startY } = await newPdf('Meetings & meeting notes')
        let y = startY
        for (const m of meetings.sorted) {
            y = writeBlock(doc, m.title, y, { size: 13, bold: true, color: '#1A6F58', gap: 2 })
            y = writeBlock(doc, `${formatDateTime(m.startsAt)} – ${formatDateTime(m.endsAt)}${m.location ? ` · ${m.location}` : ''}`, y, { size: 9, color: '#6B8579', gap: 4 })
            if (m.description) y = writeBlock(doc, m.description, y, { color: '#4B6A5E' })
            y = writeBlock(doc, m.meetingNotes || '(no notes)', y, { gap: 18 })
        }
        doc.save(`what-to-do-meetings-${stamp()}.pdf`)
        return meetings.items.length
    }

    if (kind === 'budget') {
        const key = currentMonthKey()
        // jsPDF's built-in fonts only cover Latin text, so amounts use the ISO code (USD 1,234.00), not a symbol.
        const { currency } = useCurrency()
        const formatter = new Intl.NumberFormat(navigator.language, { style: 'currency', currency: currency.value, currencyDisplay: 'code' })
        const money = (cents) => formatter.format(fromCents(cents)).replace(/ /g, ' ')

        const { doc, autoTable, y: startY } = await newPdf(`Budget report · ${monthLabel(key)}`)
        const s = summarize(transactions.items, key)
        let y = writeBlock(doc, `Income ${money(s.incomeCents)}   Expenses ${money(s.expenseCents)}   Net ${money(s.netCents)}`, startY, { size: 12, bold: true })

        const progress = budgetProgress(budgets.items, transactions.items, key)
        if (progress.length) {
            autoTable(doc, {
                startY: y,
                head: [['Category', 'Spent', 'Limit', 'Remaining']],
                body: progress.map(p => [p.category, money(p.spentCents), money(p.limitCents), money(p.remainingCents)]),
                styles: { font: 'helvetica', fontSize: 9, cellPadding: 6 },
                headStyles: { fillColor: [26, 111, 88] },
                alternateRowStyles: { fillColor: [236, 248, 243] },
                margin: { left: 48, right: 48 }
            })
            y = doc.lastAutoTable.finalY + 24
        }

        const rows = transactions.sorted.filter(t => t.date.slice(0, 7) === key)
        autoTable(doc, {
            startY: y,
            head: [['Date', 'Type', 'Category', 'Note', 'Amount']],
            body: rows.map(t => [t.date.slice(0, 10), t.type, t.category, t.note || '', money(toCents(t.amount))]),
            styles: { font: 'helvetica', fontSize: 9, cellPadding: 6 },
            headStyles: { fillColor: [26, 111, 88] },
            alternateRowStyles: { fillColor: [236, 248, 243] },
            columnStyles: { 4: { halign: 'right' } },
            margin: { left: 48, right: 48 }
        })
        doc.save(`what-to-do-budget-${key}.pdf`)
        return rows.length
    }

    throw new Error(`Unknown export: ${kind}`)
}

// ---------------------------------------------------------------- CSV (transactions)

const TX_HEADERS = ['date', 'type', 'amount', 'category', 'note']

export async function exportTransactionsCsv() {
    const { transactions } = await loadAll()
    const rows = transactions.sorted.map(t => [t.date.slice(0, 10), t.type, t.amount, t.category, t.note])
    const csv = [TX_HEADERS, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
    download(`what-to-do-transactions-${stamp()}.csv`, new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
    return rows.length
}

export async function importTransactionsCsv(file) {
    const rows = parseCsv((await file.text()).replace(/^﻿/, ''))
    if (rows.length < 2) throw new Error('The CSV has no rows to import.')
    if (rows.length - 1 > MAX_IMPORT_ROWS) throw new Error(`CSV imports are limited to ${MAX_IMPORT_ROWS} rows.`)

    const header = rows[0].map(h => h.trim().toLowerCase())
    for (const required of ['date', 'type', 'amount', 'category']) {
        if (!header.includes(required)) throw new Error(`The CSV needs a “${required}” column.`)
    }
    const col = (name) => header.indexOf(name)
    const now = new Date().toISOString()

    const items = []
    let skipped = 0
    for (const r of rows.slice(1)) {
        const get = (name) => (col(name) === -1 ? '' : (r[col(name)] || '').trim())
        const type = ['Income', 'Expense'].find(t => t.toLowerCase() === get('type').toLowerCase())
        // "1,234.50" and "$12" both parse; anything else is skipped rather than guessed.
        const amount = Math.round(parseFloat(get('amount').replace(/[^0-9.\-]/g, '')) * 100) / 100
        const date = get('date')
        const category = get('category').replace(/^'(?=[=+\-@])/, '').slice(0, 100)

        if (!type || !(amount > 0) || amount > 1e12 || !category || !isRealDay(date)) {
            skipped++
            continue
        }
        items.push({
            id: tempId(),
            type,
            amount,
            category,
            note: get('note').replace(/^'(?=[=+\-@])/, '').slice(0, 500) || null,
            date: inputToDueDate(date),
            updatedAt: now,
            isDeleted: false
        })
    }

    if (items.length === 0) throw new Error('No valid rows were found (needs date YYYY-MM-DD, type Income/Expense, amount, category).')
    await api.post('/sync/push', { transactions: items })
    await refreshStores()
    return skipped ? { transactions: items.length, skipped } : items.length
}
