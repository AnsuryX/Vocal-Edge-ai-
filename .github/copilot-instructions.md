<!--
Guidance for AI coding agents working on this repo.
Keep this short, specific, and actionable.
-->
# Copilot Instructions — Vocal Edge AI Coach

Summary
- This is a Vite + React (TypeScript) single-page app that provides a real-time conversational practice coach using Google's GenAI Live API. Core responsibilities: UI (React components), audio capture/processing, and live AI session management.

<!-- Guidance for AI coding agents working on this repo. Keep this short, specific, and actionable. -->
# Copilot Instructions — Vocal Edge AI Coach

Summary
- Vite + React (TypeScript) SPA that provides a realtime conversational practice coach using Google's GenAI (Live + REST) APIs. Responsibilities: UI components, audio capture/processing, live session lifecycle, and a Cloudflare Worker proxy.

Key files & boundaries
- Entry / UI: [App.tsx](App.tsx) and [index.tsx](index.tsx).
- Components: [components/](components/) — `PronunciationWorkshop.tsx`, `VoiceVisualizer.tsx`, `LiveMetrics.tsx` are presentation + local state only.
- AI + audio services: [services/geminiService.ts](services/geminiService.ts) (real-time session, transcription, TTS, structured analysis) and [services/audioUtils.ts](services/audioUtils.ts) (base64 encode/decode, pcm→wav, blob helpers).
- Server proxy: [workers/proxy/index.js](workers/proxy/index.js) — the recommended place to store the server-only `GEMINI_API_KEY` secret. The worker exposes `/api/proxy` and injects the server key into proxied requests.

Big-picture dataflow
- Microphone → `navigator.mediaDevices.getUserMedia` → input `AudioContext` (16000Hz) → frames → `createBlob` → `ai.live.connect()` realtime session in `CommunicationCoach.startSession`.
- Server responses arrive in `onmessage` and often contain base64 inline audio (`modelTurn.parts[0].inlineData.data`), `inputTranscription`, `outputTranscription`, and `turnComplete`. Audio is decoded then played via `AudioContext` (24000Hz) and turns are saved as WAV blobs (`pcmToWav`) and `URL.createObjectURL`.

Runtime & environment notes (critical)
- Client-side env: `VITE_GEMINI_API_KEY` is read by `services/geminiService.ts` (via `import.meta.env`). If set, the key will be embedded into the client bundle — only for prototypes.
- Server-side / Worker: the Worker expects a server-only `GEMINI_API_KEY` (see `workers/proxy/index.js`) and will inject `x-goog-api-key` when present. Use `VITE_PROXY_URL` to point client calls to the worker; the app prefers the proxy when available.
- Recommended pattern: deploy the Worker with `GEMINI_API_KEY` secret and set `VITE_PROXY_URL` in the client. This avoids embedding a key in the bundle.

App startup & key-selection flow
- The app calls `window.aistudio.hasSelectedApiKey()` and `window.aistudio.openSelectKey()` when present (these are provided by some hosting/dev environments). Code uses optional chaining to avoid crashes if `aistudio` is absent.
- There's a local override flag: `localStorage['ve_skip_api']='1'` — using the UI "SKIP (use worker key)" button will set this and let the frontend proceed to the app even when no client key is present (worker-only key). The profile screen exposes a "Clear skip" control to remove the flag.

Audio & model details
- Input capture sample rate: 16000Hz. Output playback: 24000Hz. See `services/geminiService.ts` where two AudioContexts are created.
- Realtime model(s) used in repo examples: `gemini-2.5-flash-native-audio-preview-09-2025` (live audio), `gemini-3-flash-preview` (analysis), and TTS variants. When changing models keep `responseModalities` and `responseSchema` consistent.

Proxy usage patterns
- `services/geminiService.ts` falls back to the worker proxy when `VITE_PROXY_URL` is set. Proxy contract: POST `/api/proxy` with { target, method, headers, body } — the worker forwards to Gemini and injects server `GEMINI_API_KEY`.
- Worker enforces a hardcoded target base and will return 500 if the server-side secret is missing; see `workers/proxy/index.js` lines that set `x-goog-api-key`.

Quick developer examples
- Generate suggested topics via proxy (recommended): the service calls `callProxy('/v1/models/<model>:generate', body)` — check `generateSuggestedTopics` in `services/geminiService.ts`.
- Decode model audio: `const bytes = decode(base64); const buffer = await decodeAudioData(bytes, audioContextOut, 24000, 1)`.

Testing / debugging
- Local dev: `npm install` then `npm run dev` (Vite). Use browser DevTools (Console + Network) to inspect `/api/proxy` calls and `ai.live` websocket traffic.
- To test worker-key-only flow locally: deploy or run a compatible worker that responds at `VITE_PROXY_URL`. Alternatively, use the UI "SKIP (use worker key)" button to bypass the client key prompt during development.

When editing
- Avoid changing the audio helper semantics (`decode`, `encode`, `pcmToWav`) without updating consumers in `CommunicationCoach` and components that expect `audioUrl` blobs.
- Maintain the `turnComplete` aggregation pattern: user/model text + audio are pushed into `turns` and then reset. Changing this requires updating any code that reads `recordedTurns`.

Questions to ask the repo owner
- Should we standardize on `GEMINI_API_KEY` (server) + `VITE_PROXY_URL` for all environments, or allow `VITE_GEMINI_API_KEY` in prototyping builds?
- Which model names should be pinned for production vs. experiments?

If you want, I can expand any of these sections with file-level jump links or add a short checklist for deploying the Worker with Cloudflare secrets.
