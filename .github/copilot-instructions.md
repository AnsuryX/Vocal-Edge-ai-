<!--
Guidance for AI coding agents working on this repo.
Keep this short, specific, and actionable.
-->
# Copilot Instructions — Vocal Edge AI Coach

Summary
- This is a Vite + React (TypeScript) single-page app that provides a real-time conversational practice coach using Google's GenAI Live API. Core responsibilities: UI (React components), audio capture/processing, and live AI session management.

Key files & boundaries
- UI / entry: [App.tsx](App.tsx) and [index.tsx](index.tsx).
- Components: [components](components/) — examples: [PronunciationWorkshop.tsx](components/PronunciationWorkshop.tsx), [VoiceVisualizer.tsx](components/VoiceVisualizer.tsx), [LiveMetrics.tsx](components/LiveMetrics.tsx). Treat these as presentation + local state only.
- AI + audio services: [services/geminiService.ts](services/geminiService.ts) (primary AI integration and session lifecycle) and [services/audioUtils.ts](services/audioUtils.ts) (base64 encode/decode, pcm→wav, audio buffer helpers).
- Types / constants: [types.ts](types.ts) and [constants.ts](constants.ts) define domain models and config used across components.
- PWA bits: [sw.js](sw.js) and [manifest.json](manifest.json).

Big-picture dataflow
- User microphone → `navigator.mediaDevices.getUserMedia` → `AudioContext` (in `CommunicationCoach.startSession`) → audio frames converted to PCM and sent via `ai.live.connect()` realtime session.
- Server messages arrive in `onmessage` (see `geminiService.ts`) and include: model audio (base64 inlineData), `inputTranscription`, `outputTranscription`, and `turnComplete` events. UI displays real-time transcription and plays model audio via generated `AudioBuffer` objects.
- After session end, conversation turns are collected (text + generated audio URLs via `URL.createObjectURL`) and passed to analysis (`getDetailedAnalysis`).

Project-specific conventions & gotchas
- Environment variable note: this repo now uses `VITE_GEMINI_API_KEY` for client-side builds (see `.env.example`).
	For production do NOT embed real keys in client bundles — prefer a server-side proxy that uses a server-only `GEMINI_API_KEY` secret.
- Audio sample rates: input AudioContext uses 16000Hz for capture, output uses 24000Hz for model playback. Be careful when converting or mixing sample rates (`decodeAudioData`, `pcmToWav`). See [services/geminiService.ts](services/geminiService.ts) and [services/audioUtils.ts](services/audioUtils.ts).
- Realtime message shape: `message.serverContent` is the primary structure. Expect nested fields like `modelTurn.parts[0].inlineData.data` (base64 audio). Use defensive checks before accessing nested properties — code already guards many paths.
- Audio wire format: `createBlob` returns `{ data, mimeType: 'audio/pcm;rate=16000' }` — server expects base64 PCM for realtime input. When producing downloadable audio the code uses `pcmToWav`.

Build / run / debug
- Local dev: `npm install` then `npm run dev` (Vite). Production build: `npm run build`. Preview built output: `npm run preview`.
- Env: add a `.env.local` with the Gemini key. Align the variable name with `services/geminiService.ts` (currently `API_KEY`).
- Node is only needed for Vite; most runtime issues surface in the browser console. For debugging audio flows, open DevTools → Console and Network; inspect live `ai.live` websocket traffic and printed logs in `geminiService.ts`.

AI integration specifics (important)
- Uses `@google/genai` client (models referenced in `geminiService.ts`): e.g. `gemini-2.5-flash-native-audio-preview-09-2025`, `gemini-3-flash-preview`, and TTS variant. When changing model names preserve modalities and responseSchema usage.
- `ai.live.connect({... callbacks })` drives realtime behavior — replicate existing callback shape when adding features. Important callback keys: `onopen`, `onmessage`, `onclose`, `onerror`.
- When adding generation calls, prefer `responseMimeType` and `responseSchema` to force JSON or structured responses (see `generateSuggestedTopics` and `getDetailedAnalysis`).

When editing
- Keep audio helper semantics intact: `decode`/`encode` use base64 atob/btoa pair; `pcmToWav` produces a downloadable WAV blob the UI expects.
- Preserve the `turnComplete` aggregation pattern: recording user/model text+audio into `turns` then resetting buffers. Modifying this flow requires updating components that read `recordedTurns`.
- If you change any model contract or response schema, update the parsing calls that do `JSON.parse(response.text)` and add defensive try/catch around parse points.

Quick examples (copy-paste safe)
- Send realtime PCM blob: use `createBlob(float32Array)` from `services/audioUtils.ts` and send via `session.sendRealtimeInput({ media: blob })` (see `startSession`).
- Decode incoming base64 audio: `const bytes = decode(base64)` then `decodeAudioData(bytes, audioContextOut, 24000, 1)` to get an `AudioBuffer` (see `onmessage`).

Questions to ask the repo owner
- Which env var should we standardize for Gemini credentials: `GEMINI_API_KEY` or `API_KEY`?
- Any stable model names to pin for production vs. experimentation?

If anything here is unclear, point to the file(s) you want expanded and I will update this guidance.
