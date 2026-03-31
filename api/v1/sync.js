/**
 * GET /api/v1/sms?limit=300
 * GET /api/v1/sync-bundles?limit=1
 * GET /api/v1/anchors?status=queued&limit=1
 * GET /api/v1/anchor-receipts?limit=200
 *
 * These are read-only endpoints consumed by the frontend's
 * refreshLiveBackendSnapshot() to show backend health + activity.
 */
export const config = { runtime: 'edge' };

import { cors, preflight, getKV, kvGetAll } from './_lib.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'GET') return cors(405, { ok: false, message: 'Method not allowed' });

  const url = new URL(req.url);
  const path = url.pathname;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '300'), 500);
  const kv = await getKV();

  // ── /api/v1/sms ──────────────────────────────────────────────────────────
  if (path.includes('/sms')) {
    const messages = await kvGetAll(kv, 'sms:index', 'sms', limit);
    messages.sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));
    return cors(200, { ok: true, count: messages.length, messages });
  }

  // ── /api/v1/sync-bundles ─────────────────────────────────────────────────
  if (path.includes('/sync-bundles')) {
    const bundles = await kvGetAll(kv, 'bundle:index', 'bundle', limit);
    bundles.sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
    const count = await kv.scard('bundle:index');
    return cors(200, { ok: true, count, bundles: bundles.slice(0, limit) });
  }

  // ── /api/v1/anchors ──────────────────────────────────────────────────────
  if (path.includes('/anchors') && !path.includes('receipts')) {
    const status = url.searchParams.get('status') || null;
    const anchors = await kvGetAll(kv, 'anchor:index', 'anchor', limit);
    const filtered = status ? anchors.filter(a => a.status === status) : anchors;
    filtered.sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
    return cors(200, { ok: true, count: filtered.length, anchors: filtered });
  }

  // ── /api/v1/anchor-receipts ──────────────────────────────────────────────
  if (path.includes('/anchor-receipts')) {
    const receipts = await kvGetAll(kv, 'receipt:index', 'receipt', limit);
    receipts.sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
    const count = await kv.scard('receipt:index');
    return cors(200, { ok: true, count, receipts: receipts.slice(0, limit) });
  }

  return cors(404, { ok: false, message: 'Unknown endpoint' });
}
