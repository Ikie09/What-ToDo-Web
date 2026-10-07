// Markdown and Word (.docx) documents: export notes and meeting notes, import files as notes.
// The docx/mammoth libraries are large, so they are only loaded when one of these is used.

import { download, stamp } from './exportService'
import { useNotesStore } from '../stores/notes'
import { useMeetingsStore } from '../stores/meetings'
import { formatDateTime } from '../utils/dates'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_FILES = 20
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function slug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled'
}

// ---------------------------------------------------------------- building blocks

function noteDoc(note) {
    return {
        title: note.title,
        meta: [`Updated ${formatDateTime(note.updatedAt)}`],
        sections: [{ heading: null, text: note.body || '' }]
    }
}

function meetingDoc(m) {
    const meta = [`${formatDateTime(m.startsAt)} – ${formatDateTime(m.endsAt)}`]
    if (m.location) meta.push(`Location: ${m.location}`)

    const sections = []
    if (m.description) sections.push({ heading: 'Description', text: m.description })
    sections.push({ heading: 'Notes', text: m.meetingNotes || '(no notes)' })
    return { title: m.title, meta, sections }
}

function toMarkdown(doc) {
    const parts = [`# ${doc.title}`, '']
    if (doc.meta.length) parts.push(doc.meta.map(line => `*${line}*`).join('  \n'), '')
    for (const s of doc.sections) {
        if (s.heading) parts.push(`## ${s.heading}`, '')
        parts.push(s.text, '')
    }
    return parts.join('\n').trimEnd() + '\n'
}

async function toDocxBlob(docs) {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')

    // One paragraph per line keeps the note's own line breaks.
    const lines = (text) => text.split(/\r?\n/).map(line => new Paragraph({ children: [new TextRun(line)] }))

    const children = []
    docs.forEach((doc, index) => {
        children.push(new Paragraph({ text: doc.title, heading: HeadingLevel.HEADING_1, pageBreakBefore: index > 0 }))
        for (const line of doc.meta) {
            children.push(new Paragraph({ children: [new TextRun({ text: line, italics: true, color: '6B8579' })] }))
        }
        for (const s of doc.sections) {
            if (s.heading) children.push(new Paragraph({ text: s.heading, heading: HeadingLevel.HEADING_2 }))
            children.push(...lines(s.text))
        }
    })

    const file = new Document({
        creator: 'What To Do',
        title: docs.length === 1 ? docs[0].title : 'What To Do notes',
        sections: [{ children }]
    })
    return Packer.toBlob(file)
}

const markdownBlob = (text) => new Blob([text], { type: 'text/markdown;charset=utf-8' })

// ---------------------------------------------------------------- export

export async function exportNote(note, format) {
    const doc = noteDoc(note)
    const base = slug(note.title)
    if (format === 'docx') download(`${base}.docx`, await toDocxBlob([doc]))
    else download(`${base}.md`, markdownBlob(toMarkdown(doc)))
}

export async function exportMeeting(meeting, format) {
    const doc = meetingDoc(meeting)
    const base = slug(meeting.title)
    if (format === 'docx') download(`${base}.docx`, await toDocxBlob([doc]))
    else download(`${base}.md`, markdownBlob(toMarkdown(doc)))
}

export async function exportAllNotes(format) {
    const notes = useNotesStore()
    await notes.fetchAll()
    const docs = notes.items.map(noteDoc)
    if (docs.length === 0) throw new Error('There are no notes to export yet.')

    if (format === 'docx') download(`what-to-do-notes-${stamp()}.docx`, await toDocxBlob(docs))
    else download(`what-to-do-notes-${stamp()}.md`, markdownBlob(docs.map(toMarkdown).join('\n---\n\n')))
    return docs.length
}

export async function exportAllMeetingNotes(format) {
    const meetings = useMeetingsStore()
    await meetings.fetchAll()
    const docs = meetings.sorted.map(meetingDoc)
    if (docs.length === 0) throw new Error('There are no meetings to export yet.')

    if (format === 'docx') download(`what-to-do-meetings-${stamp()}.docx`, await toDocxBlob(docs))
    else download(`what-to-do-meetings-${stamp()}.md`, markdownBlob(docs.map(toMarkdown).join('\n---\n\n')))
    return docs.length
}

// ---------------------------------------------------------------- import

async function readText(file) {
    const name = file.name.toLowerCase()
    if (name.endsWith('.docx') || file.type === DOCX_TYPE) {
        const mammoth = await import('mammoth')
        const { value } = await (mammoth.default || mammoth).extractRawText({ arrayBuffer: await file.arrayBuffer() })
        return value
    }
    return file.text()
}

// Title = first "# Heading" line when present, otherwise the file name; the heading is not repeated in the body.
// Word files lose their heading styles when read as plain text, so a short first line is taken as the title.
export function splitTitleAndBody(text, filename, { shortFirstLineIsTitle = false } = {}) {
    const lines = text.replace(/^﻿/, '').split(/\r?\n/)
    const firstIndex = lines.findIndex(l => l.trim() !== '')
    const first = firstIndex === -1 ? '' : lines[firstIndex].trim()

    let title
    let bodyLines
    if (/^#{1,6}\s+\S/.test(first)) {
        title = first.replace(/^#{1,6}\s+/, '').trim()
        bodyLines = lines.slice(firstIndex + 1)
    } else if (shortFirstLineIsTitle && first && first.length <= 120) {
        title = first
        bodyLines = lines.slice(firstIndex + 1)
    } else {
        title = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Imported note'
        bodyLines = lines
    }
    return { title: title.slice(0, 255), body: bodyLines.join('\n').trim().slice(0, 100_000) }
}

// Each file becomes a new note. Bad files are reported, not fatal.
export async function importDocuments(fileList) {
    const files = [...fileList]
    if (files.length === 0) throw new Error('Choose at least one file.')
    if (files.length > MAX_FILES) throw new Error(`Import up to ${MAX_FILES} files at a time.`)

    const notes = useNotesStore()
    const problems = []
    let imported = 0

    for (const file of files) {
        const ext = file.name.toLowerCase().split('.').pop()
        if (!['md', 'markdown', 'txt', 'docx'].includes(ext)) {
            problems.push(`${file.name}: unsupported type (use .md, .txt or .docx)`)
            continue
        }
        if (file.size > MAX_FILE_BYTES) {
            problems.push(`${file.name}: larger than 5 MB`)
            continue
        }
        try {
            const { title, body } = splitTitleAndBody(await readText(file), file.name, { shortFirstLineIsTitle: ext === 'docx' })
            await notes.create({ title, body: body || null })
            imported++
        } catch {
            problems.push(`${file.name}: could not be read`)
        }
    }

    if (imported === 0) throw new Error(problems.join('; ') || 'Nothing was imported.')
    return problems.length ? { notes: imported, skipped: problems.length, details: problems.join('; ') } : { notes: imported }
}
