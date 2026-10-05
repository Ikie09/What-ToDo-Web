// Due dates are date-only values stored as UTC midnight, so they are always read and shown in UTC
// (otherwise users west of UTC would see the previous day).

export function dueDateToInput(iso) {
    return iso ? iso.slice(0, 10) : ''
}

export function inputToDueDate(value) {
    return value ? `${value}T00:00:00Z` : null
}

export function localToday() {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function isOverdue(todo) {
    return !!todo.dueDate && todo.status !== 'Done' && !todo.isCompleted && dueDateToInput(todo.dueDate) < localToday()
}

export function formatDueDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function formatDateTime(iso) {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatTime(iso) {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function formatDay(iso) {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

// <input type="datetime-local"> works in local time without a zone.
export function toLocalInput(iso) {
    const d = new Date(iso)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(value) {
    return new Date(value).toISOString()
}

export function startOfLocalDay(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
