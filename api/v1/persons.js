/**
 * GET  /api/v1/persons?limit=300   — list all persons
 * POST /api/v1/persons             — create / upsert a person
 *
 * Person shape:
 * {
 *   id, name, phone, lastSeenZone, note, status,
 *   anchorCid, reporterId, reporterRole,
 *   deceasedConfirmations, compensation,
 *   statusHistory: [{ status, actorId, actorRole, note, ts }],
 *   createdAt, updatedAt
 * }
 */
export const config = { runtime: 'edge' };

import { cors, preflight, getKV, uid, now, parseBody, kvGetAll } from './_lib.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return preflight();

  const kv = await getKV();

  // ── GET /api/v1/persons ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '300'), 500);
    const zone = url.searchParams.get('zone') || null;

    const persons = await kvGetAll(kv, 'persons:index', 'person', limit);
    const filtered = zone ? persons.filter(p => p.lastSeenZone === zone) : persons;
    // newest first
    filtered.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    return cors(200, { ok: true, count: filtered.length, persons: filtered });
  }

  // ── POST /api/v1/persons ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = await parseBody(req);
    const { name, phone, lastSeenZone, note, anchorCid, reporterId, reporterRole } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return cors(400, { ok: false, message: 'name is required' });
    }

    const id = uid('P');
    const ts = now();
    const person = {
      id,
      name: name.trim(),
      phone: phone || '',
      lastSeenZone: lastSeenZone || 'UNKNOWN',
      note: note || '',
      status: 'Missing',
      anchorCid: anchorCid || '',
      reporterId: reporterId || 'anonymous',
      reporterRole: reporterRole || 'rescuer',
      deceasedConfirmations: 0,
      compensation: null,
      statusHistory: [{
        status: 'Missing',
        actorId: reporterId || 'anonymous',
        actorRole: reporterRole || 'rescuer',
        note: 'Initial report',
        ts,
      }],
      createdAt: ts,
      updatedAt: ts,
    };

    await kv.set(`person:${id}`, person);
    await kv.sadd('persons:index', id);

    // Also create a sync bundle entry for this write
    const bundleId = uid('B');
    await kv.set(`bundle:${bundleId}`, { id: bundleId, type: 'person_created', personId: id, ts });
    await kv.sadd('bundle:index', bundleId);

    return cors(201, { ok: true, person });
  }

  return cors(405, { ok: false, message: 'Method not allowed' });
}
