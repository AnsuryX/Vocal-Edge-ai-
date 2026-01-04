// Secure Gemini proxy and static asset server (Workers Assets)
async function handleGeminiProxy(request, env) {
  if (request.method !== 'POST') {
    return new Response('Only POST allowed', { status: 405 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return new Response('Invalid JSON body', { status: 400 });
  }

  // HARDCODED URL: Prevent your worker from being used as a generic open proxy
  const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
  
  const proxiedHeaders = new Headers();
  proxiedHeaders.set('Content-Type', 'application/json');
  
  // FIX: Use x-goog-api-key instead of Authorization Bearer
  if (env.GEMINI_API_KEY) {
    proxiedHeaders.set('x-goog-api-key', env.GEMINI_API_KEY);
  } else {
    return new Response('Worker Secret GEMINI_API_KEY is missing', { status: 500 });
  }

  try {
    const resp = await fetch(GEMINI_URL, { 
      method: 'POST', 
      headers: proxiedHeaders, 
      body: JSON.stringify(payload) // Just pass the Gemini request body directly
    });

    const respBody = await resp.arrayBuffer();
    return new Response(respBody, { 
      status: resp.status, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (err) {
    return new Response(`Proxy error: ${err.message}`, { status: 502 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Securely proxy only this specific endpoint
    if (url.pathname === '/api/proxy') {
      return handleGeminiProxy(request, env);
    }

    // Serve static assets for everything else
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) return assetResponse;

      // SPA Fallback: If asset not found, serve index.html for React Router
      return await env.ASSETS.fetch(new Request(`${url.origin}/index.html`));
    } catch (err) {
      return new Response('Asset error', { status: 500 });
    }
  }
};
