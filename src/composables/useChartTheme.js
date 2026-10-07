import { computed } from 'vue'
import { useTheme } from './useTheme'

// Shared ApexCharts options so every chart follows the light/dark theme and the jungle-green palette.
export function useChartTheme() {
    const { resolved } = useTheme()
    const dark = computed(() => resolved.value === 'dark')

    const colors = computed(() => dark.value
        ? { primary: '#46B88F', soft: '#74CBA8', danger: '#F97066', warning: '#FDB022', muted: '#9DB8AC', income: '#46B88F', expense: '#F97066', surface: '#0D1F18', grid: '#1E3A31', text: '#9DB8AC' }
        : { primary: '#1A6F58', soft: '#29AB87', danger: '#B42318', warning: '#B54708', muted: '#6B8579', income: '#29AB87', expense: '#B42318', surface: '#FFFFFF', grid: '#D5E6DE', text: '#4B6A5E' })

    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Merge chart-specific options on top of the shared base.
    function options(extra = {}) {
        const c = colors.value
        const base = {
            theme: { mode: dark.value ? 'dark' : 'light' },
            chart: {
                background: 'transparent',
                foreColor: c.text,
                fontFamily: 'Inter Variable, system-ui, sans-serif',
                toolbar: { show: false },
                animations: { enabled: !reducedMotion }
            },
            grid: { borderColor: c.grid, strokeDashArray: 3 },
            stroke: { colors: undefined },
            dataLabels: { enabled: false },
            legend: { position: 'bottom', markers: { shape: 'circle' } },
            tooltip: { theme: dark.value ? 'dark' : 'light' },
            noData: { text: 'No data yet' }
        }
        return merge(base, extra)
    }

    // vue3-apexcharts JSON-clones options on every update, which strips formatter functions.
    // Using this as the component :key re-creates the chart when the data/theme changes, so the
    // formatters in the initial options are always the ones in effect.
    const key = (...parts) => JSON.stringify([dark.value, ...parts])

    return { dark, colors, options, key }
}

function merge(target, source) {
    const out = { ...target }
    for (const [key, value] of Object.entries(source)) {
        out[key] = value && typeof value === 'object' && !Array.isArray(value) && typeof target[key] === 'object'
            ? merge(target[key], value)
            : value
    }
    return out
}
