/**
 * lib/whatsapp.ts — WhatsApp Business Cloud API helpers
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 *
 * ⚠️  Only call these functions from API routes (pages/api/).
 *     Your access token must never reach the browser.
 */

// TODO: Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env.local
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const API_VERSION = 'v22.0'; // Update to the latest version if needed
const BASE_URL = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

// ─── Payload types ────────────────────────────────────────────────────────────

export interface SendTextPayload {
  to: string;          // E.164 format: +447911123456
  body: string;        // Message text
  previewUrl?: boolean;
}

export interface SendTemplatePayload {
  to: string;
  templateName: string;         // e.g. 'hello_world'
  languageCode?: string;        // e.g. 'en_US' — defaults to 'en_US'
  // TODO: Add components array if your template has variables
  // components?: TemplateComponent[];
}

export interface WhatsAppApiResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
  // Error shape
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

// ─── Send a plain text message ────────────────────────────────────────────────
//
// ⚠️  Plain text messages can ONLY be sent within a 24-hour customer service
//     window (i.e. the recipient has messaged you in the last 24h).
//     Outside that window, you MUST use a template message (sendTemplate below).

export async function sendTextMessage(
  payload: SendTextPayload
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: payload.to,
      type: 'text',
      text: {
        preview_url: payload.previewUrl ?? false,
        body: payload.body,
      },
    }),
  });

  const json: WhatsAppApiResponse = await res.json();

  if (!res.ok || json.error) {
    return {
      ok: false,
      error: json.error?.message ?? `HTTP ${res.status}`,
    };
  }

  return {
    ok: true,
    messageId: json.messages?.[0]?.id,
  };
}

// ─── Send a template message ──────────────────────────────────────────────────
//
// Template messages can be sent at any time (no 24h window restriction).
// Templates must be pre-approved in Meta Business Manager.
// TODO: Add your approved template names and any variable components.

export async function sendTemplate(
  payload: SendTemplatePayload
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: payload.to,
      type: 'template',
      template: {
        name: payload.templateName,
        language: {
          code: payload.languageCode ?? 'en_US',
        },
        // TODO: Uncomment and fill in if your template has variable placeholders:
        // components: payload.components ?? [],
      },
    }),
  });

  const json: WhatsAppApiResponse = await res.json();

  if (!res.ok || json.error) {
    return {
      ok: false,
      error: json.error?.message ?? `HTTP ${res.status}`,
    };
  }

  return {
    ok: true,
    messageId: json.messages?.[0]?.id,
  };
}
