<template>
    <div v-if="visible" class="transcribe">
        <template v-if="recorder.state.value === 'recording'">
            <span class="rec" role="status" aria-live="polite">
                <span class="dot" aria-hidden="true"></span>
                Recording {{ clock }}
                <span class="meter" aria-hidden="true"><span :style="{ width: Math.round(recorder.level.value * 100) + '%' }"></span></span>
            </span>
            <button type="button" class="btn btn-sm" @click="stopAndTranscribe">
                <Square :size="14" aria-hidden="true" /> Stop &amp; transcribe
            </button>
            <button type="button" class="btn btn-ghost btn-sm" @click="recorder.cancel()">Discard</button>
        </template>

        <template v-else-if="working">
            <span class="working" role="status" aria-live="polite">
                <Loader2 :size="16" class="spin" aria-hidden="true" />
                {{ phase === 'uploading' ? 'Uploading…' : `Transcribing… ${elapsed}s` }}
            </span>
            <button type="button" class="btn btn-ghost btn-sm" @click="cancelWork">Cancel</button>
        </template>

        <template v-else>
            <button
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="!canStart"
                :title="disabledReason"
                @click="startRecording"
            >
                <AudioLines :size="16" aria-hidden="true" /> Record &amp; transcribe
            </button>
            <span v-if="disabledReason" class="hint">{{ disabledReason }}</span>
        </template>

        <span v-if="notice" class="notice" role="status">{{ notice }}</span>
        <span v-if="errorText" class="form-error" role="alert">{{ errorText }}</span>
        <span v-if="canStart && recorder.state.value === 'idle' && !working" class="privacy">
            Up to {{ MAX_SECONDS / 60 }} minutes. Audio goes to your own server, is transcribed there, and is deleted afterwards.
        </span>
    </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { AudioLines, Square, Loader2 } from 'lucide-vue-next'
import { useAudioRecorder, recorderSupported, MAX_SECONDS } from '../composables/useAudioRecorder'
import { useTranscription, loadTranscriptionStatus } from '../composables/useTranscription'
import { useSyncStore } from '../stores/sync'

const emit = defineEmits(['transcript'])

const sync = useSyncStore()
const status = ref(null)
const notice = ref('')
const elapsed = ref(0)
let tick = null

const recorder = useAudioRecorder({ onLimit: () => stopAndTranscribe() })
const { phase, error, transcribe, cancel } = useTranscription()

onMounted(async () => { status.value = await loadTranscriptionStatus() })
onBeforeUnmount(() => clearInterval(tick))

// Hidden entirely when the server has transcription turned off or this browser cannot record.
const visible = computed(() => recorderSupported && status.value?.enabled)
const working = computed(() => phase.value !== 'idle')
const errorText = computed(() => recorder.error.value || error.value)

const clock = computed(() => {
    const total = Math.floor(recorder.seconds.value)
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
})

const disabledReason = computed(() => {
    if (!sync.isOnline) return 'Needs a connection to your server.'
    if (status.value?.downloading) return 'Preparing the speech model (one-time download)…'
    if (!status.value?.ready) return status.value?.error ? 'Speech model unavailable on the server.' : 'Speech model is not ready yet.'
    return ''
})
const canStart = computed(() => !disabledReason.value)

async function startRecording() {
    notice.value = ''
    // Re-check right before recording: the model may have finished downloading since the page loaded.
    status.value = await loadTranscriptionStatus(true)
    if (!canStart.value) return
    await recorder.start()
}

async function stopAndTranscribe() {
    const wav = await recorder.stop()
    if (!wav) return

    elapsed.value = 0
    clearInterval(tick)
    tick = setInterval(() => { elapsed.value++ }, 1000)

    const text = await transcribe(wav)
    clearInterval(tick)

    if (text) {
        emit('transcript', text)
        notice.value = 'Transcript added.'
        setTimeout(() => { notice.value = '' }, 4000)
    } else if (text === '' ) {
        notice.value = 'No speech was detected.'
    }
}

function cancelWork() {
    cancel()
    clearInterval(tick)
}
</script>

<style scoped>
.transcribe { display: flex; align-items: center; flex-wrap: wrap; gap: 0.6rem; }

.rec, .working { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.85rem; font-variant-numeric: tabular-nums; color: var(--text); }
.dot { width: 9px; height: 9px; border-radius: 50%; background: var(--danger); animation: pulse 1.2s ease-in-out infinite; }
.meter { width: 60px; height: 6px; overflow: hidden; background: var(--surface-3); border-radius: 999px; }
.meter span { display: block; height: 100%; background: var(--accent); transition: width 0.1s linear; }

.hint, .privacy { font-size: 0.78rem; color: var(--text-muted); }
.notice { font-size: 0.85rem; color: var(--primary-text); }

.spin { animation: spin 1s linear infinite; }

@keyframes pulse { 50% { opacity: 0.25; } }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
