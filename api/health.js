/**
 * GET /api/health
 * Returns backend status. Frontend uses this to decide sim vs live mode.
 */
export const config = { runtime: 'edge' };

import { cors, preflight, getKV, now } from './_lib.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return preflight();

  try {
    const kv = await getKV();
    // lightweight ping — just count persons index members
    const personCount = await kv.scard('persons:index');
    return cors(200, {
      ok: true,
      service: 'DisasterNet Sync API',
      version: '1.0.0',
      persons: personCount || 0,
      ts: now(),
    });
  } catch (e) {
    return cors(503, { ok: false, error: 'KV unavailable', detail: e.message });
  }
}
