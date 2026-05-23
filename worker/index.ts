/**
 * worker/index.ts — Standalone Cloudflare Worker backend
 *
 * Use this ONLY if you deploy the frontend to GitHub Pages (static export).
 * If you deploy to Cloudflare Pages, the Next.js API routes handle everything
 * and you do NOT need this file.
 *
 * ── Deploy ──────────────────────────────────────────────────────────────────
 *   npm install -g wrangler
 *   npx wrangler deploy worker/index.ts --name whatsapp-sender-api
 *
 * ── Set secrets ─────────────────────────────────────────────────────────────
 *   npx wrangler secret put SUPABASE_URL
 *   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
 *   npx wrangler secret put WHATSAPP_ACCESS_TOKEN
 *   npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
 *   npx wrangler secret put WHATSAPP_VERIFY_TOKEN
 *
 * ── After deploying ──────────────────────────────────────────────────────────
 * Update the fetch() calls in pages/index.tsx to point to this Worker's URL:
 *   '/api/contacts' → 'https://whatsapp-sender-api.YOUR_SUBDOMAIN.workers.dev/contacts'
 *   '/api/send'     → 'https://whatsapp-sender-api.YOUR_SUBDOMAIN.workers.dev/send'
 *   '/api/logs'     → 'https://whatsapp-sender-api.YOUR_SUBDOMAIN.workers.dev/logs'
 *   '/api/webhook'  → 'https://whatsapp-sender-api.YOUR_SUBDOMAIN.workers.dev/webhook'
 */

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  WHATSAPP_ACCESS_TOKEN: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_VERIFY_TOKEN: string;
}

// ─── CORS headers — restrict to your GitHub Pages domain in production ────────
// TODO: Replace '*' with your actual GitHub Pages URL, e.g. 'https://YOUR_USERNAME.github.io'
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === '/contacts' && request.method === 'GET') {
      return handleContacts(env);
    }
    if (url.pathname === '/send' && request.method === 'POST') {
      return handleSend(request, env);
    }
    if (url.pathname === '/logs' && request.method === 'GET') {
      return handleLogs(request, env);
    }
    if (url.pathname === '/webhook') {
      if (request.method === 'GET')  return handleWebhookVerify(url, env);
      if (request.method === 'POST') return handleWebhookEvents(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function supabase(
  env: Env,
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<Response> {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleContacts(env: Env): Promise<Response> {
  const res = await supabase(env, 'contacts?select=*&opted_in=eq.true&order=created_at.desc', 'GET');
  const data = await res.json();
  return jsonResponse({ contacts: data });
}

async function handleLogs(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = url.searchParams.get('limit') ?? '30';
  const contactId = url.searchParams.get('contact_id');

  let path = `message_log?select=*,contacts(name,phone)&order=sent_at.desc&limit=${limit}`;
  if (contactId) path += `&contact_id=eq.${contactId}`;

  const res = await supabase(env, path, 'GET');
  const data = await res.json();
  return jsonResponse({ logs: data });
}

async function handleSend(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    contactIds?: number[];
    sendToAll?: boolean;
    message?: string;
    useTemplate?: boolean;
    templateName?: string;
  };

  // Fetch contacts
  const contactFilter = body.sendToAll
    ? 'contacts?select=id,name,phone&opted_in=eq.true'
    : `contacts?select=id,name,phone&opted_in=eq.true&id=in.(${(body.contactIds ?? []).join(',')})`;

  const contactsRes = await supabase(env, contactFilter, 'GET');
  const contacts = await contactsRes.json() as Array<{ id: number; name: string | null; phone: string }>;

  if (!contacts || contacts.length === 0) {
    return jsonResponse({ results: [], message: 'No opted-in contacts found.' });
  }

  const WA_URL = `https://graph.facebook.com/v22.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const results = [];

  for (const contact of contacts) {
    const waPayload = body.useTemplate
      ? {
          messaging_product: 'whatsapp',
          to: contact.phone,
          type: 'template',
          template: { name: body.templateName, language: { code: 'en_US' } },
        }
      : {
          messaging_product: 'whatsapp',
          to: contact.phone,
          type: 'text',
          text: { body: body.message, preview_url: false },
        };

    const waRes = await fetch(WA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(waPayload),
    });

    const waJson = await waRes.json() as {
      messages?: Array<{ id: string }>;
      error?: { message: string };
    };

    const ok = waRes.ok && !waJson.error;
    const messageId = waJson.messages?.[0]?.id ?? null;

    // Log to Supabase
    await supabase(env, 'message_log', 'POST', {
      contact_id:   contact.id,
      phone:        contact.phone,
      direction:    'outbound',
      message_body: body.useTemplate ? `[template: ${body.templateName}]` : body.message,
      wa_message_id: messageId,
      status:       ok ? 'sent' : 'failed',
      error_message: waJson.error?.message ?? null,
    });

    // Update contact status
    await supabase(env, `contacts?id=eq.${contact.id}`, 'PATCH', {
      last_sent_at: new Date().toISOString(),
      last_status:  ok ? 'sent' : 'failed',
      error_detail: waJson.error?.message ?? null,
    });

    results.push({ id: contact.id, phone: contact.phone, ok, messageId });
  }

  return jsonResponse({
    sent:    results.filter((r) => r.ok).length,
    failed:  results.filter((r) => !r.ok).length,
    results,
  });
}

function handleWebhookVerify(url: URL, env: Env): Response {
  const mode      = url.searchParams.get('hub.mode');
  const token     = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { headers: CORS_HEADERS });
  }
  return new Response('Forbidden', { status: 403 });
}

async function handleWebhookEvents(request: Request, env: Env): Promise<Response> {
  // Respond immediately — Meta requires a fast 200
  const body = await request.json() as Record<string, unknown>;

  // Process async (fire-and-forget; use ctx.waitUntil in production for reliability)
  if ((body as { object?: string }).object === 'whatsapp_business_account') {
    const entries = (body as { entry?: unknown[] }).entry ?? [];

    for (const entry of entries as Array<{ changes?: unknown[] }>) {
      for (const change of entry.changes ?? []) {
        const value = (change as { value?: Record<string, unknown[]> }).value ?? {};

        // Status updates
        for (const su of value.statuses ?? []) {
          const s = su as { id: string; status: string; timestamp: string; errors?: Array<{ code: number; message: string }> };
          await supabase(
            env,
            `message_log?wa_message_id=eq.${encodeURIComponent(s.id)}`,
            'PATCH',
            {
              status:        s.status,
              error_code:    s.errors?.[0]?.code?.toString() ?? null,
              error_message: s.errors?.[0]?.message ?? null,
              updated_at:    new Date(Number(s.timestamp) * 1000).toISOString(),
            }
          );
        }

        // Inbound messages
        for (const msg of value.messages ?? []) {
          const m = msg as { id: string; from: string; timestamp: string; text?: { body: string } };
          const contactRes = await supabase(env, `contacts?phone=eq.%2B${m.from}&select=id`, 'GET');
          const contactArr = await contactRes.json() as Array<{ id: number }>;
          const contactId = contactArr[0]?.id ?? null;

          await supabase(env, 'message_log', 'POST', {
            contact_id:    contactId,
            phone:         `+${m.from}`,
            direction:     'inbound',
            message_body:  m.text?.body ?? null,
            wa_message_id: m.id,
            status:        'sent',
            sent_at:       new Date(Number(m.timestamp) * 1000).toISOString(),
            updated_at:    new Date().toISOString(),
          });
        }
      }
    }
  }

  return new Response('OK', { headers: CORS_HEADERS });
}
