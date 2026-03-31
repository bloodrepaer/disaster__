/**
 * DisasterNet — Vercel Edge Function: AI Proxy
 * Keeps the Anthropic API key server-side so it never reaches the browser.
 *
 * Deploy: set ANTHROPIC_API_KEY in Vercel project environment variables.
 * Endpoint: POST /api/ai-proxy  { prompt: string, systemPrompt?: string }
 */

export const config = { runtime: 'edge' };

const DEFAULT_ALLOWED_ORIGINS = [
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
  process.env.ALLOWED_ORIGIN,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : '',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].map(origin => (origin || '').trim()).filter(Boolean);

const ALLOWED_ORIGINS = new Set(DEFAULT_ALLOWED_ORIGINS);

function resolveAllowedOrigin(req) {
  const origin = req.headers.get('origin') || '';
  if (origin && ALLOWED_ORIGINS.has(origin)) return origin;
  if (!origin && ALLOWED_ORIGINS.size === 1) return Array.from(ALLOWED_ORIGINS)[0];
  return 'null';
}

export default async function handler(req) {
  const allowedOrigin = resolveAllowedOrigin(req);
  const corsBaseHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Vary': 'Origin',
  };

  if (allowedOrigin === 'null') {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { ...corsBaseHeaders, 'Content-Type': 'application/json' },
    });
  }

  // CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsBaseHeaders,
        'Access-Control-Allow-Methods': 'POST, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // HEAD — let the client check if the proxy is deployed
  if (req.method === 'HEAD') {
    return new Response(null, {
      status: process.env.ANTHROPIC_API_KEY ? 200 : 503,
      headers: corsBaseHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured on server' }),
      { status: 503, headers: { 'Content-Type': 'application/json', ...corsBaseHeaders } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsBaseHeaders },
    });
  }

  const { prompt, systemPrompt } = body;
  if (!prompt || typeof prompt !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing or invalid "prompt" field' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsBaseHeaders },
    });
  }

  // Forward to Anthropic with streaming
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 350,
      stream: true,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  // Stream the SSE response straight back to the browser
  return new Response(anthropicRes.body, {
    status: anthropicRes.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...corsBaseHeaders,
    },
  });
}
