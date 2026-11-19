// Forge — optional Gemini proxy for Cloudflare Workers (free tier).
// Keeps your Gemini API key off the phone. Secrets/vars (set with wrangler):
//   GEMINI_API_KEY  (secret, required)  — your Google AI Studio key
//   APP_TOKEN       (secret, optional)  — if set, the proxy URL must be https://<worker>/<APP_TOKEN>
//   ALLOWED_ORIGIN  (var, optional)     — e.g. https://yourname.github.io  (defaults to *)

const UPSTREAM = 'https://generativelanguage.googleapis.com/v1beta/';

function cors(env, origin) {
  const allowed = env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': allowed === '*' ? '*' : allowed.split(',').map((s) => s.trim()).includes(origin) ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(env, origin);
    if (request.method === 'OPTIONS') return new Response(null, { headers });

    const url = new URL(request.url);
    let path = url.pathname.replace(/^\/+/, '');
    if (env.APP_TOKEN) {
      const [first, ...rest] = path.split('/');
      if (first !== env.APP_TOKEN) return new Response('Forbidden', { status: 403, headers });
      path = rest.join('/');
    }
    // Only allow the two endpoints the app uses.
    const isList = request.method === 'GET' && /^models\/?$/.test(path);
    const isGenerate = request.method === 'POST' && /^models\/[\w.\-]+:generateContent$/.test(path);
    if (!isList && !isGenerate) return new Response('Not found', { status: 404, headers });

    const upstream = await fetch(UPSTREAM + path + url.search, {
      method: request.method,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: request.method === 'POST' ? await request.text() : undefined,
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...headers, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
    });
  },
};
