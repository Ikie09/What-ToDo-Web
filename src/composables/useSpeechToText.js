import { ref, onBeforeUnmount } from 'vue'

const Recognition = typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

export const speechSupported = !!Recognition

/**
 * Browser dictation (Web Speech API). `onFinal(text)` receives each finished phrase;
 * `interim` holds the in-progress phrase so the UI can preview it.
 */
export function useSpeechToText({ onFinal, lang = navigator.language || 'en-US' } = {}) {
    const listening = ref(false)
    const interim = ref('')
    const error = ref('')

    let recognition = null

    function start() {
        if (!Recognition || listening.value) return
        error.value = ''

        recognition = new Recognition()
        recognition.lang = lang
        recognition.continuous = true
        recognition.interimResults = true

        recognition.onresult = (event) => {
            let partial = ''
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i]
                if (result.isFinal) {
                    const text = result[0].transcript.trim()
                    if (text && onFinal) onFinal(text)
                } else {
                    partial += result[0].transcript
                }
            }
            interim.value = partial
        }

        recognition.onerror = (event) => {
            const messages = {
                'not-allowed': 'Microphone access was blocked. Allow it in your browser settings.',
                'service-not-allowed': 'Speech recognition is not allowed in this browser.',
                'no-speech': 'No speech detected.',
                'audio-capture': 'No microphone was found.',
                'network': 'Speech recognition needs an internet connection.'
            }
            error.value = messages[event.error] || `Speech recognition error: ${event.error}`
            listening.value = false
        }

        recognition.onend = () => {
            listening.value = false
            interim.value = ''
        }

        recognition.start()
        listening.value = true
    }

    function stop() {
        if (recognition) recognition.stop()
        listening.value = false
        interim.value = ''
    }

    function toggle() {
        if (listening.value) stop()
        else start()
    }

    onBeforeUnmount(() => {
        if (recognition) recognition.abort()
    })

    return { supported: speechSupported, listening, interim, error, start, stop, toggle }
}
