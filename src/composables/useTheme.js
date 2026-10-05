import { ref, computed } from 'vue'

const STORAGE_KEY = 'theme'
const query = window.matchMedia('(prefers-color-scheme: dark)')

function readMode() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved === 'light' || saved === 'dark' ? saved : 'system'
    } catch {
        return 'system'
    }
}

// Module-level state so every component shares one theme.
const mode = ref(readMode())
const systemDark = ref(query.matches)

const resolved = computed(() => {
    if (mode.value === 'system') return systemDark.value ? 'dark' : 'light'
    return mode.value
})

function apply() {
    document.documentElement.setAttribute('data-theme', resolved.value)
}

query.addEventListener('change', (e) => {
    systemDark.value = e.matches
    apply()
})

export function useTheme() {
    function setMode(next) {
        mode.value = next
        try {
            if (next === 'system') localStorage.removeItem(STORAGE_KEY)
            else localStorage.setItem(STORAGE_KEY, next)
        } catch { /* storage unavailable: theme still applies for this session */ }
        apply()
    }

    // Header toggle flips between the two visible themes.
    function toggle() {
        setMode(resolved.value === 'dark' ? 'light' : 'dark')
    }

    return { mode, resolved, setMode, toggle }
}

export function initTheme() {
    apply()
}
