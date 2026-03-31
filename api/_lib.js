/**
 * DisasterNet — Shared utilities for all Edge Function API routes
 * Uses Vercel KV (Upstash Redis) via @vercel/kv
 *
 * KV key schema:
 *   person:{id}          → Person object (JSON)
 *   persons:index        → Set of all person IDs
 *   otp:{personId}:{phone} → { code, expiresAt, attempts }
 *   sms:{id}             → SMS/notification object
 *   sms:index            → Set of all SMS IDs
 *   anchor:{id}          → Anchor object
 *   anchor:index         → Set of all anchor IDs
 *   receipt:{id}         → Anchor receipt object
 *   receipt:index        → Set of all receipt IDs
 *   bundle:{id}          → Sync bundle object
 *   bundle:index         → Set of all bundle IDs
 */

export const ALLOWED_ORIGIN = '*'; // tighten to your Vercel domain in production

export function cors(status, body, extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extra,
  };
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers,
  });
}

export function preflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/** Get Vercel KV client — lazy import so non-KV routes don't break */
export async function getKV() {
  const { kv } = await import('@vercel/kv');
  return kv;
}

/** Generate a short unique ID */
export function uid(prefix = 'P') {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/** Current ISO timestamp */
export const now = () => new Date().toISOString();

/** Parse JSON body safely */
export async function parseBody(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/** Read all items from an index set + individual keys */
export async function kvGetAll(kv, indexKey, itemPrefix, limit = 300) {
  const ids = await kv.smembers(indexKey);
  if (!ids || !ids.length) return [];
  const slice = ids.slice(0, limit);
  const pipeline = kv.pipeline();
  slice.forEach(id => pipeline.get(`${itemPrefix}:${id}`));
  const results = await pipeline.exec();
  return results.filter(Boolean);
}
