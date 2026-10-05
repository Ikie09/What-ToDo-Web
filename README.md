# What To Do

Todos (list + Kanban board), meetings with notes, and notes — with dictation, reminders, offline support and export. Vue 3 + Vite + Pinia, talking to the `What-To-Do` ASP.NET Core API.

## Run it

1. Start the API (`What-To-Do` project, `https://localhost:7242`).
2. `npm install`
3. `npm run dev` → http://localhost:5173

Set `VITE_API_BASE_URL` (see `.env.example`) to point at a different API.

## Notes

- Theme: jungle-green palette in `src/assets/theme.css`; light/dark/system via `useTheme()`.
- Offline: edits made offline are queued (`stores/sync.js`) and pushed to `/api/sync/push` on reconnect.
- Dictation uses the browser Web Speech API (Chrome/Edge); reminders use the Notification API while the app is open.
- `npm run build` produces the PWA (service worker included).
