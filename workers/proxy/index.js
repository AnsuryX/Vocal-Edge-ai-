export default {
  async fetch(request, env) {
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
      // Clone and forward response
      const respBody = await resp.arrayBuffer();
      const responseHeaders = new Headers(resp.headers);
      // Remove hop-by-hop headers that Cloudflare may not accept
      responseHeaders.delete('transfer-encoding');
      return new Response(respBody, { status: resp.status, headers: responseHeaders });
    } catch (err) {
      return new Response(`Proxy error: ${err.message || err}`, { status: 502 });
    }
  }
};
