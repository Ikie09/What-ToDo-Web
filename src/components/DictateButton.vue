<template>
    <div class="dictate">
        <button
            type="button"
            class="btn btn-secondary btn-sm"
            :class="{ listening }"
            :aria-pressed="listening"
            :disabled="!supported"
            :title="supported ? '' : 'Dictation is not supported in this browser. Try Chrome or Edge.'"
            @click="toggle"
        >
            <component :is="listening ? MicOff : Mic" :size="16" aria-hidden="true" />
            {{ listening ? 'Stop dictating' : 'Dictate' }}
        </button>
        <span v-if="listening" class="live" role="status" aria-live="polite">
            <span class="dot" aria-hidden="true"></span>
            {{ interim || 'Listening…' }}
        </span>
        <span v-if="error" class="form-error" role="alert">{{ error }}</span>
    </div>
</template>

<script setup>
import { Mic, MicOff } from 'lucide-vue-next'
import { useSpeechToText } from '../composables/useSpeechToText'

const emit = defineEmits(['transcript'])

const { supported, listening, interim, error, toggle } = useSpeechToText({
    onFinal: (text) => emit('transcript', text)
})
</script>

<style scoped>
.dictate {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.6rem;
}

.listening {
    background: var(--danger-soft);
    border-color: var(--danger);
    color: var(--danger);
}

.live {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--text-muted);
    font-style: italic;
}

.dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--danger);
    animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
    50% { opacity: 0.25; }
}
</style>
