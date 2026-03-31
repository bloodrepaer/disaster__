/**
 * GET  /api/v1/family/search?query=   — search persons by name or phone
 * POST /api/v1/persons/:id/family/request-otp   — send OTP to registered phone
 * POST /api/v1/persons/:id/family/verify-otp    — verify OTP and return full record
 */
export const config = { runtime: 'edge' };

import { cors, preflight, getKV, uid, now, parseBody, kvGetAll } from './_lib.js';

const OTP_TTL_SECONDS = 300; // 5 minutes
const MAX_ATTEMPTS = 5;

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function redactPhone(phone) {
  if (!phone || phone.length < 4) return '****';
  return phone.slice(0, 2) + 'XXXXXX' + phone.slice(-2);
}

function publicRecord(p) {
  // Return only safe fields for search results (no personal details)
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    lastSeenZone: p.lastSeenZone,
    lastUpdatedAt: p.updatedAt,
    phone: redactPhone(p.phone),
    anchorCid: p.anchorCid || '',
    compensation: p.compensation ? { status: p.compensation.status, amount: p.compensation.amount } : null,
  };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return preflight();

  const url = new URL(req.url);
  const kv = await getKV();

  // ── GET /api/v1/family/search ───────────────────────────────────────────
  if (req.method === 'GET' && url.pathname.includes('/family/search')) {
    const query = (url.searchParams.get('query') || '').trim().toLowerCase();
    if (!query || query.length < 2) {
      return cors(400, { ok: false, message: 'query must be at least 2 characters' });
    }

    const allPersons = await kvGetAll(kv, 'persons:index', 'person', 500);
    const results = allPersons
      .filter(p =>
        p.name?.toLowerCase().includes(query) ||
        p.phone?.includes(query) ||
        p.id?.toLowerCase().includes(query)
      )
      .slice(0, 20)
      .map(publicRecord);

    return cors(200, { ok: true, count: results.length, results });
  }

  // ── Extract person ID from path ─────────────────────────────────────────
  const parts = url.pathname.split('/');
  const personsIdx = parts.indexOf('persons');
  const personId = personsIdx !== -1 ? parts[personsIdx + 1] : null;

  // ── POST /api/v1/persons/:id/family/request-otp ─────────────────────────
  if (req.method === 'POST' && url.pathname.includes('/family/request-otp')) {
    if (!personId) return cors(400, { ok: false, message: 'Missing person ID' });

    const person = await kv.get(`person:${personId}`);
    if (!person) return cors(404, { ok: false, message: 'Person not found' });

    const body = await parseBody(req);
    const phone = (body.phone || '').trim();
    if (!phone) return cors(400, { ok: false, message: 'phone is required' });

    const code = generateOTP();
    const otpKey = `otp:${personId}:${phone}`;
    await kv.set(otpKey, { code, expiresAt: Date.now() + OTP_TTL_SECONDS * 1000, attempts: 0 }, {
      ex: OTP_TTL_SECONDS,
    });

    // In production: trigger SMS via Twilio / MSG91 here.
    // For hackathon: log it and return success — code visible in mesh logs for demo.
    console.log(`[DisasterNet OTP] Person ${personId} | Phone ${phone} | Code ${code}`);

    return cors(200, {
      ok: true,
      message: 'OTP sent to registered phone number',
      // Remove next line in production — only for demo transparency
      _demo_code: code,
    });
  }

  // ── POST /api/v1/persons/:id/family/verify-otp ──────────────────────────
  if (req.method === 'POST' && url.pathname.includes('/family/verify-otp')) {
    if (!personId) return cors(400, { ok: false, message: 'Missing person ID' });

    const body = await parseBody(req);
    const { phone, otp } = body;
    if (!phone || !otp) return cors(400, { ok: false, message: 'phone and otp are required' });

    const otpKey = `otp:${personId}:${phone}`;
    const record = await kv.get(otpKey);

    if (!record) {
      return cors(400, { ok: false, message: 'OTP expired or not requested. Please request a new one.' });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      return cors(429, { ok: false, message: 'Too many attempts. Request a new OTP.' });
    }

    if (Date.now() > record.expiresAt) {
      await kv.del(otpKey);
      return cors(400, { ok: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (otp !== record.code) {
      // Increment attempts
      await kv.set(otpKey, { ...record, attempts: record.attempts + 1 }, { ex: OTP_TTL_SECONDS });
      return cors(400, {
        ok: false,
        message: 'Incorrect OTP.',
        remainingAttempts: MAX_ATTEMPTS - record.attempts - 1,
      });
    }

    // ✅ OTP correct — return full person record
    await kv.del(otpKey);
    const person = await kv.get(`person:${personId}`);
    if (!person) return cors(404, { ok: false, message: 'Record not found' });

    return cors(200, {
      ok: true,
      record: {
        ...person,
        // mask phone except last 2 digits for display
        phone: redactPhone(person.phone),
      },
    });
  }

  return cors(405, { ok: false, message: 'Method not allowed' });
}
