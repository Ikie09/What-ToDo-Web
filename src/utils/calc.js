// Safe arithmetic evaluator (recursive descent, no eval).
// Supports + - × ÷ * / ( ) unary minus, decimals and postfix %.
// "a + b%" / "a - b%" mean "a plus/minus b percent of a" (like a pocket calculator); a bare "b%" is b/100.

export class CalcError extends Error {}

const OPERATORS = { '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '/': '/', '÷': '/' }

function tokenize(input) {
    const tokens = []
    const src = input
    let i = 0

    while (i < src.length) {
        const ch = src[i]

        if (/\s/.test(ch)) {
            i++
        } else if (/[0-9.]/.test(ch)) {
            let j = i
            while (j < src.length && /[0-9.]/.test(src[j])) j++
            const text = src.slice(i, j)
            if ((text.match(/\./g) || []).length > 1 || text === '.') throw new CalcError('Invalid number')
            // "2 3" is ambiguous (23?), so reject it instead of guessing.
            if (/^\s+[0-9.]/.test(src.slice(j))) throw new CalcError('Unexpected symbol')
            tokens.push({ type: 'num', value: parseFloat(text) })
            i = j
        } else if (ch in OPERATORS) {
            tokens.push({ type: 'op', value: OPERATORS[ch] })
            i++
        } else if (ch === '(' || ch === ')') {
            tokens.push({ type: ch })
            i++
        } else if (ch === '%') {
            tokens.push({ type: 'pct' })
            i++
        } else {
            throw new CalcError(`Unexpected "${ch}"`)
        }
    }
    return tokens
}

// Floating point noise (0.1 + 0.2) is rounded away at 12 significant digits.
export function clean(n) {
    return Number(parseFloat(n.toPrecision(12)))
}

export function evaluate(input) {
    const tokens = tokenize(input)
    if (tokens.length === 0) throw new CalcError('Empty expression')

    let pos = 0
    const peek = () => tokens[pos]
    const next = () => tokens[pos++]

    // Each parse function returns { value, pct } where pct marks a bare percentage literal.
    function parseExpression() {
        const left = parseTerm()
        let acc = left.value

        while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
            const op = next().value
            const right = parseTerm()
            const amount = right.pct ? acc * right.value : right.value
            acc = op === '+' ? acc + amount : acc - amount
        }
        return { value: acc, pct: false }
    }

    function parseTerm() {
        let left = parseFactor()
        let acc = left.value
        let pct = left.pct

        while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
            const op = next().value
            const right = parseFactor()
            if (op === '/' && right.value === 0) throw new CalcError('Cannot divide by zero')
            acc = op === '*' ? acc * right.value : acc / right.value
            pct = false
        }
        return { value: acc, pct }
    }

    function parseFactor() {
        const t = next()
        if (!t) throw new CalcError('Unexpected end')

        if (t.type === 'op' && (t.value === '-' || t.value === '+')) {
            const inner = parseFactor()
            return { value: t.value === '-' ? -inner.value : inner.value, pct: inner.pct }
        }

        let result
        if (t.type === 'num') {
            result = { value: t.value, pct: false }
        } else if (t.type === '(') {
            const inner = parseExpression()
            if (!peek() || peek().type !== ')') throw new CalcError('Missing )')
            next()
            result = { value: inner.value, pct: false }
        } else {
            throw new CalcError('Unexpected symbol')
        }

        while (peek() && peek().type === 'pct') {
            next()
            result = { value: result.value / 100, pct: true }
        }
        return result
    }

    const result = parseExpression()
    if (pos < tokens.length) throw new CalcError('Unexpected symbol')
    if (!Number.isFinite(result.value)) throw new CalcError('Result is too large')
    return clean(result.value)
}

// Plain string for the display / "use result" (no grouping, no float noise).
export function formatResult(n) {
    const value = clean(n)
    if (Math.abs(value) >= 1e15 || (value !== 0 && Math.abs(value) < 1e-9)) return value.toExponential(6)
    return String(value)
}
