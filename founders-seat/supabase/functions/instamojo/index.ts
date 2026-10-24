// Founder's Seat — Instamojo checkout (Payments API v1.1) for the one-time unlock.
// Routes:  POST /instamojo/pay      (signed-in player)  -> { redirectUrl, order }
//          POST /instamojo/status   (signed-in player)  -> { status }   body: { order, payment_id? }
//          POST /instamojo/webhook  (Instamojo servers) -> 200
// Deploy with "Verify JWT" OFF: pay and status check the player's token themselves,
// and Instamojo's webhook does not send a Supabase token.
//
// Secrets (Supabase → Edge Functions → Secrets), from Instamojo → API & Plugins:
//   INSTAMOJO_API_KEY, INSTAMOJO_AUTH_TOKEN, INSTAMOJO_SALT
//   INSTAMOJO_ENV     optional: "production" (default) or "test" (test.instamojo.com keys)
//   PRICE_PAISE       optional, default 26900 (₹269)
//   ALLOWED_ORIGINS   optional, comma-separated sites allowed to start a payment
//
// Uses the same payments table as the PhonePe function. For Instamojo rows,
// phonepe_order_id holds the Instamojo payment_request_id.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const TEST = (Deno.env.get('INSTAMOJO_ENV') || 'production').toLowerCase() === 'test';
const API = TEST ? 'https://test.instamojo.com/api/1.1' : 'https://www.instamojo.com/api/1.1';
const PRICE = Number(Deno.env.get('PRICE_PAISE') || 26900);
const ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || 'https://fintech.pelicanx.in,https://kokosheesh.github.io,http://localhost:8800')
  .split(',').map((s) => s.trim()).filter(Boolean);
const DEFAULT_RETURN = 'https://fintech.pelicanx.in/founders-seat/play/';
const WEBHOOK = Deno.env.get('SUPABASE_URL') + '/functions/v1/instamojo/webhook';

function serverKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try { const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'); return keys.default || Object.values(keys)[0] as string; } catch { return ''; }
}
const admin = createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), { auth: { persistSession: false } });

class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }

function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });
}

