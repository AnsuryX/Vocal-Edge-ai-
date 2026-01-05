<div align="center">
<h1>VocalEdge — AI Communication Coach</h1>
</div>

VocalEdge is a browser-first React + TypeScript single-page app that provides realtime practice and feedback for spoken conversations. It pairs your microphone with AI personas to deliver probing, characterful practice and post-session analysis.

## Features
- Real-time audio coaching: live energy and pace metrics while you speak.
- Probing AI personas: configurable personas (supportive, roasty, sarcastic) that challenge the user.
- Pronunciation workshop: focused practice on target words with TTS and recording analysis.
- Session recording: saves turn-by-turn audio + transcripts to persist with Supabase.
- Post-session analysis: automated scoring and detailed, JSON-formatted feedback from the model.
- Multilingual support: English and Arabic variants supported across UI and persona prompts.

## Quick start (local development)

Prerequisites: Node.js (16+ recommended), npm

1. Install dependencies:

```bash
npm install
```

2. Provide your Gemini (or equivalent) API key in a local env file:

```bash
# create .env.local at project root
GEMINI_API_KEY=your_api_key_here
```

3. Run the dev server (Vite):

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
npm run preview
```

Notes:
- The app uses browser APIs (`navigator.mediaDevices.getUserMedia`, WebAudio). Run via the dev server (not file://) and use a secure origin when testing microphone features.

## Architecture (high level)
- Entry: `index.tsx` → `App.tsx` (main UI + routing state).
- Real-time/AI audio: `services/geminiService.ts` (CommunicationCoach) — handles audio capture, model live connection, TTS, and session analysis.
- Audio helpers: `services/audioUtils.ts` — PCM/encoding helpers used across the app.
- Backend persistence and auth: `services/supabaseClient.ts` with tables `profiles` and `sessions`.
- UI components: `components/*` — `PronunciationWorkshop.tsx`, `LiveMetrics.tsx`, `VoiceVisualizer.tsx`, `LanguageSwitcher.tsx`.

## Project-specific notes & gotchas
- The live audio pipeline uses two AudioContexts with different sample rates (input 16kHz, output 24kHz). See `services/geminiService.ts` for details.
- Persona behavior is produced by `getSystemInstruction()` inside `services/geminiService.ts`. Small edits here change how personas respond.
- A Supabase anon key is present for development in `services/supabaseClient.ts`. Do not commit real production keys; move secrets to a server-side store for production.
- Tests are not included. To write unit tests, mock `navigator.mediaDevices` and WebAudio APIs.

## Files to inspect first
- `App.tsx` — app boot, auth flow, and session lifecycle
- `services/geminiService.ts` — live audio + model integration
- `services/audioUtils.ts` — audio encoding/decoding helpers
- `components/PronunciationWorkshop.tsx` — pronunciation flows and TTS usage

## Contributing
- Fork, branch, and open a PR. Keep changes focused and include testing notes for audio-related work.

## License
This project is provided as-is for development and experimentation.

