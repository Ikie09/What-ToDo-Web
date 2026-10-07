import { ref } from 'vue'

// One calculator for the whole app. A form can call open({ onUse }) to get the result back
// (e.g. the budget amount field), otherwise it works as a plain calculator.
const isOpen = ref(false)
const onUse = ref(null)

export function useCalculator() {
    return {
        isOpen,
        canUse: () => !!onUse.value,
        open(options = {}) {
            onUse.value = options.onUse || null
            isOpen.value = true
        },
        close() {
            isOpen.value = false
            onUse.value = null
        },
        use(value) {
            if (onUse.value) onUse.value(value)
            isOpen.value = false
            onUse.value = null
        }
    }
}