function keys() {
  const k = Deno.env.get('INSTAMOJO_API_KEY'), t = Deno.env.get('INSTAMOJO_AUTH_TOKEN');
  if (!k || !t) throw new HttpError(503, 'Payments are not switched on yet.');
  return { 'X-Api-Key': k, 'X-Auth-Token': t };
}
async function im(path: string, init: RequestInit = {}) {
  const r = await fetch(API + path, { ...init, headers: { ...keys(), ...(init.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) { console.error('instamojo', path, r.status, j); throw new HttpError(502, 'Could not reach Instamojo. Try again.'); }
  return j;
}

async function playerFrom(req: Request) {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) throw new HttpError(401, 'Sign in first.');
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) throw new HttpError(401, 'Your session expired. Sign in again.');
  return data.user;
}

// Ask Instamojo what happened to this payment request. Returns the best payment we can find.
async function lookup(requestId: string, paymentId?: string) {
  if (paymentId) {
    const j = await im(`/payment-requests/${encodeURIComponent(requestId)}/${encodeURIComponent(paymentId)}/`);
    const pr = j.payment_request || {};
    return { request: pr, payment: pr.payment || j.payment || null };
  }
  const j = await im(`/payment-requests/${encodeURIComponent(requestId)}/`);
  const pr = j.payment_request || {};
  const list = Array.isArray(pr.payments) ? pr.payments.filter((p: unknown) => p && typeof p === 'object') : [];
  const credit = list.find((p: Record<string, unknown>) => String(p.status).toLowerCase() === 'credit');
  return { request: pr, payment: credit || list[0] || null };
}

// Record Instamojo's verdict. A credited payment only counts if the amount matches what we asked for.
async function record(row: Record<string, any>, found: { request: Record<string, any>; payment: Record<string, any> | null }) {
  if (row.status === 'COMPLETED') return 'COMPLETED';
  const p = found.payment;
  const ps = String(p?.status || '').toLowerCase();
  let status = ps === 'credit' ? 'COMPLETED' : ps === 'failed' ? 'FAILED' : 'PENDING';
  if (status === 'COMPLETED' && Math.round(Number(p!.amount) * 100) !== row.amount_paise) status = 'MISMATCH';
  await admin.from('payments').update({
    status, provider_response: { provider: 'instamojo', request: found.request, payment: p }, updated_at: new Date().toISOString(),
  }).eq('merchant_order_id', row.merchant_order_id);
  return status;
}

async function hmacSha1(key: string, msg: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  const route = new URL(req.url).pathname.split('/').pop();
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');

    if (route === 'pay') {
      const user = await playerFrom(req);
      const { data: paid } = await admin.from('payments').select('id').eq('user_id', user.id).eq('status', 'COMPLETED').limit(1);
      if (paid && paid.length) return json(req, { already: true });
      const body = await req.json().catch(() => ({}));
      let back = String(body.returnUrl || DEFAULT_RETURN);
      if (!ORIGINS.some((o) => back.startsWith(o + '/'))) back = DEFAULT_RETURN;
      back = back.split('#')[0].split('?')[0];
      const order = 'FS' + Date.now().toString(36).toUpperCase() + crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
      keys();
      const { error: insErr } = await admin.from('payments').insert({ user_id: user.id, merchant_order_id: order, amount_paise: PRICE });
      if (insErr) { console.error(insErr); throw new HttpError(500, 'Could not start the payment.'); }
      const name = String(user.user_metadata?.full_name || user.user_metadata?.name || '').slice(0, 100);
      const form = new URLSearchParams({
        purpose: "Founder's Seat full access",
        amount: (PRICE / 100).toFixed(2),
        redirect_url: back + '?order=' + order,
        webhook: WEBHOOK,
        allow_repeated_payments: 'False',
        send_email: 'False',
        send_sms: 'False',
      });
      if (user.email) form.set('email', user.email);
      if (name) form.set('buyer_name', name);
      let j;
      try {
        j = await im('/payment-requests/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
      } catch (e) {
        await admin.from('payments').update({ status: 'FAILED' }).eq('merchant_order_id', order);
        throw e;
      }
      const pr = j.payment_request || {};
      if (!pr.longurl || !pr.id) {
        await admin.from('payments').update({ status: 'FAILED', provider_response: j }).eq('merchant_order_id', order);
        throw new HttpError(502, 'Instamojo could not start the payment. Try again.');
      }
      await admin.from('payments').update({ phonepe_order_id: pr.id, provider_response: { provider: 'instamojo', request: pr } }).eq('merchant_order_id', order);
      return json(req, { redirectUrl: pr.longurl, order });
    }

    if (route === 'status') {
      const user = await playerFrom(req);
      const { order, payment_id } = await req.json().catch(() => ({}));
      if (!order) throw new HttpError(400, 'Missing order.');
      const { data: row } = await admin.from('payments').select('*').eq('merchant_order_id', order).maybeSingle();
      if (!row || row.user_id !== user.id) throw new HttpError(404, 'Payment not found.');
      if (row.status === 'COMPLETED') return json(req, { status: 'COMPLETED' });
      if (!row.phonepe_order_id) return json(req, { status: row.status });
      const status = await record(row, await lookup(row.phonepe_order_id, payment_id ? String(payment_id) : undefined));
      return json(req, { status });
    }

    if (route === 'webhook') {
      const salt = Deno.env.get('INSTAMOJO_SALT');
      if (!salt) throw new HttpError(503, 'Webhook not configured.');
      const data: Record<string, string> = {};
      (await req.formData()).forEach((v, k) => { data[k] = String(v); });
      const mac = (data.mac || '').toLowerCase();
      delete data.mac;
      const msg = Object.keys(data).sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1)).map((k) => data[k]).join('|');
      if (!mac || mac !== await hmacSha1(salt, msg)) throw new HttpError(401, 'Bad signature.');
      const rid = data.payment_request_id;
      if (rid) {
        const { data: row } = await admin.from('payments').select('*').eq('phonepe_order_id', rid).maybeSingle();
        // Never trust the webhook body alone: confirm with Instamojo before unlocking.
        if (row) await record(row, await lookup(rid, data.payment_id || undefined));
      }
      return json(req, { ok: true });
    }

    throw new HttpError(404, 'Unknown route.');
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (!(e instanceof HttpError)) console.error(e);
    return json(req, { error: e instanceof Error ? e.message : 'Error' }, status);
  }
});
