// Minimal JWT payload decoder — no signature verification (the server already did that).
export function decodeJwt(token) {
    try {
        const payload = token.split('.')[1]
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
        return JSON.parse(decodeURIComponent(escape(json)))
    } catch {
        return null
    }
}
