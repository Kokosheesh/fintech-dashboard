// Founder's Seat — PhonePe Standard Checkout (PG v2) for the one-time unlock.
// Routes:  POST /phonepe/pay      (signed-in player)  -> { redirectUrl, order }
//          POST /phonepe/status   (signed-in player)  -> { status }   body: { order }
//          POST /phonepe/webhook  (PhonePe servers)   -> 200
// Deploy with "Verify JWT" OFF: the pay and status routes check the player's token themselves,
// and PhonePe's webhook does not send a Supabase token.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   PHONEPE_CLIENT_ID, PHONEPE_CLIENT_SECRET, PHONEPE_CLIENT_VERSION   from the PhonePe Business dashboard
//   PHONEPE_ENV                 "sandbox" (default) or "production"
//   PHONEPE_WEBHOOK_USER, PHONEPE_WEBHOOK_PASS                         the username/password you set on the webhook
//   PRICE_PAISE                 optional, default 26900 (₹269)
//   ALLOWED_ORIGINS             optional, comma-separated sites allowed to start a payment
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ENV = (Deno.env.get('PHONEPE_ENV') || 'sandbox').toLowerCase();
const PROD = ENV === 'production';
const BASE = PROD ? 'https://api.phonepe.com/apis/pg' : 'https://api-preprod.phonepe.com/apis/pg-sandbox';
const TOKEN_URL = PROD ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token' : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';
const PRICE = Number(Deno.env.get('PRICE_PAISE') || 26900);
const ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || 'https://fintech.pelicanx.in,https://kokosheesh.github.io,http://localhost:8800')
  .split(',').map((s) => s.trim()).filter(Boolean);
const DEFAULT_RETURN = 'https://fintech.pelicanx.in/founders-seat/play/';

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

let cached = { token: '', exp: 0 };
async function phonepeToken(): Promise<string> {
  if (cached.token && cached.exp - 120 > Date.now() / 1000) return cached.token;
  const id = Deno.env.get('PHONEPE_CLIENT_ID'), secret = Deno.env.get('PHONEPE_CLIENT_SECRET');
  if (!id || !secret) throw new HttpError(503, 'Payments are not switched on yet.');
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_version: Deno.env.get('PHONEPE_CLIENT_VERSION') || '1', client_secret: secret, grant_type: 'client_credentials' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) { console.error('token', r.status, j); throw new HttpError(502, 'Could not connect to PhonePe.'); }
  cached = { token: j.access_token, exp: Number(j.expires_at) || Date.now() / 1000 + 600 };
  return cached.token;
}

async function playerFrom(req: Request) {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) throw new HttpError(401, 'Sign in first.');
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) throw new HttpError(401, 'Your session expired. Sign in again.');
  return data.user;
}

async function orderStatus(merchantOrderId: string) {
  const t = await phonepeToken();
  const r = await fetch(`${BASE}/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status?details=false`, {
    headers: { 'Content-Type': 'application/json', Authorization: 'O-Bearer ' + t },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('status', r.status, j); throw new HttpError(502, 'Could not check the payment with PhonePe.'); }
  return j;
}

// Record PhonePe's verdict. A COMPLETED order only counts if the amount matches what we asked for.
async function record(merchantOrderId: string, ph: Record<string, unknown>) {
  const { data: row } = await admin.from('payments').select('*').eq('merchant_order_id', merchantOrderId).maybeSingle();
  if (!row) return null;
  if (row.status === 'COMPLETED') return 'COMPLETED';
  const state = String(ph.state || '');
  let status = state === 'COMPLETED' ? 'COMPLETED' : state === 'FAILED' ? 'FAILED' : 'PENDING';
  const amount = Number(ph.amount);
  if (status === 'COMPLETED' && amount && amount !== row.amount_paise) status = 'MISMATCH';
  await admin.from('payments').update({
    status, phonepe_order_id: (ph.orderId as string) || row.phonepe_order_id, provider_response: ph, updated_at: new Date().toISOString(),
  }).eq('merchant_order_id', merchantOrderId);
  return status;
}

async function sha256hex(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
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
      const order = 'FS' + Date.now().toString(36).toUpperCase() + crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
      const t = await phonepeToken();
      const { error: insErr } = await admin.from('payments').insert({ user_id: user.id, merchant_order_id: order, amount_paise: PRICE });
      if (insErr) { console.error(insErr); throw new HttpError(500, 'Could not start the payment.'); }
      const r = await fetch(`${BASE}/checkout/v2/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'O-Bearer ' + t },
        body: JSON.stringify({
          merchantOrderId: order,
          amount: PRICE,
          expireAfter: 1200,
          metaInfo: { udf1: user.id, udf2: user.email || '' },
          paymentFlow: {
            type: 'PG_CHECKOUT',
            message: "Founder's Seat: full access",
            merchantUrls: { redirectUrl: back + (back.includes('?') ? '&' : '?') + 'order=' + order },
          },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.redirectUrl) {
        console.error('pay', r.status, j);
        await admin.from('payments').update({ status: 'FAILED', provider_response: j }).eq('merchant_order_id', order);
        throw new HttpError(502, 'PhonePe could not start the payment. Try again.');
      }
      await admin.from('payments').update({ phonepe_order_id: j.orderId || null }).eq('merchant_order_id', order);
      return json(req, { redirectUrl: j.redirectUrl, order });
    }

    if (route === 'status') {
      const user = await playerFrom(req);
      const { order } = await req.json().catch(() => ({}));
      if (!order) throw new HttpError(400, 'Missing order.');
      const { data: row } = await admin.from('payments').select('user_id,status').eq('merchant_order_id', order).maybeSingle();
      if (!row || row.user_id !== user.id) throw new HttpError(404, 'Payment not found.');
      if (row.status === 'COMPLETED') return json(req, { status: 'COMPLETED' });
      const status = await record(order, await orderStatus(order));
      return json(req, { status });
    }

    if (route === 'webhook') {
      const u = Deno.env.get('PHONEPE_WEBHOOK_USER'), p = Deno.env.get('PHONEPE_WEBHOOK_PASS');
      if (!u || !p) throw new HttpError(503, 'Webhook not configured.');
      const got = (req.headers.get('authorization') || '').replace(/^(SHA256|Bearer)\s+/i, '').trim().toLowerCase();
      if (got !== await sha256hex(`${u}:${p}`)) throw new HttpError(401, 'Bad signature.');
      const evt = await req.json().catch(() => ({}));
      const moid = evt?.payload?.merchantOrderId;
      // Never trust the webhook body alone: confirm with PhonePe before unlocking.
      if (moid && /^checkout\.order\./.test(evt.event || '')) await record(moid, await orderStatus(moid));
      return json(req, { ok: true });
    }

    throw new HttpError(404, 'Unknown route.');
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (!(e instanceof HttpError)) console.error(e);
    return json(req, { error: e instanceof Error ? e.message : 'Error' }, status);
  }
});
