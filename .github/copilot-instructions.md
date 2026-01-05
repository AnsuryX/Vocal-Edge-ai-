# Copilot instructions for Vocal-Edge-ai

This file gives concise, actionable guidance for AI coding agents working in this repository.

1. Big picture
- Frontend single-page app built with React + TypeScript and Vite. Entry: `index.tsx` -> `App.tsx`.
- Core responsibilities:
  - UI + state management in `App.tsx` and `components/*` (practice flow, metrics, pronunciation workshop).
  - Real-time AI + audio logic in `services/geminiService.ts` (CommunicationCoach).
  - Auth & persistence via Supabase in `services/supabaseClient.ts` and DB tables `profiles` and `sessions` (referenced in `App.tsx`).

2. Critical developer workflows
- Run locally: `npm install` then `npm run dev` (Vite). Build: `npm run build`.
- The app expects a Gemini API key during runtime (development usually provided via AI Studio UI). README mentions `.env.local` and `GEMINI_API_KEY`.
- Primary runtime environment is the browser: many features (WebAudio, `navigator.mediaDevices`, `window.aistudio`) require a browser context.

3. Project-specific patterns and gotchas
- Realtime audio + model: `CommunicationCoach` uses `@google/genai` Live API and streams raw PCM blobs. It constructs system prompts per persona via `getSystemInstruction`.
- Audio handling utilities live in `services/audioUtils.ts` — look there for `pcmToWav`, `decode`, `createBlob` used across the app.
- Auth lifecycle: `App.tsx` checks Supabase session and then `window.aistudio.hasSelectedApiKey()` to determine whether to route to `auth` or `home` screens.
- The code currently includes a client-side Supabase anon key in `services/supabaseClient.ts`. Treat as dev/demo; do not publish secrets. Production should store keys server-side.
- Persona customization: `getSystemInstruction` has persona IDs (e.g. `d3`, `d4`, `d5`) with behavior overrides — changes here affect model character and safety surface.

4. Integration points & external dependencies
- `@google/genai` used for both TTS and Live audio. Expect usage patterns: `ai.live.connect(...)` with callbacks for `onmessage`, `onopen`, `onerror`.
- `@supabase/supabase-js` used for auth and simple row operations. Tables referenced: `profiles`, `sessions`.
- Browser globals: `window.aistudio.openSelectKey()` and `window.aistudio.hasSelectedApiKey()` are relied upon. Tests and headless runs must mock these.

5. Typical change examples (concrete)
- To add a new persona behavior: update `services/geminiService.ts` -> `getSystemInstruction()` and ensure translations in `constants.ts`.
- To add a metric or visualizer: add the metric calculation to `CommunicationCoach.getRealtimeMetrics()` and expose it via the `onTranscriptionUpdate` callback or a new callback.
- To persist additional session fields: update `App.tsx` sessionData and ensure the Supabase table `sessions` schema matches.

6. Testing & debugging tips for agents
- Most logic is browser-only (WebAudio + getUserMedia). Use Chrome with `--unsafely-treat-insecure-origin-as-secure` when testing file:// or non-HTTPS hosts, or run via `vite` dev server.
- Mock `window.aistudio` and `navigator.mediaDevices.getUserMedia` for unit tests. Example mock in Jest: `global.window.aistudio = { hasSelectedApiKey: jest.fn().mockResolvedValue(true) }`.
- When debugging audio timing issues, check `audioContext` sampleRates (input 16000 vs output 24000) in `services/geminiService.ts`.

7. Safety & security notes for agents
- Do not commit real API secrets into source. The repo currently uses a Supabase anon key — treat as non-sensitive for dev but raise PR to replace with environment variables for production.
- Persona prompts contain adversarial-sounding instructions (roasty, aggressive humor). When modifying prompts, keep safety and moderation in mind.

8. Where to look first (quick links)
- App bootstrap: [App.tsx](App.tsx)
- Realtime AI & audio: [services/geminiService.ts](services/geminiService.ts)
- Audio helpers: [services/audioUtils.ts](services/audioUtils.ts)
- Supabase client: [services/supabaseClient.ts](services/supabaseClient.ts)
- Pronunciation UI: [components/PronunciationWorkshop.tsx](components/PronunciationWorkshop.tsx)

If any section is unclear or you want more examples (tests, mock fixtures, or CI steps), tell me which area to expand.
