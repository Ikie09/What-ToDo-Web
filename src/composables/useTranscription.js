import { ref } from 'vue'
import api from '../services/api'

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function messageFrom(err) {
    if (err?.response?.status === 413) return 'That recording is too large to upload.'
    if (err?.response?.data?.message) return err.response.data.message
    if (err?.code === 'ERR_NETWORK') return 'Could not reach the server. Check your connection and try again.'
    return err?.message || 'Transcription failed.'
}

// Server status is shared by every button on the page and re-checked occasionally.
const status = ref(null)
let statusLoadedAt = 0

export async function loadTranscriptionStatus(force = false) {
    if (!force && status.value && Date.now() - statusLoadedAt < 15_000) return status.value
    try {
        const { data } = await api.get('/transcriptions/status')
        status.value = data
    } catch {
        status.value = { enabled: false, ready: false, downloading: false, offline: true }
    }
    statusLoadedAt = Date.now()
    return status.value
}

export function useTranscription() {
    const phase = ref('idle') // idle | uploading | transcribing
    const error = ref('')
    let jobId = null
    let cancelled = false

    // Sends the WAV to the API, then polls until the transcript is ready. Resolves with the text.
    async function transcribe(wav) {
        error.value = ''
        cancelled = false
        phase.value = 'uploading'

        try {
            const form = new FormData()
            form.append('file', wav, 'recording.wav')
            const { data } = await api.post('/transcriptions', form)
            jobId = data.id
            phase.value = 'transcribing'

            let delay = 1000
            while (!cancelled) {
                await sleep(delay)
                delay = Math.min(delay + 500, 3000)
                if (cancelled) break

                const { data: job } = await api.get(`/transcriptions/${jobId}`)
                if (job.status === 'completed') return (job.text || '').trim()
                if (job.status === 'failed') throw new Error(job.error || 'The recording could not be transcribed.')
            }
            return null
        } catch (err) {
            if (!cancelled) error.value = messageFrom(err)
            return null
        } finally {
            phase.value = 'idle'
            // Results are kept on the server for 30 minutes; clear this one now that we have (or abandoned) it.
            if (jobId) api.delete(`/transcriptions/${jobId}`).catch(() => {})
            jobId = null
        }
    }

    function cancel() {
        cancelled = true
    }

    return { phase, error, transcribe, cancel }
}
