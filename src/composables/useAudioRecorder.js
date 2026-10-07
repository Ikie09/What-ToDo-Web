import { ref, onBeforeUnmount } from 'vue'
import { encodeWav } from '../utils/wav'

export const TARGET_RATE = 16_000
export const MAX_SECONDS = 900 // keep in step with Transcription:MaxAudioSeconds on the server

// Runs on the audio thread: averages the microphone's native sample rate (44.1/48 kHz) down to 16 kHz mono
// Int16, so a long recording stays small and the server needs no audio conversion.
const WORKLET_SOURCE = `
class Downsampler extends AudioWorkletProcessor {
    constructor() {
        super()
        this.ratio = sampleRate / ${TARGET_RATE}
        this.progress = 0
        this.sum = 0
        this.count = 0
        this.out = new Int16Array(4096)
        this.length = 0
        this.peak = 0
        // The page asks for the last partial buffer when recording stops.
        this.port.onmessage = (event) => {
            if (event.data && event.data.type === 'flush') this.flush()
        }
    }

    process(inputs) {
        const input = inputs[0]
        if (!input || input.length === 0) return true
        const left = input[0]
        const right = input[1] || left

        for (let i = 0; i < left.length; i++) {
            const sample = (left[i] + right[i]) / 2
            this.sum += sample
            this.count++
            this.progress++
            if (Math.abs(sample) > this.peak) this.peak = Math.abs(sample)

            if (this.progress >= this.ratio) {
                const value = Math.max(-1, Math.min(1, this.sum / this.count))
                this.out[this.length++] = value < 0 ? value * 0x8000 : value * 0x7fff
                this.progress -= this.ratio
                this.sum = 0
                this.count = 0

                if (this.length === this.out.length) {
                    this.port.postMessage({ samples: this.out.buffer, peak: this.peak }, [this.out.buffer])
                    this.out = new Int16Array(4096)
                    this.length = 0
                    this.peak = 0
                }
            }
        }
        return true
    }

    flush() {
        const rest = this.out.slice(0, this.length)
        this.port.postMessage({ samples: rest.buffer, peak: this.peak, done: true }, [rest.buffer])
    }
}
registerProcessor('downsampler', Downsampler)
`

const MIC_ERRORS = {
    NotAllowedError: 'Microphone access was blocked. Allow it in your browser settings and try again.',
    PermissionDeniedError: 'Microphone access was blocked. Allow it in your browser settings and try again.',
    NotFoundError: 'No microphone was found.',
    NotReadableError: 'The microphone is in use by another app.',
    SecurityError: 'Recording needs a secure (https or localhost) page.'
}

export const recorderSupported =
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof AudioContext !== 'undefined' &&
    typeof AudioWorkletNode !== 'undefined'

export function useAudioRecorder({ onLimit } = {}) {
    const state = ref('idle') // idle | starting | recording
    const seconds = ref(0)
    const level = ref(0)      // 0..1, for a simple input meter
    const error = ref('')

    let stream = null
    let context = null
    let node = null
    let chunks = []
    let sampleCount = 0
    let finishing = null

    function release() {
        if (node) { node.port.onmessage = null; node.disconnect() }
        stream?.getTracks().forEach(t => t.stop())
        context?.close().catch(() => {})
        node = null
        stream = null
        context = null
    }

    async function start() {
        if (state.value !== 'idle') return
        error.value = ''
        state.value = 'starting'
        chunks = []
        sampleCount = 0
        seconds.value = 0

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
            })
            context = new AudioContext()

            const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }))
            try {
                await context.audioWorklet.addModule(url)
            } finally {
                URL.revokeObjectURL(url)
            }

            node = new AudioWorkletNode(context, 'downsampler')
            node.port.onmessage = (event) => {
                const { samples, peak, done } = event.data
                const data = new Int16Array(samples)
                if (data.length) {
                    chunks.push(data)
                    sampleCount += data.length
                    seconds.value = sampleCount / TARGET_RATE
                }
                level.value = Math.min(1, peak * 1.5)

                if (done) finishing?.()
                else if (seconds.value >= MAX_SECONDS && state.value === 'recording') onLimit?.()
            }

            // Routed through a silent gain so the browser keeps pulling audio through the node.
            const silent = context.createGain()
            silent.gain.value = 0
            context.createMediaStreamSource(stream).connect(node)
            node.connect(silent).connect(context.destination)
            await context.resume()

            state.value = 'recording'
        } catch (err) {
            release()
            state.value = 'idle'
            error.value = MIC_ERRORS[err?.name] || 'Could not start recording.'
        }
    }

    // Resolves with a 16 kHz mono WAV Blob (or null when nothing was captured).
    async function stop() {
        if (state.value !== 'recording' || !node) return null

        // Ask the processor for its last partial buffer; the timeout covers a stalled audio thread.
        await new Promise((resolve) => {
            finishing = resolve
            node.port.postMessage({ type: 'flush' })
            setTimeout(resolve, 500)
        })
        finishing = null

        release()
        state.value = 'idle'
        level.value = 0

        if (sampleCount === 0) return null
        return encodeWav(chunks, TARGET_RATE)
    }

    function cancel() {
        release()
        chunks = []
        sampleCount = 0
        seconds.value = 0
        level.value = 0
        state.value = 'idle'
    }

    onBeforeUnmount(cancel)

    return { state, seconds, level, error, start, stop, cancel }
}
