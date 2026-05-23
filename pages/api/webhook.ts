/**
 * GET  /api/webhook — Meta webhook verification challenge
 * POST /api/webhook — Incoming messages & status updates from Meta
 *
 * Configure in Meta App Dashboard:
 *   Webhook URL  → https://your-domain.com/api/webhook
 *   Verify Token → value of WHATSAPP_VERIFY_TOKEN in .env.local
 *   Subscribe to → messages, message_status
 */
export const runtime = 'edge';
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// TODO: Set WHATSAPP_VERIFY_TOKEN in .env.local — must match what you enter in Meta Dashboard
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  // ── Webhook verification (GET) ────────────────────────────────────────────
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[webhook] Verified successfully');
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Forbidden — token mismatch' });
  }

  // ── Incoming events (POST) ────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body;

    // Always respond 200 immediately — Meta will retry if you don't
    res.status(200).send('OK');

    // Guard: only process WhatsApp events
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;

        // ── Status updates (sent → delivered → read) ──────────────────────
        for (const statusUpdate of value.statuses ?? []) {
          const { id: waMessageId, status, timestamp, errors } = statusUpdate;

          await supabaseAdmin
            .from('message_log')
            .update({
              status,
              error_code:    errors?.[0]?.code?.toString() ?? null,
              error_message: errors?.[0]?.message ?? null,
              updated_at:    new Date(Number(timestamp) * 1000).toISOString(),
            })
            .eq('wa_message_id', waMessageId);

          // Mirror status onto contacts row for convenience
          if (status === 'delivered' || status === 'read') {
            const { data: log } = await supabaseAdmin
              .from('message_log')
              .select('contact_id')
              .eq('wa_message_id', waMessageId)
              .single();

            if (log?.contact_id) {
              await supabaseAdmin
                .from('contacts')
                .update({ last_status: status })
                .eq('id', log.contact_id);
            }
          }
        }

        // ── Inbound messages (someone replied to you) ─────────────────────
        for (const inboundMsg of value.messages ?? []) {
          const from       = inboundMsg.from; // E.164 without leading '+'
          const textBody   = inboundMsg.text?.body ?? null;
          const waMessageId = inboundMsg.id;

          // Look up the contact (Supabase stores phone with '+')
          const { data: contact } = await supabaseAdmin
            .from('contacts')
            .select('id')
            .eq('phone', `+${from}`)
            .single();

          await supabaseAdmin.from('message_log').upsert(
            {
              contact_id:   contact?.id ?? null,
              phone:        `+${from}`,
              direction:    'inbound',
              message_body: textBody,
              wa_message_id: waMessageId,
              status:       'sent',
              sent_at:      new Date(Number(inboundMsg.timestamp) * 1000).toISOString(),
              updated_at:   new Date().toISOString(),
            },
            { onConflict: 'wa_message_id' }
          );
        }
      }
    }
    return;
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
