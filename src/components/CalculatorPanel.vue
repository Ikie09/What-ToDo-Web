<template>
    <AppModal :open="isOpen" title="Calculator" width="340px" @update:open="onOpenChange">
        <div class="calc">
            <div class="screen">
                <label class="sr-only" for="calc-input">Expression</label>
                <input
                    id="calc-input"
                    ref="inputEl"
                    v-model="expression"
                    type="text"
                    inputmode="decimal"
                    autocomplete="off"
                    spellcheck="false"
                    autofocus
                    placeholder="0"
                    @keydown.enter.prevent="equals"
                />
                <p class="preview" role="status" aria-live="polite">
                    <span v-if="error" class="error">{{ error }}</span>
                    <span v-else-if="preview !== null">= {{ preview }}</span>
                </p>
            </div>

            <div class="keys">
                <button v-for="k in keys" :key="k.label" type="button" :class="['key', k.kind]" :aria-label="k.aria" @click="press(k)">
                    {{ k.label }}
                </button>
            </div>

            <div v-if="history.length" class="history">
                <h3>Recent</h3>
                <ul>
                    <li v-for="h in history" :key="h.id">
                        <button type="button" @click="reuse(h)">
                            <span class="h-expr">{{ h.expression }}</span>
                            <span class="h-result">= {{ h.result }}</span>
                        </button>
                    </li>
                </ul>
            </div>

            <button v-if="canUse" type="button" class="btn use" :disabled="!usable" @click="useResult">
                <CornerDownLeft :size="16" aria-hidden="true" /> Use result
            </button>
        </div>
    </AppModal>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { CornerDownLeft } from 'lucide-vue-next'
import AppModal from './AppModal.vue'
import { useCalculator } from '../composables/useCalculator'
import { evaluate, formatResult, CalcError } from '../utils/calc'

const calculator = useCalculator()
const { isOpen } = calculator

const expression = ref('')
const error = ref('')
const history = ref([])
const inputEl = ref(null)
let historyId = 0

const canUse = computed(() => isOpen.value && calculator.canUse())

// Live preview only when there is something to calculate (a bare number needs no "= 5").
const preview = computed(() => {
    const text = expression.value.trim()
    if (!text || !/[-+−×÷*/%()]/.test(text.replace(/^-/, ''))) return null
    try {
        return formatResult(evaluate(text))
    } catch {
        return null
    }
})

const usable = computed(() => {
    try {
        evaluate(expression.value)
        return true
    } catch {
        return false
    }
})

const keys = [
    { label: 'C', aria: 'Clear', kind: 'fn', action: 'clear' },
    { label: '(', aria: 'Open parenthesis', kind: 'fn' },
    { label: ')', aria: 'Close parenthesis', kind: 'fn' },
    { label: '÷', aria: 'Divide', kind: 'op' },
    { label: '7', aria: '7' }, { label: '8', aria: '8' }, { label: '9', aria: '9' },
    { label: '×', aria: 'Multiply', kind: 'op' },
    { label: '4', aria: '4' }, { label: '5', aria: '5' }, { label: '6', aria: '6' },
    { label: '−', aria: 'Minus', kind: 'op' },
    { label: '1', aria: '1' }, { label: '2', aria: '2' }, { label: '3', aria: '3' },
    { label: '+', aria: 'Plus', kind: 'op' },
    { label: '0', aria: '0' },
    { label: '.', aria: 'Decimal point' },
    { label: '⌫', aria: 'Backspace', kind: 'fn', action: 'back' },
    { label: '=', aria: 'Equals', kind: 'eq', action: 'equals' }
]

function focusInput() {
    nextTick(() => inputEl.value?.focus())
}

function press(key) {
    error.value = ''
    if (key.action === 'clear') expression.value = ''
    else if (key.action === 'back') expression.value = expression.value.slice(0, -1)
    else if (key.action === 'equals') return equals()
    else expression.value += key.label
    focusInput()
}

function equals() {
    const text = expression.value.trim()
    if (!text) return
    try {
        const result = formatResult(evaluate(text))
        error.value = ''
        history.value = [{ id: ++historyId, expression: text, result }, ...history.value].slice(0, 5)
        expression.value = result
    } catch (e) {
        error.value = e instanceof CalcError ? e.message : 'Could not calculate that'
    }
    focusInput()
}

function reuse(entry) {
    expression.value = entry.result
    error.value = ''
    focusInput()
}

function useResult() {
    try {
        calculator.use(evaluate(expression.value))
    } catch {
        error.value = 'Enter a valid calculation first'
    }
}

function onOpenChange(open) {
    if (!open) calculator.close()
}

// A form that asks for a result starts from a clean slate.
watch(isOpen, (open) => {
    if (open) {
        error.value = ''
        if (calculator.canUse()) expression.value = ''
        focusInput()
    }
})
</script>

<style scoped>
.calc { display: flex; flex-direction: column; gap: 0.9rem; }

.screen { display: flex; flex-direction: column; gap: 0.25rem; }
.screen input {
    min-height: 56px;
    font-size: 1.6rem;
    font-weight: 600;
    text-align: right;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
}
.preview { min-height: 1.4rem; text-align: right; font-size: 0.95rem; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.error { color: var(--danger); }

.keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
.key {
    min-height: 48px;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.1s, transform 0.05s;
}
.key:hover { background: var(--surface-3); }
.key:active { transform: translateY(1px); }
.key.op { color: var(--primary-text); background: var(--primary-soft); }
.key.fn { color: var(--text-muted); }
.key.eq { color: var(--on-primary); background: var(--primary); border-color: transparent; }
.key.eq:hover { background: var(--primary-hover); }

.history h3 { margin-bottom: 0.35rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
.history ul { display: flex; flex-direction: column; gap: 0.15rem; }
.history button {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    padding: 0.3rem 0.5rem;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    background: transparent;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
}
.history button:hover { background: var(--surface-2); color: var(--text); }
.h-result { font-weight: 600; color: var(--text); }

.use { width: 100%; }
</style>
