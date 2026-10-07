# What To Do

Todos (list + Kanban board), meetings with notes, notes, budgeting, a calculator and insights — with dictation, server transcription, reminders (also push), offline support and export. Vue 3 + Vite + Pinia, talking to the `What-To-Do` ASP.NET Core API.

## Run it

1. Start the API (`What-To-Do` project, `https://localhost:7242`).
2. `npm install`
3. `npm run dev` → http://localhost:5173

Set `VITE_API_BASE_URL` (see `.env.example`) to point at a different API.

## Testing push notifications

Service workers only exist in the production build, so push can't be tried with `npm run dev`:

```bash
npm run build
npm run preview        # http://localhost:4173
```

The API must have VAPID keys configured (see the API README), then turn push on in Settings → Reminders. On iPhone/iPad the app has to be added to the Home Screen first.

## Notes

- Theme: jungle-green palette in `src/assets/theme.css`; light/dark/system via `useTheme()`.
- Offline: edits made offline are queued (`stores/sync.js`) and pushed to `/api/sync/push` on reconnect.
- Voice: *Dictate* uses the browser Web Speech API (Chrome/Edge); *Record & transcribe* records 16 kHz audio in the browser and has the API transcribe it with a local Whisper model (shown only when the server has transcription enabled).
- Reminders: in-app notifications while the app is open; with push on, the server also notifies when it is closed (the in-app alerts pause on that device so you aren't told twice).
- `npm run build` produces the PWA (service worker included).
