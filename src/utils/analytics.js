// Productivity maths on plain arrays (todos, meetings). Everything is computed from the synced
// stores, so the Insights page also works offline.

const DAY = 86_400_000

const pad = (n) => String(n).padStart(2, '0')

export function localKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

// Monday-based week start.
export function startOfWeek(date) {
    const d = startOfDay(date)
    const offset = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - offset)
    return d
}

// range: '7d' | '30d' | '90d' | 'month'. `end` is exclusive (start of tomorrow).
export function rangeBounds(range, now = new Date()) {
    const today = startOfDay(now)
    const end = new Date(today.getTime() + DAY)

    if (range === 'month') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end }

    const days = { '7d': 7, '30d': 30, '90d': 90 }[range] || 30
    const start = new Date(today)
    start.setDate(start.getDate() - (days - 1))
    return { start, end }
}

const inRange = (date, { start, end }) => date >= start && date < end

// Done todos from before CompletedAt existed fall back to their last update.
export function completionDate(todo) {
    if (todo.status !== 'Done') return null
    const value = todo.completedAt || todo.updatedAt
    return value ? new Date(value) : null
}

export function completedInRange(todos, bounds) {
    return todos.filter(t => {
        const d = completionDate(t)
        return d && inRange(d, bounds)
    })
}

// Daily buckets for up to ~5 weeks, weekly buckets beyond that. Gaps are filled with zeros.
export function bucketSeries(dates, bounds, valueOf = () => 1) {
    const spanDays = Math.round((bounds.end - bounds.start) / DAY)
    const weekly = spanDays > 35
    const keyOf = (d) => localKey(weekly ? startOfWeek(d) : startOfDay(d))

    const totals = new Map()
    for (const { date, value } of dates) {
        const k = keyOf(date)
        totals.set(k, (totals.get(k) || 0) + value)
    }

    const buckets = []
    const step = weekly ? 7 : 1
    const first = weekly ? startOfWeek(bounds.start) : startOfDay(bounds.start)
    for (let d = new Date(first); d < bounds.end; d.setDate(d.getDate() + step)) {
        const key = localKey(d)
        buckets.push({ key, date: new Date(d), value: totals.get(key) || 0 })
    }
    return { buckets, weekly }
}

export function completedSeries(todos, bounds) {
    const dates = completedInRange(todos, bounds).map(t => ({ date: completionDate(t), value: 1 }))
    return bucketSeries(dates, bounds)
}

export function todosByCategory(todos) {
    const rows = new Map()
    for (const t of todos) {
        const name = t.categoryName || 'No category'
        const row = rows.get(name) || { name, open: 0, done: 0 }
        if (t.status === 'Done') row.done++
        else row.open++
        rows.set(name, row)
    }
    return [...rows.values()].sort((a, b) => b.open + b.done - (a.open + a.done))
}

// Share of completed todos (that had a due date) finished on or before it.
export function onTimeRate(todos, bounds) {
    const withDue = completedInRange(todos, bounds).filter(t => t.dueDate)
    if (withDue.length === 0) return { rate: null, total: 0 }
    const onTime = withDue.filter(t => localKey(completionDate(t)) <= t.dueDate.slice(0, 10)).length
    return { rate: onTime / withDue.length, total: withDue.length }
}

export function avgDaysToComplete(todos, bounds) {
    const rows = completedInRange(todos, bounds).filter(t => t.createdAt)
    if (rows.length === 0) return null
    const days = rows.map(t => Math.max(0, (completionDate(t) - new Date(t.createdAt)) / DAY))
    return days.reduce((a, b) => a + b, 0) / days.length
}

export function meetingHours(meeting) {
    return Math.max(0, (new Date(meeting.endsAt) - new Date(meeting.startsAt)) / 3_600_000)
}

export function meetingsInRange(meetings, bounds) {
    return meetings.filter(m => inRange(new Date(m.startsAt), bounds))
}

export function meetingHoursTotal(meetings, bounds) {
    return meetingsInRange(meetings, bounds).reduce((sum, m) => sum + meetingHours(m), 0)
}

export function meetingHoursSeries(meetings, bounds) {
    const dates = meetingsInRange(meetings, bounds).map(m => ({ date: new Date(m.startsAt), value: meetingHours(m) }))
    return bucketSeries(dates, bounds)
}
