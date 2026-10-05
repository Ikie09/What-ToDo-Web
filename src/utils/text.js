// Inserts dictated text at the caret (or appends if the field was never focused), with sensible spacing.
export function insertAtCursor(textarea, current, text) {
    const value = current || ''
    const start = textarea?.selectionStart ?? value.length
    const end = textarea?.selectionEnd ?? value.length

    const before = value.slice(0, start)
    const after = value.slice(end)
    const lead = before && !/\s$/.test(before) ? ' ' : ''
    const trail = after && !/^\s/.test(after) ? ' ' : ''
    const inserted = `${lead}${text}${trail}`

    return { value: before + inserted + after, caret: before.length + inserted.length }
}
