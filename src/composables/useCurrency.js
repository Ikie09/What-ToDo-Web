import { ref, computed } from 'vue'

const STORAGE_KEY = 'currency'

const EURO_REGIONS = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'IE', 'PT', 'AT', 'FI', 'GR', 'LU', 'SK', 'SI', 'EE', 'LV', 'LT', 'MT', 'CY', 'HR']
const REGION_CURRENCY = {
    US: 'USD', GB: 'GBP', KE: 'KES', UG: 'UGX', TZ: 'TZS', RW: 'RWF', ET: 'ETB', NG: 'NGN', GH: 'GHS', ZA: 'ZAR',
    EG: 'EGP', MA: 'MAD', IN: 'INR', PK: 'PKR', BD: 'BDT', CN: 'CNY', JP: 'JPY', KR: 'KRW', AE: 'AED', SA: 'SAR',
    CA: 'CAD', AU: 'AUD', NZ: 'NZD', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', BR: 'BRL', MX: 'MXN'
}

function detectCurrency() {
    try {
        const region = new Intl.Locale(navigator.language).maximize().region
        if (EURO_REGIONS.includes(region)) return 'EUR'
        return REGION_CURRENCY[region] || 'USD'
    } catch {
        return 'USD'
    }
}

function isValid(code) {
    try {
        new Intl.NumberFormat(undefined, { style: 'currency', currency: code })
        return true
    } catch {
        return false
    }
}

function readCurrency() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved && isValid(saved)) return saved
    } catch { /* fall through */ }
    return detectCurrency()
}

// One shared choice for the whole app (a display preference; amounts are plain numbers).
const currency = ref(readCurrency())
const formatters = new Map()

function formatterFor(code) {
    if (!formatters.has(code)) {
        formatters.set(code, new Intl.NumberFormat(navigator.language, { style: 'currency', currency: code }))
    }
    return formatters.get(code)
}

export function currencyOptions() {
    let codes
    try {
        codes = Intl.supportedValuesOf('currency')
    } catch {
        codes = ['USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS', 'NGN', 'ZAR', 'INR', 'JPY', 'CNY', 'CAD', 'AUD']
    }
    let names = null
    try { names = new Intl.DisplayNames(navigator.language, { type: 'currency' }) } catch { /* names optional */ }
    return codes.map(code => ({ code, label: names ? `${code} — ${names.of(code)}` : code }))
}

export function useCurrency() {
    function setCurrency(code) {
        if (!isValid(code)) return
        currency.value = code
        try { localStorage.setItem(STORAGE_KEY, code) } catch { /* still applies this session */ }
    }

    const format = (amount) => formatterFor(currency.value).format(amount)

    // Axis labels: no decimals, compact for big numbers.
    const formatCompact = (amount) =>
        new Intl.NumberFormat(navigator.language, {
            style: 'currency', currency: currency.value, notation: 'compact', maximumFractionDigits: 1
        }).format(amount)

    const symbol = computed(() =>
        formatterFor(currency.value).formatToParts(0).find(p => p.type === 'currency')?.value || currency.value)

    return { currency, symbol, setCurrency, format, formatCompact }
}
