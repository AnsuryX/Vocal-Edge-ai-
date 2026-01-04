// Using Cloudflare Workers Assets via `env.ASSETS` (modern approach).
// Wrangler will upload the `dist` folder as assets and bind them to `env.ASSETS`.
async function handleApiProxy(request, env) {
  if (request.method !== 'POST') {
    return new Response('Only POST allowed', { status: 405 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { target, method = 'POST', headers = {}, body } = payload;
  if (!target) return new Response('Missing `target` in body', { status: 400 });

  const proxiedHeaders = new Headers(headers || {});
  // Ensure Authorization uses the server-side secret
  if (env.GEMINI_API_KEY) {
    proxiedHeaders.set('Authorization', `Bearer ${env.GEMINI_API_KEY}`);
  }

  // If JSON body and no content-type, set it
  let fetchBody = undefined;
  if (body !== undefined) {
    if (typeof body === 'string' || body instanceof Uint8Array) {
      fetchBody = body;
    } else {
      if (!proxiedHeaders.has('Content-Type')) proxiedHeaders.set('Content-Type', 'application/json');
      fetchBody = JSON.stringify(body);
    }
  }

  try {
    const resp = await fetch(target, { method, headers: proxiedHeaders, body: fetchBody });
    const respBody = await resp.arrayBuffer();
    const responseHeaders = new Headers(resp.headers);
    responseHeaders.delete('transfer-encoding');
    return new Response(respBody, { status: resp.status, headers: responseHeaders });
  } catch (err) {
    return new Response(`Proxy error: ${err.message || err}`, { status: 502 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle API proxy routes under /api/
    if (url.pathname.startsWith('/api/')) {
      // Use /api/proxy for generic forwarding
      if (url.pathname === '/api/proxy') {
        return handleApiProxy(request, env);
      }
      return new Response('Unknown API endpoint', { status: 404 });
    }

    // Serve static assets using the modern Workers Assets binding.
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      // If asset exists, return it. If not, fallback to index.html for SPA routing.
      if (assetResponse.status !== 404) return assetResponse;
      return await env.ASSETS.fetch(new Request(`${new URL(request.url).origin}/index.html`));
    } catch (err) {
      return new Response('Asset error', { status: 500 });
    }
  }
};
