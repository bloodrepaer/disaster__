/**
 * POST /api/v1/persons/:id/status
 *
 * Body: { status, actorId, actorRole, note, lastSeenZone }
 *
 * Special logic:
 *  - "Deceased" increments deceasedConfirmations counter
 *  - When confirmations >= 2, auto-triggers compensation and creates SMS proof record
 *  - Returns updated person + compensation details if triggered
 */
export const config = { runtime: 'edge' };

import { cors, preflight, getKV, uid, now, parseBody } from './_lib.js';

const COMPENSATION_THRESHOLD = 2; // confirmations needed to auto-trigger

export default async function handler(req) {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return cors(405, { ok: false, message: 'Method not allowed' });

  // Extract :id from URL  /api/v1/persons/{id}/status
  const url = new URL(req.url);
  const parts = url.pathname.split('/');
  // pathname: /api/v1/persons/{id}/status
  const idIndex = parts.indexOf('persons') + 1;
  const personId = parts[idIndex];

  if (!personId) return cors(400, { ok: false, message: 'Missing person ID in path' });

  const kv = await getKV();
  const person = await kv.get(`person:${personId}`);
  if (!person) return cors(404, { ok: false, message: 'Person not found' });

  const body = await parseBody(req);
  const { status, actorId, actorRole, note, lastSeenZone } = body;

  if (!status) return cors(400, { ok: false, message: 'status is required' });

  const ts = now();
  const historyEntry = {
    status,
    actorId: actorId || 'unknown',
    actorRole: actorRole || 'rescuer',
    note: note || '',
    ts,
  };

  // Build updated person
  const updated = {
    ...person,
    status,
    lastSeenZone: lastSeenZone || person.lastSeenZone,
    updatedAt: ts,
    statusHistory: [historyEntry, ...(person.statusHistory || [])].slice(0, 20),
  };

  // ── Deceased confirmation logic ─────────────────────────────────────────
  let compensationResult = null;

  if (status === 'Deceased') {
    // Guard: don't count same actor twice
    const alreadyCounted = (person.statusHistory || []).some(
      h => h.status === 'Deceased' && h.actorId === (actorId || 'unknown')
    );
    if (!alreadyCounted) {
      updated.deceasedConfirmations = (person.deceasedConfirmations || 0) + 1;
    } else {
      updated.deceasedConfirmations = person.deceasedConfirmations || 1;
    }

    // Auto-trigger compensation when threshold reached
    if (
      updated.deceasedConfirmations >= COMPENSATION_THRESHOLD &&
      !person.compensation
    ) {
      const mockTxHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}`;

      compensationResult = {
        status: 'paid',
        amount: '₹4,00,000',
        chain: 'starknet-sepolia',
        txHash: mockTxHash,
        triggeredAt: ts,
      };
      updated.compensation = compensationResult;

      // Create SMS proof record
      const smsId = uid('SMS');
      await kv.set(`sms:${smsId}`, {
        id: smsId,
        type: 'COMPENSATION_PROOF',
        personId,
        phone: person.phone || '',
        txHash: mockTxHash,
        sentAt: ts,
        message: `Compensation of ₹4,00,000 triggered for ${person.name} — Starknet tx: ${mockTxHash.slice(0, 16)}...`,
      });
      await kv.sadd('sms:index', smsId);

      // Create anchor receipt
      const receiptId = uid('R');
      await kv.set(`receipt:${receiptId}`, {
        id: receiptId,
        personId,
        type: 'compensation_triggered',
        txHash: mockTxHash,
        anchorCid: person.anchorCid || '',
        ts,
      });
      await kv.sadd('receipt:index', receiptId);
    }
  }

  // Save updated person
  await kv.set(`person:${personId}`, updated);

  // Create bundle entry
  const bundleId = uid('B');
  await kv.set(`bundle:${bundleId}`, { id: bundleId, type: 'status_updated', personId, status, ts });
  await kv.sadd('bundle:index', bundleId);

  return cors(200, {
    ok: true,
    person: updated,
    deceasedConfirmations: updated.deceasedConfirmations || 0,
    compensation: compensationResult,
  });
}
