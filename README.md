<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1_hybgcEFmrhe0UEqIG6E4uAqXOKxmd8P

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deployment

This app is a static Single-Page App (built by Vite) and can be hosted on Vercel or Cloudflare Pages.

- Build the production bundle:

```bash
npm install
npm run build
```

- The production build output is in `dist/`. Configure your hosting platform to serve `dist` as a static site.

Vercel
- Create a new Vercel project and point it at this repository. Use the default settings or set:

   - Build command: `npm run build`
   - Output directory: `dist`

Set the environment variable `VITE_GEMINI_API_KEY` in the Vercel dashboard if you understand the security implications (this will expose the key to the client bundle). For production, prefer a server-side proxy (see Security below).

Cloudflare Pages
- Create a Pages project, set the build command to `npm run build` and the build output directory to `dist`.
 - Create a Pages project, set the build command to `npm run build` and the build output directory to `dist`.
 - Add the following environment variables in Pages (recommended):
    - `VITE_PROXY_URL` = your Worker URL (e.g., `https://vocaledge-ai-proxy.YOUR_ACCOUNT.workers.dev`) — the client will call this worker for server-side GenAI requests.
    - `VITE_GENAI_REST_BASE` = optional GenAI REST base (e.g., `https://genai.googleapis.com`). If left empty, the client will post absolute target URLs to the proxy.
    - (Do NOT set `VITE_GEMINI_API_KEY` for production.)

Security (very important)
- `services/geminiService.ts` currently reads the API key from `import.meta.env.VITE_GEMINI_API_KEY`. Vite will embed that key into the client bundle — anyone can inspect it. DO NOT put real production API keys into client-visible env vars.
- Recommended production approach: implement serverless API endpoints (Vercel Functions / Cloudflare Functions) that hold the real `GEMINI_API_KEY` as a server-only secret and forward requests to the GenAI API. Keep realtime/live integrations behind a secure server or use a proper token exchange flow supported by the provider.

If you want, I can scaffold a minimal Vercel/Cloudflare serverless proxy for the non-realtime generation endpoints.

Cloudflare Worker proxy (scaffolded)
- A minimal proxy worker is included at `workers/proxy/index.js` and `wrangler.toml` for deployment with Wrangler.
- This worker accepts a POST JSON body: `{ "target": "<full-target-url>", "method": "POST", "headers": {...}, "body": {...} }` and forwards the request to `target` with a server-side `GEMINI_API_KEY` set as a secret in the Worker environment.

Deploying the worker (local quick steps):

```bash
# Install Wrangler (if not installed)
npm install -g wrangler

# Login
wrangler login

# Set the secret (do not check this into source control)
wrangler secret put GEMINI_API_KEY

# Publish the worker
wrangler publish
```

After deploying, update `services/geminiService.ts` to call your worker proxy endpoints instead of using a client-side API key. I can update the client to use the deployed proxy automatically if you provide the worker URL.
